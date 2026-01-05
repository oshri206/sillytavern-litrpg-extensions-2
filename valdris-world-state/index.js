/**
 * Valdris World State (VWS)
 * World environment tracking - locations, regions, hazards, and local laws
 */

const EXT_NAME = 'valdris-world-state';

// Import modules
import {
    REGION_TYPES,
    SETTLEMENT_SIZES,
    DANGER_LEVELS,
    createEmptyLocationState,
    buildLocationContext,
    parseLocationFromResponse
} from './location-tracker.js';

import {
    HAZARD_TYPES,
    LAW_CATEGORIES,
    ZONE_EFFECTS,
    createEmptyEnvironmentState,
    buildEnvironmentContext,
    checkLegality,
    processDailyEnvironment
} from './environment-manager.js';

// Valdris Core integration
let ValdrisCore = null;
try {
    ValdrisCore = await import('../valdris-core/index.js');
} catch (e) {
    console.warn('[VWorldState] Valdris Core not available');
}

// SillyTavern references
let getContext, saveSettingsDebounced, eventSource, event_types;

try {
    const extModule = await import('../../../extensions.js');
    getContext = extModule.getContext;
    saveSettingsDebounced = extModule.saveSettingsDebounced;
} catch (e) {
    console.error('[VWorldState] Failed to import extensions.js', e);
}

try {
    const scriptModule = await import('../../../../script.js');
    eventSource = scriptModule.eventSource;
    event_types = scriptModule.event_types;
    if (!saveSettingsDebounced) saveSettingsDebounced = scriptModule.saveSettingsDebounced;
} catch (e) {
    console.error('[VWorldState] Failed to import script.js', e);
}

// State
let state = {
    location: createEmptyLocationState(),
    environment: createEmptyEnvironmentState(),
    settings: {
        autoParseLocation: true,
        showMinimap: false,
        contextEnabled: true
    }
};

// UI State
let UI = {
    container: null,
    panel: null,
    visible: false,
    activeTab: 'location'
};

// Load state from chat metadata
function loadState() {
    const context = getContext?.();
    if (!context?.chat_metadata) return;

    const saved = context.chat_metadata.valdris_world_state;
    if (saved) {
        state = {
            location: { ...createEmptyLocationState(), ...saved.location },
            environment: { ...createEmptyEnvironmentState(), ...saved.environment },
            settings: { ...state.settings, ...saved.settings }
        };
    }
}

// Save state to chat metadata
function saveState() {
    const context = getContext?.();
    if (!context?.chat_metadata) return;

    context.chat_metadata.valdris_world_state = state;
    saveSettingsDebounced?.();

    // Sync to core
    if (ValdrisCore) {
        ValdrisCore.setDomainState('world', {
            currentRegion: state.location.currentRegion,
            currentZone: state.location.currentZone,
            currentSettlement: state.location.currentSettlement,
            dangerLevel: state.environment.dangerLevel,
            hazards: state.environment.hazards,
            laws: state.environment.laws,
            activeEffects: state.environment.activeEffects
        });
    }
}

// Helper to create DOM elements
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

// Build mini status bar content
function buildStatusContent() {
    const parts = [];

    if (state.location.currentSettlement) {
        parts.push(state.location.currentSettlement.name);
    } else if (state.location.currentZone) {
        parts.push(state.location.currentZone);
    } else if (state.location.currentRegion) {
        parts.push(state.location.currentRegion);
    } else {
        parts.push('Unknown Location');
    }

    const dangerLevel = DANGER_LEVELS[state.environment.dangerLevel];
    if (dangerLevel && state.environment.dangerLevel !== 'safe') {
        parts.push(`[${dangerLevel.name}]`);
    }

    if (state.environment.hazards?.length > 0) {
        parts.push(`(${state.environment.hazards.length} hazard${state.environment.hazards.length > 1 ? 's' : ''})`);
    }

    return parts.join(' ');
}

