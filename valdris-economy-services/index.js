/**
 * Valdris Economy Services (VES)
 * Economy tracking - shops, services, currencies, and market prices
 */

const EXT_NAME = 'valdris-economy-services';

import {
    CURRENCIES,
    ITEM_CATEGORIES,
    MARKET_CONDITIONS,
    SERVICE_TYPES,
    formatCurrency,
    toCopper,
    calculatePrice,
    updateMarketPrices,
    createEmptyEconomyState,
    buildEconomyContext
} from './economy-engine.js';

import {
    SHOP_TYPES,
    createShop,
    createInventoryItem,
    getShopPrice,
    getServicePrice,
    restockShop,
    buildShopContext
} from './shop-manager.js';

// Valdris Core integration
let ValdrisCore = null;
try {
    ValdrisCore = await import('../valdris-core/index.js');
} catch (e) {
    console.warn('[VEconomy] Valdris Core not available');
}

// SillyTavern references
let getContext, saveSettingsDebounced, eventSource, event_types;

try {
    const extModule = await import('../../../extensions.js');
    getContext = extModule.getContext;
    saveSettingsDebounced = extModule.saveSettingsDebounced;
} catch (e) {
    console.error('[VEconomy] Failed to import extensions.js', e);
}

try {
    const scriptModule = await import('../../../../script.js');
    eventSource = scriptModule.eventSource;
    event_types = scriptModule.event_types;
    if (!saveSettingsDebounced) saveSettingsDebounced = scriptModule.saveSettingsDebounced;
} catch (e) {
    console.error('[VEconomy] Failed to import script.js', e);
}

// State
let state = createEmptyEconomyState();

// UI State
let UI = {
    container: null,
    visible: false,
    activeTab: 'wallet'
};

// Load/Save
function loadState() {
    const context = getContext?.();
    if (!context?.chat_metadata) return;

    const saved = context.chat_metadata.valdris_economy;
    if (saved) {
        state = { ...createEmptyEconomyState(), ...saved };
    }
}

function saveState() {
    const context = getContext?.();
    if (!context?.chat_metadata) return;

    context.chat_metadata.valdris_economy = state;
    saveSettingsDebounced?.();

    if (ValdrisCore) {
        const totalCopper = toCopper(state.wallet.copper, 'copper') +
            toCopper(state.wallet.silver, 'silver') +
            toCopper(state.wallet.gold, 'gold') +
            toCopper(state.wallet.platinum, 'platinum');

        ValdrisCore.setDomainState('economy', {
            totalWealth: totalCopper,
            wealthFormatted: formatCurrency(totalCopper),
            marketCondition: state.marketCondition,
            shopCount: state.shops.length,
            debts: state.debts.length
        });
    }
}

// DOM helper
function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class') el.className = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else el.setAttribute(k, v);
    }
    for (const child of children.flat()) {
        if (child == null) continue;
        el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return el;
}

// Render wallet tab
function renderWalletTab() {
    const totalCopper = toCopper(state.wallet.copper, 'copper') +
        toCopper(state.wallet.silver, 'silver') +
        toCopper(state.wallet.gold, 'gold') +
        toCopper(state.wallet.platinum, 'platinum');

    return h('div', { class: 'ves_tab_content' },
        h('div', { class: 'ves_section' },
            h('h3', {}, 'Your Wealth'),
            h('div', { class: 'ves_total_wealth' }, formatCurrency(totalCopper)),
            h('div', { class: 'ves_currency_grid' },
                ...Object.entries(CURRENCIES).filter(([k]) => ['copper', 'silver', 'gold', 'platinum'].includes(k))
                    .map(([key, curr]) =>
                        h('div', { class: 'ves_currency_item' },
                            h('span', { class: 'ves_currency_icon' }, curr.icon),
                            h('input', {
                                type: 'number',
                                class: 'ves_currency_input',
                                value: state.wallet[key] || 0,
                                min: 0,
                                onchange: (e) => {
                                    state.wallet[key] = parseInt(e.target.value) || 0;
                                    saveState();
                                    render();
                                }
                            }),
                            h('span', { class: 'ves_currency_name' }, curr.abbr)
                        )
                    )
            )
        ),

        h('div', { class: 'ves_section' },
            h('h3', {}, 'Market Condition'),
            h('div', { class: 'ves_market_selector' },
                ...Object.entries(MARKET_CONDITIONS).map(([key, cond]) =>
                    h('button', {
                        class: `ves_market_btn ${state.marketCondition === key ? 'active' : ''}`,
                        onclick: () => {
                            state.marketCondition = key;
                            saveState();
                            render();
                        }
                    }, cond.name)
                )
            )
        ),

        state.transactions?.length > 0 ? h('div', { class: 'ves_section' },
            h('h3', {}, 'Recent Transactions'),
            h('div', { class: 'ves_transaction_list' },
                ...state.transactions.slice(0, 5).map(t =>
                    h('div', { class: `ves_transaction ${t.type}` },
                        h('span', { class: 'ves_trans_type' }, t.type === 'purchase' ? '📤' : '📥'),
                        h('span', { class: 'ves_trans_item' }, `${t.quantity}x ${t.item}`),
                        h('span', { class: 'ves_trans_price' }, formatCurrency(t.totalPrice))
                    )
                )
            )
        ) : null
    );
}

