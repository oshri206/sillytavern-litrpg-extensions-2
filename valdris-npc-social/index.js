/**
 * Valdris NPC Social (VNS)
 * NPC tracking with relationships, dispositions, and social networks
 */

const EXT_NAME = 'valdris-npc-social';

// Imports
import {
    RELATIONSHIP_LEVELS,
    DISPOSITION_TYPES,
    NPC_ROLES,
    createNPC,
    getRelationshipLevel,
    getEffectiveDisposition,
    willNPCHelp,
    recordInteraction,
    buildNPCContext,
    buildNPCsContext
} from './npc-manager.js';

import {
    RELATIONSHIP_EVENTS,
    applyRelationshipEvent,
    processDailyDecay,
    analyzeNetwork,
    getAffectedNPCs,
    generateRelationshipSummary
} from './relationship-tracker.js';

// Valdris Core integration
let ValdrisCore = null;
try {
    ValdrisCore = await import('../valdris-core/index.js');
} catch (e) {
    console.warn('[VNPCSocial] Valdris Core not available');
}

// SillyTavern references
let getContext, saveSettingsDebounced, eventSource, event_types;

try {
    const extModule = await import('../../../extensions.js');
    getContext = extModule.getContext;
    saveSettingsDebounced = extModule.saveSettingsDebounced;
} catch (e) {
    console.error('[VNPCSocial] Failed to import extensions.js', e);
}

try {
    const scriptModule = await import('../../../../script.js');
    eventSource = scriptModule.eventSource;
    event_types = scriptModule.event_types;
    if (!saveSettingsDebounced) saveSettingsDebounced = scriptModule.saveSettingsDebounced;
} catch (e) {
    console.error('[VNPCSocial] Failed to import script.js', e);
}

// State
let state = {
    npcs: [],
    settings: {
        autoTrack: true,
        decayEnabled: true,
        contextEnabled: true,
        maxContextNPCs: 5
    }
};

// UI State
let UI = {
    container: null,
    visible: false,
    activeView: 'list',
    selectedNPC: null,
    filter: 'all',
    searchQuery: ''
};

// Load/Save state
function loadState() {
    const context = getContext?.();
    if (!context?.chat_metadata) return;

    const saved = context.chat_metadata.valdris_npc_social;
    if (saved) {
        state = {
            npcs: (saved.npcs || []).map(n => ({ ...createNPC(), ...n })),
            settings: { ...state.settings, ...saved.settings }
        };
    }
}