// Render location tab
function renderLocationTab() {
    const container = h('div', { class: 'vws_tab_content' });

    // Current location section
    const currentSection = h('div', { class: 'vws_section' },
        h('h3', { class: 'vws_section_title' }, 'Current Location'),
        h('div', { class: 'vws_location_form' },
            h('div', { class: 'vws_form_row' },
                h('label', {}, 'Region'),
                h('input', {
                    type: 'text',
                    class: 'vws_input',
                    value: state.location.currentRegion || '',
                    placeholder: 'e.g., Thornwood Forest',
                    onchange: (e) => {
                        state.location.currentRegion = e.target.value;
                        saveState();
                        render();
                    }
                })
            ),
            h('div', { class: 'vws_form_row' },
                h('label', {}, 'Zone/Area'),
                h('input', {
                    type: 'text',
                    class: 'vws_input',
                    value: state.location.currentZone || '',
                    placeholder: 'e.g., Northern Ruins',
                    onchange: (e) => {
                        state.location.currentZone = e.target.value;
                        saveState();
                        render();
                    }
                })
            ),
            h('div', { class: 'vws_form_row' },
                h('label', {}, 'Region Type'),
                h('select', {
                    class: 'vws_select',
                    value: state.location.regionType || 'plains',
                    onchange: (e) => {
                        state.location.regionType = e.target.value;
                        saveState();
                        render();
                    }
                },
                    ...Object.entries(REGION_TYPES).map(([key, val]) =>
                        h('option', { value: key, selected: state.location.regionType === key }, val.name)
                    )
                )
            )
        )
    );

    // Settlement section
    const settlement = state.location.currentSettlement;
    const settlementSection = h('div', { class: 'vws_section' },
        h('h3', { class: 'vws_section_title' }, 'Settlement'),
        settlement ?
            h('div', { class: 'vws_settlement_card' },
                h('div', { class: 'vws_settlement_header' },
                    h('span', { class: 'vws_settlement_name' }, settlement.name),
                    h('span', { class: 'vws_settlement_size' }, SETTLEMENT_SIZES[settlement.size]?.name || settlement.size)
                ),
                settlement.faction ? h('div', { class: 'vws_settlement_faction' }, `Controlled by: ${settlement.faction}`) : null,
                h('button', {
                    class: 'vws_btn vws_btn_danger',
                    onclick: () => {
                        state.location.currentSettlement = null;
                        saveState();
                        render();
                    }
                }, 'Leave Settlement')
            ) :
            h('div', { class: 'vws_no_settlement' },
                h('span', {}, 'Not in a settlement'),
                h('button', {
                    class: 'vws_btn vws_btn_primary',
                    onclick: () => openSettlementModal()
                }, 'Enter Settlement')
            )
    );

    // Points of Interest
    const poiSection = h('div', { class: 'vws_section' },
        h('div', { class: 'vws_section_header' },
            h('h3', { class: 'vws_section_title' }, 'Points of Interest'),
            h('button', {
                class: 'vws_btn vws_btn_small',
                onclick: () => openPOIModal()
            }, '+')
        ),
        state.location.pointsOfInterest?.length > 0 ?
            h('div', { class: 'vws_poi_list' },
                ...state.location.pointsOfInterest.map((poi, i) =>
                    h('div', { class: 'vws_poi_item' },
                        h('span', { class: 'vws_poi_name' }, poi.name),
                        h('span', { class: 'vws_poi_type' }, poi.type),
                        h('button', {
                            class: 'vws_btn_icon',
                            onclick: () => {
                                state.location.pointsOfInterest.splice(i, 1);
                                saveState();
                                render();
                            }
                        }, '×')
                    )
                )
            ) :
            h('div', { class: 'vws_empty' }, 'No points of interest discovered')
    );

    container.appendChild(currentSection);
    container.appendChild(settlementSection);
    container.appendChild(poiSection);

    return container;
}