// Render shops tab
function renderShopsTab() {
    return h('div', { class: 'ves_tab_content' },
        h('div', { class: 'ves_section_header' },
            h('h3', {}, 'Known Shops'),
            h('button', {
                class: 'ves_btn ves_btn_primary',
                onclick: openAddShopModal
            }, '+ Add Shop')
        ),

        state.shops.length === 0 ?
            h('div', { class: 'ves_empty' }, 'No shops discovered yet') :
            h('div', { class: 'ves_shop_list' },
                ...state.shops.map(shop => renderShopCard(shop))
            )
    );
}

function renderShopCard(shop) {
    const type = SHOP_TYPES[shop.type];

    return h('div', { class: 'ves_shop_card' },
        h('div', { class: 'ves_shop_header' },
            h('span', { class: 'ves_shop_icon' }, type?.icon || '🏪'),
            h('div', { class: 'ves_shop_info' },
                h('span', { class: 'ves_shop_name' }, shop.name),
                h('span', { class: 'ves_shop_type' }, type?.name || shop.type)
            ),
            h('button', {
                class: 'ves_btn_icon',
                onclick: () => {
                    state.shops = state.shops.filter(s => s.id !== shop.id);
                    saveState();
                    render();
                }
            }, '×')
        ),
        shop.location ? h('div', { class: 'ves_shop_location' }, `📍 ${shop.location}`) : null,
        h('div', { class: 'ves_shop_meta' },
            shop.inventory.length > 0 ? h('span', {}, `${shop.inventory.length} items`) : null,
            shop.services?.length > 0 ? h('span', {}, `${shop.services.length} services`) : null,
            shop.reputation !== 0 ? h('span', {}, `Rep: ${shop.reputation > 0 ? '+' : ''}${shop.reputation}`) : null
        )
    );
}

// Render services tab
function renderServicesTab() {
    const serviceCategories = {};
    for (const [key, service] of Object.entries(SERVICE_TYPES)) {
        const cat = service.category;
        if (!serviceCategories[cat]) serviceCategories[cat] = [];
        serviceCategories[cat].push({ key, ...service });
    }

    return h('div', { class: 'ves_tab_content' },
        h('div', { class: 'ves_section' },
            h('h3', {}, 'Service Prices'),
            h('div', { class: 'ves_info_text' }, 'Base prices - actual cost varies by location and reputation'),
            ...Object.entries(serviceCategories).map(([cat, services]) =>
                h('div', { class: 'ves_service_category' },
                    h('h4', {}, cat.charAt(0).toUpperCase() + cat.slice(1)),
                    h('div', { class: 'ves_service_list' },
                        ...services.map(s =>
                            h('div', { class: 'ves_service_item' },
                                h('span', { class: 'ves_service_name' }, s.name),
                                h('span', { class: 'ves_service_price' }, formatCurrency(s.basePrice * 100))
                            )
                        )
                    )
                )
            )
        )
    );
}

// Modal handling
let modalEl = null;

function openModal(title, content) {
    closeModal();
    modalEl = h('div', { class: 'ves_modal_overlay', onclick: (e) => { if (e.target === modalEl) closeModal(); } },
        h('div', { class: 'ves_modal' },
            h('div', { class: 'ves_modal_header' },
                h('h3', {}, title),
                h('button', { class: 'ves_btn_icon', onclick: closeModal }, '×')
            ),
            h('div', { class: 'ves_modal_body' }, content)
        )
    );
    document.body.appendChild(modalEl);
}

function closeModal() {
    if (modalEl) { modalEl.remove(); modalEl = null; }
}

