/**
 * Valdris Factions & Politics (VFS)
 * Faction tracking - standings, politics, power dynamics, and conflicts
 */

const EXT_NAME = 'valdris-factions-politics';

import {
    FACTION_TYPES,
    STANDING_LEVELS,
    FACTION_RELATIONS,
    createFaction,
    getStandingLevel,
    calculateStandingChange,
    buildFactionContext,
    buildFactionsContext,
    createEmptyFactionState
} from './faction-engine.js';

// Valdris Core
let ValdrisCore = null;
try {
    ValdrisCore = await import('../valdris-core/index.js');
} catch (e) {
    console.warn('[VFactions] Valdris Core not available');
}

// SillyTavern
let getContext, saveSettingsDebounced, eventSource, event_types;

try {
    const extModule = await import('../../../extensions.js');
    getContext = extModule.getContext;
    saveSettingsDebounced = extModule.saveSettingsDebounced;
} catch (e) {
    console.error('[VFactions] Failed to import extensions.js', e);
}

try {
    const scriptModule = await import('../../../../script.js');
    eventSource = scriptModule.eventSource;
    event_types = scriptModule.event_types;
    if (!saveSettingsDebounced) saveSettingsDebounced = scriptModule.saveSettingsDebounced;
} catch (e) {
    console.error('[VFactions] Failed to import script.js', e);
}

// State
let state = createEmptyFactionState();

// UI
let UI = {
    container: null,
    visible: false,
    selectedFaction: null
};

function loadState() {
    const context = getContext?.();
    if (!context?.chat_metadata) return;
    const saved = context.chat_metadata.valdris_factions;
    if (saved) state = { ...createEmptyFactionState(), ...saved };
}

function saveState() {
    const context = getContext?.();
    if (!context?.chat_metadata) return;
    context.chat_metadata.valdris_factions = state;
    saveSettingsDebounced?.();

    if (ValdrisCore) {
        ValdrisCore.setDomainState('factions', {
            count: state.factions.length,
            allied: state.factions.filter(f => (state.standings[f.id] || 0) >= 500).length,
            hostile: state.factions.filter(f => (state.standings[f.id] || 0) <= -500).length,
            memberOf: state.memberOf.length
        });
    }
}

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

function renderFactionCard(faction) {
    const standing = state.standings[faction.id] || 0;
    const level = getStandingLevel(standing);
    const type = FACTION_TYPES[faction.type];
    const isMember = state.memberOf.includes(faction.id);

    return h('div', {
        class: 'vfs_faction_card',
        onclick: () => { UI.selectedFaction = faction.id; render(); }
    },
        h('div', { class: 'vfs_faction_header' },
            h('span', { class: 'vfs_faction_icon' }, type?.icon || ''),
            h('div', { class: 'vfs_faction_info' },
                h('span', { class: 'vfs_faction_name' }, faction.name),
                h('span', { class: 'vfs_faction_type' }, type?.name || faction.type)
            ),
            isMember ? h('span', { class: 'vfs_member_badge' }, 'Member') : null
        ),
        h('div', { class: 'vfs_standing_row' },
            h('span', { class: 'vfs_standing_label', style: { color: level.color } }, level.name),
            h('div', { class: 'vfs_standing_bar_bg' },
                h('div', {
                    class: 'vfs_standing_bar',
                    style: {
                        width: `${Math.abs(standing) / 10}%`,
                        backgroundColor: level.color,
                        marginLeft: standing < 0 ? 'auto' : '0'
                    }
                })
            ),
            h('span', { class: 'vfs_standing_value' }, standing >= 0 ? `+${standing}` : standing)
        )
    );
}