// Render environment tab
function renderEnvironmentTab() {
    const container = h('div', { class: 'vws_tab_content' });

    // Danger level
    const dangerSection = h('div', { class: 'vws_section' },
        h('h3', { class: 'vws_section_title' }, 'Danger Level'),
        h('div', { class: 'vws_danger_selector' },
            ...Object.entries(DANGER_LEVELS).map(([key, val]) =>
                h('button', {
                    class: `vws_danger_btn ${state.environment.dangerLevel === key ? 'active' : ''}`,
                    style: { borderColor: val.color, color: state.environment.dangerLevel === key ? '#fff' : val.color, backgroundColor: state.environment.dangerLevel === key ? val.color : 'transparent' },
                    onclick: () => {
                        state.environment.dangerLevel = key;
                        saveState();
                        render();
                    }
                }, val.name)
            )
        )
    );

    // Active hazards
    const hazardSection = h('div', { class: 'vws_section' },
        h('div', { class: 'vws_section_header' },
            h('h3', { class: 'vws_section_title' }, 'Active Hazards'),
            h('button', {
                class: 'vws_btn vws_btn_small',
                onclick: () => openHazardModal()
            }, '+ Add Hazard')
        ),
        state.environment.hazards?.length > 0 ?
            h('div', { class: 'vws_hazard_list' },
                ...state.environment.hazards.map((hazard, i) => {
                    const hazardInfo = Object.values(HAZARD_TYPES)
                        .flatMap(cat => Object.entries(cat))
                        .find(([key]) => key === hazard.type)?.[1];

                    return h('div', { class: `vws_hazard_card vws_severity_${hazardInfo?.severity || 'moderate'}` },
                        h('div', { class: 'vws_hazard_header' },
                            h('span', { class: 'vws_hazard_name' }, hazardInfo?.name || hazard.type),
                            h('button', {
                                class: 'vws_btn_icon',
                                onclick: () => {
                                    state.environment.hazards.splice(i, 1);
                                    saveState();
                                    render();
                                }
                            }, '×')
                        ),
                        hazard.duration !== 'permanent' ?
                            h('div', { class: 'vws_hazard_duration' }, `${hazard.daysRemaining || 1} day(s) remaining`) : null
                    );
                })
            ) :
            h('div', { class: 'vws_empty' }, 'No active hazards')
    );

    // Zone effects
    const effectSection = h('div', { class: 'vws_section' },
        h('div', { class: 'vws_section_header' },
            h('h3', { class: 'vws_section_title' }, 'Zone Effects'),
            h('button', {
                class: 'vws_btn vws_btn_small',
                onclick: () => openEffectModal()
            }, '+ Add Effect')
        ),
        state.environment.activeEffects?.length > 0 ?
            h('div', { class: 'vws_effect_list' },
                ...state.environment.activeEffects.map((effect, i) => {
                    const effectInfo = ZONE_EFFECTS[effect.type];
                    return h('div', { class: 'vws_effect_item' },
                        h('span', { class: 'vws_effect_name' }, effectInfo?.name || effect.type),
                        h('span', { class: 'vws_effect_desc' }, effectInfo?.description || ''),
                        h('button', {
                            class: 'vws_btn_icon',
                            onclick: () => {
                                state.environment.activeEffects.splice(i, 1);
                                saveState();
                                render();
                            }
                        }, '×')
                    );
                })
            ) :
            h('div', { class: 'vws_empty' }, 'No zone effects active')
    );

    container.appendChild(dangerSection);
    container.appendChild(hazardSection);
    container.appendChild(effectSection);

    return container;
}