function openAddShopModal() {
    const form = createShop();

    const content = h('div', { class: 'ves_modal_form' },
        h('div', { class: 'ves_form_row' },
            h('label', {}, 'Shop Name'),
            h('input', { type: 'text', class: 'ves_input', placeholder: "The Rusty Nail", onchange: (e) => { form.name = e.target.value; } })
        ),
        h('div', { class: 'ves_form_row' },
            h('label', {}, 'Type'),
            h('select', { class: 'ves_select', onchange: (e) => { form.type = e.target.value; } },
                ...Object.entries(SHOP_TYPES).map(([key, val]) =>
                    h('option', { value: key }, `${val.icon} ${val.name}`)
                )
            )
        ),
        h('div', { class: 'ves_form_row' },
            h('label', {}, 'Location'),
            h('input', { type: 'text', class: 'ves_input', placeholder: 'e.g., Market District', onchange: (e) => { form.location = e.target.value; } })
        ),
        h('div', { class: 'ves_modal_actions' },
            h('button', { class: 'ves_btn', onclick: closeModal }, 'Cancel'),
            h('button', {
                class: 'ves_btn ves_btn_primary',
                onclick: () => {
                    if (!form.name.trim()) {
                        form.name = SHOP_TYPES[form.type]?.name || 'Shop';
                    }
                    state.shops.push(form);
                    saveState();
                    render();
                    closeModal();
                }
            }, 'Add Shop')
        )
    );

    openModal('Add Shop', content);
}

// Main render
function render() {
    if (!UI.container) return;

    const body = UI.container.querySelector('.ves_panel_body');
    if (!body) return;

    body.innerHTML = '';

    switch (UI.activeTab) {
        case 'wallet':
            body.appendChild(renderWalletTab());
            break;
        case 'shops':
            body.appendChild(renderShopsTab());
            break;
        case 'services':
            body.appendChild(renderServicesTab());
            break;
    }

    // Update tab buttons
    UI.container.querySelectorAll('.ves_tab_btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === UI.activeTab);
    });
}

// Mount UI
function mountUI() {
    UI.container = h('div', { class: 'ves_container ves_hidden' },
        h('div', { class: 'ves_panel' },
            h('div', { class: 'ves_panel_header' },
                h('h2', {}, '💰 Economy'),
                h('button', { class: 'ves_btn_icon', onclick: () => { UI.visible = false; UI.container.classList.add('ves_hidden'); } }, '×')
            ),
            h('div', { class: 'ves_tabs' },
                h('button', { class: 'ves_tab_btn active', 'data-tab': 'wallet', onclick: () => { UI.activeTab = 'wallet'; render(); } }, 'Wallet'),
                h('button', { class: 'ves_tab_btn', 'data-tab': 'shops', onclick: () => { UI.activeTab = 'shops'; render(); } }, 'Shops'),
                h('button', { class: 'ves_tab_btn', 'data-tab': 'services', onclick: () => { UI.activeTab = 'services'; render(); } }, 'Services')
            ),
            h('div', { class: 'ves_panel_body' })
        )
    );

    const launcher = h('button', {
        class: 'ves_launcher',
        onclick: () => {
            UI.visible = !UI.visible;
            UI.container.classList.toggle('ves_hidden', !UI.visible);
            if (UI.visible) render();
        }
    }, '💰');

    document.body.appendChild(UI.container);
    document.body.appendChild(launcher);

    console.log('[VEconomy] UI mounted');
}

// Events
function registerEvents() {
    if (eventSource && event_types) {
        eventSource.on(event_types.CHAT_CHANGED, () => {
            loadState();
            render();
        });
    }
}

// Core integration
function initCoreIntegration() {
    if (!ValdrisCore) return;

    ValdrisCore.registerDomain('economy', EXT_NAME);
    saveState();

    // FIXED: Changed from .subscribe() to .on()
    ValdrisCore.ValdrisEventBus.on('newDay', () => {
        const updates = updateMarketPrices(state, {});
        if (updates.length > 0) {
            console.log('[VEconomy] Market updates:', updates);
        }
        saveState();
    });

    console.log('[VEconomy] Core integration complete');
}

// Public API
window.VEconomy = {
    getState: () => state,
    getWealth: () => {
        return toCopper(state.wallet.copper, 'copper') +
            toCopper(state.wallet.silver, 'silver') +
            toCopper(state.wallet.gold, 'gold') +
            toCopper(state.wallet.platinum, 'platinum');
    },
    addGold: (amount) => {
        state.wallet.gold += amount;
        saveState();
        render();
    },
    formatCurrency,
    buildContext: () => buildEconomyContext(state),
    open: () => { UI.visible = true; UI.container?.classList.remove('ves_hidden'); render(); },
    close: () => { UI.visible = false; UI.container?.classList.add('ves_hidden'); }
};

// Initialize
(async function init() {
    console.log('[VEconomy] Loading...');

    try {
        loadState();
        mountUI();
        registerEvents();
        initCoreIntegration();
        render();

        console.log('[VEconomy] Ready!');
    } catch (e) {
        console.error('[VEconomy] Init failed:', e);
    }
})();