function renderFactionDetail(faction) {
    const standing = state.standings[faction.id] || 0;
    const level = getStandingLevel(standing);
    const type = FACTION_TYPES[faction.type];
    const isMember = state.memberOf.includes(faction.id);

    return h('div', { class: 'vfs_detail' },
        h('button', { class: 'vfs_back_btn', onclick: () => { UI.selectedFaction = null; render(); } }, ' Back'),
        h('div', { class: 'vfs_detail_header' },
            h('span', { class: 'vfs_detail_icon' }, type?.icon || ''),
            h('div', {},
                h('h2', {}, faction.name),
                h('span', { class: 'vfs_detail_type' }, type?.name || faction.type)
            )
        ),

        h('div', { class: 'vfs_section' },
            h('h3', {}, 'Your Standing'),
            h('div', { class: 'vfs_standing_display', style: { borderColor: level.color } },
                h('span', { class: 'vfs_standing_level', style: { color: level.color } }, level.name),
                h('span', { class: 'vfs_standing_num' }, standing >= 0 ? `+${standing}` : standing)
            ),
            h('div', { class: 'vfs_standing_adjust' },
                h('button', { class: 'vfs_btn', onclick: () => adjustStanding(faction.id, -100) }, '-100'),
                h('button', { class: 'vfs_btn', onclick: () => adjustStanding(faction.id, -10) }, '-10'),
                h('button', { class: 'vfs_btn', onclick: () => adjustStanding(faction.id, 10) }, '+10'),
                h('button', { class: 'vfs_btn', onclick: () => adjustStanding(faction.id, 100) }, '+100')
            )
        ),

        h('div', { class: 'vfs_section' },
            h('h3', {}, 'Membership'),
            isMember ?
                h('div', {},
                    h('span', { class: 'vfs_member_status' }, ' You are a member'),
                    h('button', { class: 'vfs_btn vfs_btn_danger', onclick: () => leaveFaction(faction.id) }, 'Leave Faction')
                ) :
                h('button', { class: 'vfs_btn vfs_btn_primary', onclick: () => joinFaction(faction.id) }, 'Join Faction')
        ),

        h('div', { class: 'vfs_section' },
            h('h3', {}, 'Power & Influence'),
            h('div', { class: 'vfs_power_bars' },
                renderPowerBar('Power', faction.power),
                renderPowerBar('Influence', faction.influence)
            )
        ),

        faction.headquarters ? h('div', { class: 'vfs_section' },
            h('h3', {}, 'Headquarters'),
            h('span', {}, ` ${faction.headquarters}`)
        ) : null,

        h('div', { class: 'vfs_section vfs_danger_zone' },
            h('button', {
                class: 'vfs_btn vfs_btn_danger',
                onclick: () => {
                    if (confirm(`Delete ${faction.name}?`)) {
                        state.factions = state.factions.filter(f => f.id !== faction.id);
                        delete state.standings[faction.id];
                        state.memberOf = state.memberOf.filter(id => id !== faction.id);
                        saveState();
                        UI.selectedFaction = null;
                        render();
                    }
                }
            }, 'Delete Faction')
        )
    );
}

function renderPowerBar(label, value) {
    return h('div', { class: 'vfs_power_item' },
        h('span', { class: 'vfs_power_label' }, label),
        h('div', { class: 'vfs_power_bar_bg' },
            h('div', { class: 'vfs_power_bar', style: { width: `${value}%` } })
        ),
        h('span', { class: 'vfs_power_value' }, `${value}%`)
    );
}

function adjustStanding(factionId, amount) {
    const current = state.standings[factionId] || 0;
    state.standings[factionId] = Math.max(-1000, Math.min(1000, current + amount));
    saveState();
    render();
}

function joinFaction(factionId) {
    if (!state.memberOf.includes(factionId)) {
        state.memberOf.push(factionId);
        saveState();
        render();
    }
}

function leaveFaction(factionId) {
    state.memberOf = state.memberOf.filter(id => id !== factionId);
    saveState();
    render();
}

let modalEl = null;
function openModal(title, content) {
    closeModal();
    modalEl = h('div', { class: 'vfs_modal_overlay', onclick: (e) => { if (e.target === modalEl) closeModal(); } },
        h('div', { class: 'vfs_modal' },
            h('div', { class: 'vfs_modal_header' },
                h('h3', {}, title),
                h('button', { class: 'vfs_btn_icon', onclick: closeModal }, '×')
            ),
            h('div', { class: 'vfs_modal_body' }, content)
        )
    );
    document.body.appendChild(modalEl);
}

function closeModal() {
    if (modalEl) { modalEl.remove(); modalEl = null; }
}