// Render laws tab
function renderLawsTab() {
    const container = h('div', { class: 'vws_tab_content' });

    // Faction control
    const factionSection = h('div', { class: 'vws_section' },
        h('h3', { class: 'vws_section_title' }, 'Faction Control'),
        h('div', { class: 'vws_form_row' },
            h('label', {}, 'Controlling Faction'),
            h('input', {
                type: 'text',
                class: 'vws_input',
                value: state.environment.controllingFaction || '',
                placeholder: 'e.g., Kingdom of Valdris',
                onchange: (e) => {
                    state.environment.controllingFaction = e.target.value;
                    saveState();
                    render();
                }
            })
        ),
        h('div', { class: 'vws_form_row' },
            h('label', {}, 'Your Relation'),
            h('select', {
                class: 'vws_select',
                onchange: (e) => {
                    state.environment.factionRelation = e.target.value;
                    saveState();
                    render();
                }
            },
                ...[
                    { value: 'hostile', label: 'Hostile' },
                    { value: 'unfriendly', label: 'Unfriendly' },
                    { value: 'neutral', label: 'Neutral' },
                    { value: 'friendly', label: 'Friendly' },
                    { value: 'allied', label: 'Allied' }
                ].map(opt =>
                    h('option', { value: opt.value, selected: state.environment.factionRelation === opt.value }, opt.label)
                )
            )
        )
    );

    // Laws
    const lawsSection = h('div', { class: 'vws_section' },
        h('h3', { class: 'vws_section_title' }, 'Local Laws'),
        ...Object.entries(LAW_CATEGORIES).map(([catKey, category]) =>
            h('div', { class: 'vws_law_category' },
                h('label', { class: 'vws_law_label' }, category.name),
                h('select', {
                    class: 'vws_select',
                    onchange: (e) => {
                        state.environment.laws[catKey] = e.target.value;
                        saveState();
                        render();
                    }
                },
                    ...Object.entries(category.laws).map(([lawKey, law]) =>
                        h('option', {
                            value: lawKey,
                            selected: state.environment.laws[catKey] === lawKey
                        }, law.name)
                    )
                )
            )
        )
    );

    container.appendChild(factionSection);
    container.appendChild(lawsSection);

    return container;
}

// Modal helpers
let modalEl = null;

function openModal(title, content) {
    closeModal();

    modalEl = h('div', { class: 'vws_modal_overlay', onclick: (e) => { if (e.target === modalEl) closeModal(); } },
        h('div', { class: 'vws_modal' },
            h('div', { class: 'vws_modal_header' },
                h('h3', {}, title),
                h('button', { class: 'vws_btn_icon', onclick: closeModal }, '×')
            ),
            h('div', { class: 'vws_modal_body' }, content)
        )
    );

    document.body.appendChild(modalEl);
}

function closeModal() {
    if (modalEl) {
        modalEl.remove();
        modalEl = null;
    }
}

function openSettlementModal() {
    const formState = { name: '', size: 'town', faction: '' };

    const content = h('div', { class: 'vws_modal_form' },
        h('div', { class: 'vws_form_row' },
            h('label', {}, 'Settlement Name'),
            h('input', {
                type: 'text',
                class: 'vws_input',
                placeholder: 'e.g., Ironhold',
                onchange: (e) => { formState.name = e.target.value; }
            })
        ),
        h('div', { class: 'vws_form_row' },
            h('label', {}, 'Size'),
            h('select', {
                class: 'vws_select',
                onchange: (e) => { formState.size = e.target.value; }
            },
                ...Object.entries(SETTLEMENT_SIZES).map(([key, val]) =>
                    h('option', { value: key }, val.name)
                )
            )
        ),
        h('div', { class: 'vws_form_row' },
            h('label', {}, 'Controlling Faction (optional)'),
            h('input', {
                type: 'text',
                class: 'vws_input',
                placeholder: 'e.g., Merchant Guild',
                onchange: (e) => { formState.faction = e.target.value; }
            })
        ),
        h('div', { class: 'vws_modal_actions' },
            h('button', { class: 'vws_btn', onclick: closeModal }, 'Cancel'),
            h('button', {
                class: 'vws_btn vws_btn_primary',
                onclick: () => {
                    if (formState.name.trim()) {
                        state.location.currentSettlement = {
                            name: formState.name.trim(),
                            size: formState.size,
                            faction: formState.faction.trim() || null
                        };
                        saveState();
                        render();
                        closeModal();
                    }
                }
            }, 'Enter Settlement')
        )
    );

    openModal('Enter Settlement', content);
}