function saveState() {
    const context = getContext?.();
    if (!context?.chat_metadata) return;

    context.chat_metadata.valdris_npc_social = state;
    saveSettingsDebounced?.();

    // Sync to core
    if (ValdrisCore) {
        ValdrisCore.setDomainState('npcs', {
            count: state.npcs.length,
            allies: state.npcs.filter(n => n.relationship >= 50 && n.alive).length,
            enemies: state.npcs.filter(n => n.relationship <= -50 && n.alive).length,
            recent: state.npcs
                .filter(n => n.alive)
                .sort((a, b) => (b.lastInteraction || '') - (a.lastInteraction || ''))
                .slice(0, 5)
                .map(n => ({ id: n.id, name: n.name, relationship: n.relationship }))
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

// Get filtered NPCs
function getFilteredNPCs() {
    let npcs = [...state.npcs];

    // Filter
    switch (UI.filter) {
        case 'allies':
            npcs = npcs.filter(n => n.relationship >= 50 && n.alive);
            break;
        case 'enemies':
            npcs = npcs.filter(n => n.relationship <= -50 && n.alive);
            break;
        case 'neutral':
            npcs = npcs.filter(n => Math.abs(n.relationship) < 50 && n.alive);
            break;
        case 'dead':
            npcs = npcs.filter(n => !n.alive);
            break;
    }

    // Search
    if (UI.searchQuery) {
        const query = UI.searchQuery.toLowerCase();
        npcs = npcs.filter(n =>
            n.name.toLowerCase().includes(query) ||
            n.location?.toLowerCase().includes(query) ||
            n.faction?.toLowerCase().includes(query)
        );
    }

    // Sort by relationship strength
    npcs.sort((a, b) => Math.abs(b.relationship) - Math.abs(a.relationship));

    return npcs;
}

// Render NPC list
function renderNPCList() {
    const npcs = getFilteredNPCs();

    return h('div', { class: 'vns_npc_list' },
        npcs.length === 0 ?
            h('div', { class: 'vns_empty' }, 'No NPCs match the current filter') :
            ...npcs.map(npc => renderNPCCard(npc))
    );
}

// Render NPC card
function renderNPCCard(npc) {
    const relLevel = getRelationshipLevel(npc.relationship);

    return h('div', {
        class: `vns_npc_card ${!npc.alive ? 'vns_dead' : ''}`,
        onclick: () => {
            UI.selectedNPC = npc.id;
            UI.activeView = 'detail';
            render();
        }
    },
        h('div', { class: 'vns_npc_header' },
            h('div', { class: 'vns_npc_name' },
                h('span', {}, npc.name),
                npc.title ? h('span', { class: 'vns_npc_title' }, npc.title) : null
            ),
            h('span', {
                class: 'vns_npc_relation_badge',
                style: { backgroundColor: relLevel.color }
            }, relLevel.name)
        ),
        h('div', { class: 'vns_npc_info' },
            h('span', { class: 'vns_npc_role' }, NPC_ROLES[npc.role]?.name || npc.role),
            npc.location ? h('span', { class: 'vns_npc_location' }, ` ${npc.location}`) : null
        ),
        h('div', { class: 'vns_relation_bar_container' },
            h('div', {
                class: 'vns_relation_bar',
                style: {
                    width: `${Math.abs(npc.relationship)}%`,
                    backgroundColor: relLevel.color,
                    marginLeft: npc.relationship < 0 ? `${100 - Math.abs(npc.relationship)}%` : '0'
                }
            })
        )
    );
}

// Render NPC detail view
function renderNPCDetail(npc) {
    const relLevel = getRelationshipLevel(npc.relationship);

    return h('div', { class: 'vns_detail_view' },
        // Header with back button
        h('div', { class: 'vns_detail_header' },
            h('button', {
                class: 'vns_btn_back',
                onclick: () => { UI.activeView = 'list'; render(); }
            }, ' Back'),
            h('div', { class: 'vns_detail_actions' },
                h('button', {
                    class: 'vns_btn vns_btn_small',
                    onclick: () => openEditModal(npc)
                }, 'Edit'),
                h('button', {
                    class: 'vns_btn vns_btn_small vns_btn_danger',
                    onclick: () => {
                        if (confirm(`Delete ${npc.name}?`)) {
                            state.npcs = state.npcs.filter(n => n.id !== npc.id);
                            saveState();
                            UI.activeView = 'list';
                            render();
                        }
                    }
                }, 'Delete')
            )
        ),

        // NPC Info
        h('div', { class: 'vns_detail_main' },
            h('div', { class: 'vns_detail_name_row' },
                h('h2', {}, npc.name),
                !npc.alive ? h('span', { class: 'vns_deceased_badge' }, 'Deceased') : null
            ),
            npc.title ? h('div', { class: 'vns_detail_title' }, npc.title) : null,

            // Stats grid
            h('div', { class: 'vns_stats_grid' },
                renderStatBlock('Relationship', npc.relationship, relLevel.color, -100, 100),
                renderStatBlock('Trust', npc.trust, npc.trust >= 0 ? '#4CAF50' : '#F44336', -100, 100),
                renderStatBlock('Fear', npc.fear, '#FF9800', 0, 100),
                renderStatBlock('Respect', npc.respect, '#9C27B0', 0, 100)
            ),

            // Quick info
            h('div', { class: 'vns_detail_info' },
                h('div', { class: 'vns_info_row' },
                    h('span', { class: 'vns_info_label' }, 'Role:'),
                    h('span', {}, NPC_ROLES[npc.role]?.name || npc.role)
                ),
                npc.race ? h('div', { class: 'vns_info_row' },
                    h('span', { class: 'vns_info_label' }, 'Race:'),
                    h('span', {}, npc.race)
                ) : null,
                npc.location ? h('div', { class: 'vns_info_row' },
                    h('span', { class: 'vns_info_label' }, 'Location:'),
                    h('span', {}, npc.location)
                ) : null,
                npc.faction ? h('div', { class: 'vns_info_row' },
                    h('span', { class: 'vns_info_label' }, 'Faction:'),
                    h('span', {}, npc.faction)
                ) : null
            ),

            // Apply relationship event
            h('div', { class: 'vns_section' },
                h('h3', {}, 'Record Interaction'),
                h('div', { class: 'vns_event_buttons' },
                    ...['helped', 'gift_small', 'completed_quest', 'impressed'].map(evt =>
                        h('button', {
                            class: 'vns_btn vns_btn_positive',
                            onclick: () => {
                                applyRelationshipEvent(npc, evt);
                                saveState();
                                render();
                            }
                        }, RELATIONSHIP_EVENTS[evt].description)
                    ),
                    ...['insulted', 'lied', 'threatened', 'attacked'].map(evt =>
                        h('button', {
                            class: 'vns_btn vns_btn_negative',
                            onclick: () => {
                                applyRelationshipEvent(npc, evt);
                                saveState();
                                render();
                            }
                        }, RELATIONSHIP_EVENTS[evt].description)
                    )
                )
            ),

            // Notes
            h('div', { class: 'vns_section' },
                h('h3', {}, 'Notes'),
                h('textarea', {
                    class: 'vns_notes_area',
                    value: npc.notes || '',
                    placeholder: 'Add notes about this NPC...',
                    onchange: (e) => {
                        npc.notes = e.target.value;
                        saveState();
                    }
                })
            ),

            // Interaction history
            npc.interactions?.length > 0 ? h('div', { class: 'vns_section' },
                h('h3', {}, 'Recent Interactions'),
                h('div', { class: 'vns_history_list' },
                    ...npc.interactions.slice(0, 5).map(int =>
                        h('div', { class: 'vns_history_item' },
                            h('span', { class: 'vns_history_type' }, int.type),
                            h('span', { class: 'vns_history_outcome' }, int.outcome),
                            int.relationshipChange ? h('span', {
                                class: `vns_history_change ${int.relationshipChange > 0 ? 'positive' : 'negative'}`
                            }, `${int.relationshipChange > 0 ? '+' : ''}${int.relationshipChange}`) : null
                        )
                    )
                )
            ) : null
        )
    );
}

// Render stat block
function renderStatBlock(label, value, color, min, max) {
    const normalized = ((value - min) / (max - min)) * 100;

    return h('div', { class: 'vns_stat_block' },
        h('div', { class: 'vns_stat_header' },
            h('span', { class: 'vns_stat_label' }, label),
            h('span', { class: 'vns_stat_value' }, value > 0 ? `+${value}` : value)
        ),
        h('div', { class: 'vns_stat_bar_bg' },
            h('div', {
                class: 'vns_stat_bar',
                style: {
                    width: `${normalized}%`,
                    backgroundColor: color
                }
            })
        )
    );
}

// Modal handling
let modalEl = null;

function openModal(title, content) {
    closeModal();
    modalEl = h('div', { class: 'vns_modal_overlay', onclick: (e) => { if (e.target === modalEl) closeModal(); } },
        h('div', { class: 'vns_modal' },
            h('div', { class: 'vns_modal_header' },
                h('h3', {}, title),
                h('button', { class: 'vns_btn_icon', onclick: closeModal }, '×')
            ),
            h('div', { class: 'vns_modal_body' }, content)
        )
    );
    document.body.appendChild(modalEl);
}

function closeModal() {
    if (modalEl) { modalEl.remove(); modalEl = null; }
}

function openEditModal(npc) {
    const form = { ...npc };

    const content = h('div', { class: 'vns_modal_form' },
        h('div', { class: 'vns_form_row' },
            h('label', {}, 'Name'),
            h('input', { type: 'text', class: 'vns_input', value: form.name, onchange: (e) => { form.name = e.target.value; } })
        ),
        h('div', { class: 'vns_form_row' },
            h('label', {}, 'Title'),
            h('input', { type: 'text', class: 'vns_input', value: form.title || '', placeholder: 'e.g., Captain of the Guard', onchange: (e) => { form.title = e.target.value; } })
        ),
        h('div', { class: 'vns_form_row' },
            h('label', {}, 'Role'),
            h('select', { class: 'vns_select', onchange: (e) => { form.role = e.target.value; } },
                ...Object.entries(NPC_ROLES).map(([key, val]) =>
                    h('option', { value: key, selected: form.role === key }, val.name)
                )
            )
        ),
        h('div', { class: 'vns_form_row_double' },
            h('div', { class: 'vns_form_row' },
                h('label', {}, 'Race'),
                h('input', { type: 'text', class: 'vns_input', value: form.race || '', onchange: (e) => { form.race = e.target.value; } })
            ),
            h('div', { class: 'vns_form_row' },
                h('label', {}, 'Gender'),
                h('input', { type: 'text', class: 'vns_input', value: form.gender || '', onchange: (e) => { form.gender = e.target.value; } })
            )
        ),
        h('div', { class: 'vns_form_row' },
            h('label', {}, 'Location'),
            h('input', { type: 'text', class: 'vns_input', value: form.location || '', onchange: (e) => { form.location = e.target.value; } })
        ),
        h('div', { class: 'vns_form_row' },
            h('label', {}, 'Faction'),
            h('input', { type: 'text', class: 'vns_input', value: form.faction || '', onchange: (e) => { form.faction = e.target.value; } })
        ),
        h('div', { class: 'vns_form_row' },
            h('label', {}, 'Relationship (-100 to 100)'),
            h('input', { type: 'number', class: 'vns_input', value: form.relationship, min: -100, max: 100, onchange: (e) => { form.relationship = parseInt(e.target.value) || 0; } })
        ),
        h('div', { class: 'vns_form_row' },
            h('label', {}, ''),
            h('label', { class: 'vns_checkbox_label' },
                h('input', { type: 'checkbox', checked: form.alive, onchange: (e) => { form.alive = e.target.checked; } }),
                ' Alive'
            )
        ),
        h('div', { class: 'vns_modal_actions' },
            h('button', { class: 'vns_btn', onclick: closeModal }, 'Cancel'),
            h('button', {
                class: 'vns_btn vns_btn_primary',
                onclick: () => {
                    Object.assign(npc, form);
                    saveState();
                    render();
                    closeModal();
                }
            }, 'Save')
        )
    );

    openModal('Edit NPC', content);
}

function openAddModal() {
    const form = createNPC();

    const content = h('div', { class: 'vns_modal_form' },
        h('div', { class: 'vns_form_row' },
            h('label', {}, 'Name *'),
            h('input', { type: 'text', class: 'vns_input', placeholder: 'NPC Name', onchange: (e) => { form.name = e.target.value; } })
        ),
        h('div', { class: 'vns_form_row' },
            h('label', {}, 'Title'),
            h('input', { type: 'text', class: 'vns_input', placeholder: 'e.g., Innkeeper', onchange: (e) => { form.title = e.target.value; } })
        ),
        h('div', { class: 'vns_form_row' },
            h('label', {}, 'Role'),
            h('select', { class: 'vns_select', onchange: (e) => { form.role = e.target.value; } },
                ...Object.entries(NPC_ROLES).map(([key, val]) =>
                    h('option', { value: key }, val.name)
                )
            )
        ),
        h('div', { class: 'vns_form_row' },
            h('label', {}, 'Location'),
            h('input', { type: 'text', class: 'vns_input', placeholder: 'Current location', onchange: (e) => { form.location = e.target.value; } })
        ),
        h('div', { class: 'vns_form_row' },
            h('label', {}, 'Initial Relationship'),
            h('select', { class: 'vns_select', onchange: (e) => { form.relationship = parseInt(e.target.value); } },
                ...Object.entries(RELATIONSHIP_LEVELS).map(([key, val]) =>
                    h('option', { value: val.value, selected: key === 'neutral' }, val.name)
                )
            )
        ),
        h('div', { class: 'vns_modal_actions' },
            h('button', { class: 'vns_btn', onclick: closeModal }, 'Cancel'),
            h('button', {
                class: 'vns_btn vns_btn_primary',
                onclick: () => {
                    if (!form.name.trim()) {
                        alert('Name is required');
                        return;
                    }
                    state.npcs.push(form);
                    saveState();
                    render();
                    closeModal();
                }
            }, 'Add NPC')
        )
    );

    openModal('Add NPC', content);
}

// Main render
function render() {
    if (!UI.container) return;

    const body = UI.container.querySelector('.vns_panel_body');
    if (!body) return;

    body.innerHTML = '';

    if (UI.activeView === 'detail' && UI.selectedNPC) {
        const npc = state.npcs.find(n => n.id === UI.selectedNPC);
        if (npc) {
            body.appendChild(renderNPCDetail(npc));
            return;
        }
    }

    // List view
    body.appendChild(h('div', { class: 'vns_toolbar' },
        h('input', {
            type: 'text',
            class: 'vns_search',
            placeholder: 'Search NPCs...',
            value: UI.searchQuery,
            oninput: (e) => { UI.searchQuery = e.target.value; render(); }
        }),
        h('select', {
            class: 'vns_filter_select',
            onchange: (e) => { UI.filter = e.target.value; render(); }
        },
            h('option', { value: 'all' }, 'All NPCs'),
            h('option', { value: 'allies' }, 'Allies'),
            h('option', { value: 'enemies' }, 'Enemies'),
            h('option', { value: 'neutral' }, 'Neutral'),
            h('option', { value: 'dead' }, 'Deceased')
        ),
        h('button', {
            class: 'vns_btn vns_btn_primary',
            onclick: openAddModal
        }, '+ Add NPC')
    ));

    body.appendChild(renderNPCList());
}

// Mount UI
function mountUI() {
    UI.container = h('div', { class: 'vns_container vns_hidden' },
        h('div', { class: 'vns_panel' },
            h('div', { class: 'vns_panel_header' },
                h('h2', {}, 'NPC Tracker'),
                h('span', { class: 'vns_npc_count' }, `${state.npcs.filter(n => n.alive).length} NPCs`),
                h('button', {
                    class: 'vns_btn_icon',
                    onclick: () => { UI.visible = false; UI.container.classList.add('vns_hidden'); }
                }, '×')
            ),
            h('div', { class: 'vns_panel_body' })
        )
    );

    // Add launcher button
    const launcher = h('button', {
        class: 'vns_launcher',
        onclick: () => {
            UI.visible = !UI.visible;
            UI.container.classList.toggle('vns_hidden', !UI.visible);
            if (UI.visible) render();
        }
    }, '');

    document.body.appendChild(UI.container);
    document.body.appendChild(launcher);

    console.log('[VNPCSocial] UI mounted');
}

// Register events
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
    if (!ValdrisCore) {
        console.log('[VNPCSocial] Running standalone');
        return;
    }

    ValdrisCore.registerDomain('npcs', EXT_NAME);
    saveState();

    // Listen for new day - process relationship decay
    ValdrisCore.ValdrisEventBus.subscribe('newDay', () => {
        if (!state.settings.decayEnabled) return;

        for (const npc of state.npcs) {
            processDailyDecay(npc, 1);
        }
        saveState();
    });

    console.log('[VNPCSocial] Core integration complete');
}

// Build NPC context for AI
export function buildNPCSocialContext() {
    const parts = [];

    const summary = generateRelationshipSummary(state.npcs);
    if (summary) parts.push(summary);

    const recent = buildNPCsContext(state.npcs, state.settings.maxContextNPCs);
    if (recent) parts.push(recent);

    return parts.join('\n\n');
}

// Public API
window.VNPCSocial = {
    getState: () => state,
    getNPC: (id) => state.npcs.find(n => n.id === id),
    getNPCByName: (name) => state.npcs.find(n => n.name.toLowerCase() === name.toLowerCase()),
    addNPC: (data) => { const npc = createNPC(data); state.npcs.push(npc); saveState(); return npc; },
    applyEvent: (npcId, event, intensity) => {
        const npc = state.npcs.find(n => n.id === npcId);
        if (npc) { applyRelationshipEvent(npc, event, intensity); saveState(); }
    },
    buildContext: buildNPCSocialContext,
    open: () => { UI.visible = true; UI.container?.classList.remove('vns_hidden'); render(); },
    close: () => { UI.visible = false; UI.container?.classList.add('vns_hidden'); }
};

// Initialize
(async function init() {
    console.log('[VNPCSocial] Loading...');

    try {
        loadState();
        mountUI();
        registerEvents();
        initCoreIntegration();
        render();

        console.log('[VNPCSocial] Ready!');
    } catch (e) {
        console.error('[VNPCSocial] Init failed:', e);
    }
})();