function openAddFactionModal() {
    const form = createFaction();

    const content = h('div', { class: 'vfs_modal_form' },
        h('div', { class: 'vfs_form_row' },
            h('label', {}, 'Faction Name'),
            h('input', { type: 'text', class: 'vfs_input', onchange: (e) => { form.name = e.target.value; } })
        ),
        h('div', { class: 'vfs_form_row' },
            h('label', {}, 'Type'),
            h('select', { class: 'vfs_select', onchange: (e) => { form.type = e.target.value; } },
                ...Object.entries(FACTION_TYPES).map(([key, val]) =>
                    h('option', { value: key }, `${val.icon} ${val.name}`)
                )
            )
        ),
        h('div', { class: 'vfs_form_row' },
            h('label', {}, 'Headquarters'),
            h('input', { type: 'text', class: 'vfs_input', placeholder: 'e.g., Castle Ironhold', onchange: (e) => { form.headquarters = e.target.value; } })
        ),
        h('div', { class: 'vfs_form_row' },
            h('label', {}, 'Initial Standing'),
            h('select', { class: 'vfs_select', onchange: (e) => { state.standings[form.id] = parseInt(e.target.value); } },
                ...Object.entries(STANDING_LEVELS).map(([key, val]) =>
                    h('option', { value: val.value, selected: key === 'neutral' }, val.name)
                )
            )
        ),
        h('div', { class: 'vfs_modal_actions' },
            h('button', { class: 'vfs_btn', onclick: closeModal }, 'Cancel'),
            h('button', {
                class: 'vfs_btn vfs_btn_primary',
                onclick: () => {
                    if (!form.name.trim()) return alert('Name required');
                    state.factions.push(form);
                    if (!state.standings[form.id]) state.standings[form.id] = 0;
                    saveState();
                    render();
                    closeModal();
                }
            }, 'Add Faction')
        )
    );

    openModal('Add Faction', content);
}

function render() {
    if (!UI.container) return;
    const body = UI.container.querySelector('.vfs_panel_body');
    if (!body) return;

    body.innerHTML = '';

    if (UI.selectedFaction) {
        const faction = state.factions.find(f => f.id === UI.selectedFaction);
        if (faction) {
            body.appendChild(renderFactionDetail(faction));
            return;
        }
    }

    // List view
    body.appendChild(h('div', { class: 'vfs_toolbar' },
        h('span', { class: 'vfs_count' }, `${state.factions.length} Factions`),
        h('button', { class: 'vfs_btn vfs_btn_primary', onclick: openAddFactionModal }, '+ Add Faction')
    ));

    if (state.factions.length === 0) {
        body.appendChild(h('div', { class: 'vfs_empty' }, 'No factions tracked yet'));
    } else {
        body.appendChild(h('div', { class: 'vfs_faction_list' },
            ...state.factions.map(f => renderFactionCard(f))
        ));
    }
}

function mountUI() {
    UI.container = h('div', { class: 'vfs_container vfs_hidden' },
        h('div', { class: 'vfs_panel' },
            h('div', { class: 'vfs_panel_header' },
                h('h2', {}, ' Factions'),
                h('button', { class: 'vfs_btn_icon', onclick: () => { UI.visible = false; UI.container.classList.add('vfs_hidden'); } }, '×')
            ),
            h('div', { class: 'vfs_panel_body' })
        )
    );

    const launcher = h('button', {
        class: 'vfs_launcher',
        onclick: () => {
            UI.visible = !UI.visible;
            UI.container.classList.toggle('vfs_hidden', !UI.visible);
            if (UI.visible) render();
        }
    }, '');

    document.body.appendChild(UI.container);
    document.body.appendChild(launcher);
}

function registerEvents() {
    if (eventSource && event_types) {
        eventSource.on(event_types.CHAT_CHANGED, () => { loadState(); render(); });
    }
}

function initCoreIntegration() {
    if (!ValdrisCore) return;
    ValdrisCore.registerDomain('factions', EXT_NAME);
    saveState();
    console.log('[VFactions] Core integration complete');
}

window.VFactions = {
    getState: () => state,
    getFaction: (id) => state.factions.find(f => f.id === id),
    getStanding: (id) => state.standings[id] || 0,
    adjustStanding,
    buildContext: () => buildFactionsContext(state),
    open: () => { UI.visible = true; UI.container?.classList.remove('vfs_hidden'); render(); },
    close: () => { UI.visible = false; UI.container?.classList.add('vfs_hidden'); }
};

(async function init() {
    console.log('[VFactions] Loading...');
    try {
        loadState();
        mountUI();
        registerEvents();
        initCoreIntegration();
        render();
        console.log('[VFactions] Ready!');
    } catch (e) {
        console.error('[VFactions] Init failed:', e);
    }
})();