function openHazardModal() {
    const content = h('div', { class: 'vws_hazard_picker' },
        ...Object.entries(HAZARD_TYPES).map(([catKey, category]) =>
            h('div', { class: 'vws_hazard_category' },
                h('h4', {}, catKey.charAt(0).toUpperCase() + catKey.slice(1)),
                ...Object.entries(category).map(([hazKey, hazard]) =>
                    h('button', {
                        class: `vws_hazard_pick_btn vws_severity_${hazard.severity}`,
                        onclick: () => {
                            state.environment.hazards = state.environment.hazards || [];
                            state.environment.hazards.push({
                                type: hazKey,
                                duration: 'temporary',
                                daysRemaining: 3
                            });
                            saveState();
                            render();
                            closeModal();
                        }
                    }, hazard.name)
                )
            )
        )
    );

    openModal('Add Hazard', content);
}

function openEffectModal() {
    const content = h('div', { class: 'vws_effect_picker' },
        ...Object.entries(ZONE_EFFECTS).map(([key, effect]) =>
            h('button', {
                class: 'vws_effect_pick_btn',
                onclick: () => {
                    state.environment.activeEffects = state.environment.activeEffects || [];
                    if (!state.environment.activeEffects.some(e => e.type === key)) {
                        state.environment.activeEffects.push({ type: key });
                        saveState();
                        render();
                    }
                    closeModal();
                }
            },
                h('span', { class: 'vws_effect_pick_name' }, effect.name),
                h('span', { class: 'vws_effect_pick_desc' }, effect.description)
            )
        )
    );

    openModal('Add Zone Effect', content);
}

function openPOIModal() {
    const formState = { name: '', type: 'dungeon' };
    const poiTypes = ['dungeon', 'shrine', 'camp', 'ruins', 'cave', 'tower', 'village', 'landmark', 'resource', 'danger'];

    const content = h('div', { class: 'vws_modal_form' },
        h('div', { class: 'vws_form_row' },
            h('label', {}, 'Name'),
            h('input', {
                type: 'text',
                class: 'vws_input',
                placeholder: 'e.g., Forgotten Crypt',
                onchange: (e) => { formState.name = e.target.value; }
            })
        ),
        h('div', { class: 'vws_form_row' },
            h('label', {}, 'Type'),
            h('select', {
                class: 'vws_select',
                onchange: (e) => { formState.type = e.target.value; }
            },
                ...poiTypes.map(t =>
                    h('option', { value: t }, t.charAt(0).toUpperCase() + t.slice(1))
                )
            )
        ),
        h('div', { class: 'vws_modal_actions' },
            h('button', { class: 'vws_btn', onclick: closeModal }, 'Cancel'),
            h('button', {
                class: 'vws_btn vws_btn_primary',
                onclick: () => {
                    if (formState.name.trim()) {
                        state.location.pointsOfInterest = state.location.pointsOfInterest || [];
                        state.location.pointsOfInterest.push({
                            name: formState.name.trim(),
                            type: formState.type
                        });
                        saveState();
                        render();
                        closeModal();
                    }
                }
            }, 'Add POI')
        )
    );

    openModal('Add Point of Interest', content);
}

// Main render
function render() {
    if (!UI.container) return;

    // Update status bar
    const statusText = UI.container.querySelector('.vws_status_text');
    if (statusText) {
        statusText.textContent = buildStatusContent();
    }

    // Render panel content if visible
    if (UI.visible && UI.panel) {
        const body = UI.panel.querySelector('.vws_panel_body');
        if (body) {
            body.innerHTML = '';
            switch (UI.activeTab) {
                case 'location':
                    body.appendChild(renderLocationTab());
                    break;
                case 'environment':
                    body.appendChild(renderEnvironmentTab());
                    break;
                case 'laws':
                    body.appendChild(renderLawsTab());
                    break;
            }
        }

        // Update tab buttons
        UI.panel.querySelectorAll('.vws_tab_btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === UI.activeTab);
        });
    }
}

// Mount UI
function mountUI() {
    // Create status bar
    UI.container = h('div', { class: 'vws_container' },
        h('div', {
            class: 'vws_status_bar',
            onclick: () => {
                UI.visible = !UI.visible;
                if (UI.visible) {
                    showPanel();
                } else {
                    hidePanel();
                }
            }
        },
            h('span', { class: 'vws_icon' }, ''),
            h('span', { class: 'vws_status_text' }, buildStatusContent())
        )
    );

    // Insert after chat
    const sheld = document.getElementById('sheld');
    if (sheld) {
        sheld.parentNode.insertBefore(UI.container, sheld.nextSibling);
    } else {
        document.body.appendChild(UI.container);
    }

    console.log('[VWorldState] UI mounted');
}

function showPanel() {
    if (UI.panel) {
        UI.panel.classList.remove('vws_hidden');
        return;
    }

    UI.panel = h('div', { class: 'vws_panel' },
        h('div', { class: 'vws_panel_header' },
            h('h2', {}, 'World State'),
            h('button', {
                class: 'vws_btn_icon',
                onclick: () => {
                    UI.visible = false;
                    hidePanel();
                }
            }, '×')
        ),
        h('div', { class: 'vws_tabs' },
            h('button', { class: 'vws_tab_btn active', 'data-tab': 'location', onclick: () => { UI.activeTab = 'location'; render(); } }, 'Location'),
            h('button', { class: 'vws_tab_btn', 'data-tab': 'environment', onclick: () => { UI.activeTab = 'environment'; render(); } }, 'Environment'),
            h('button', { class: 'vws_tab_btn', 'data-tab': 'laws', onclick: () => { UI.activeTab = 'laws'; render(); } }, 'Laws')
        ),
        h('div', { class: 'vws_panel_body' })
    );

    UI.container.appendChild(UI.panel);
    render();
}

function hidePanel() {
    if (UI.panel) {
        UI.panel.classList.add('vws_hidden');
    }
}

// Register events
function registerEvents() {
    if (eventSource && event_types) {
        eventSource.on(event_types.CHAT_CHANGED, () => {
            loadState();
            render();
        });

        // Parse AI responses for location changes
        eventSource.on(event_types.MESSAGE_RECEIVED, (messageId) => {
            if (!state.settings.autoParseLocation) return;

            const context = getContext?.();
            if (!context?.chat) return;

            const msg = context.chat.find(m => m.mesId === messageId || m.mes_id === messageId);
            if (!msg || msg.is_user) return;

            const detected = parseLocationFromResponse(msg.mes || '');

            // Could auto-update location based on detected arrivals
            if (detected.arrivals.length > 0) {
                console.log('[VWorldState] Detected arrivals:', detected.arrivals);
            }
        });
    }
}

// Initialize core integration
function initCoreIntegration() {
    if (!ValdrisCore) {
        console.log('[VWorldState] Running standalone');
        return;
    }

    // Register world domain
    ValdrisCore.registerDomain('world', EXT_NAME);

    // Initial sync
    saveState();

    // Subscribe to new day events
    ValdrisCore.ValdrisEventBus.subscribe('newDay', (data) => {
        console.log('[VWorldState] New day:', data);

        // Process daily environment changes
        const result = processDailyEnvironment(state.environment, data);
        state.environment.hazards = result.updatedHazards;

        if (result.changes.length > 0) {
            console.log('[VWorldState] Daily changes:', result.changes);
        }

        saveState();
        render();
    });

    console.log('[VWorldState] Core integration complete');
}

// Build context for AI
export function buildWorldContext() {
    const locationCtx = buildLocationContext(state.location, state.environment);
    const envCtx = buildEnvironmentContext(state.environment);

    return [locationCtx, envCtx].filter(Boolean).join('\n');
}

// Public API
window.VWorldState = {
    getState: () => state,
    setState: (newState) => { state = newState; saveState(); render(); },
    buildContext: buildWorldContext,
    checkLegality: (action) => checkLegality(action, state.environment)
};

// Initialize
(async function init() {
    console.log('[VWorldState] Loading...');

    try {
        loadState();
        mountUI();
        registerEvents();
        initCoreIntegration();
        render();

        console.log('[VWorldState] Ready!');
    } catch (e) {
        console.error('[VWorldState] Init failed:', e);
    }
})();
