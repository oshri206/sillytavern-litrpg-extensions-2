/**
 * Valdris Vex Whispers (VVW)
 * Vex the system companion - hints, reminders, and cross-extension context
 */

const EXT_NAME = 'valdris-vex-whispers';

import {
    VEX_PERSONALITY,
    HINT_CATEGORIES,
    createHint,
    generateHints,
    getVoiceLine,
    buildVexContext,
    createEmptyVexState
} from './vex-engine.js';

// Valdris Core
let ValdrisCore = null;
try {
    ValdrisCore = await import('../valdris-core/index.js');
} catch (e) {
    console.warn('[Vex] Valdris Core not available');
}

// SillyTavern
let getContext, saveSettingsDebounced, eventSource, event_types;

try {
    const extModule = await import('../../../extensions.js');
    getContext = extModule.getContext;
    saveSettingsDebounced = extModule.saveSettingsDebounced;
} catch (e) {
    console.error('[Vex] Failed to import extensions.js', e);
}

try {
    const scriptModule = await import('../../../../script.js');
    eventSource = scriptModule.eventSource;
    event_types = scriptModule.event_types;
    if (!saveSettingsDebounced) saveSettingsDebounced = scriptModule.saveSettingsDebounced;
} catch (e) {
    console.error('[Vex] Failed to import script.js', e);
}

// State
let state = createEmptyVexState();
let currentHints = [];

// UI
let UI = {
    container: null,
    hintPanel: null,
    visible: false,
    notifications: []
};

function loadState() {
    const context = getContext?.();
    if (!context?.chat_metadata) return;
    const saved = context.chat_metadata.valdris_vex;
    if (saved) state = { ...createEmptyVexState(), ...saved };
}

function saveState() {
    const context = getContext?.();
    if (!context?.chat_metadata) return;
    context.chat_metadata.valdris_vex = state;
    saveSettingsDebounced?.();
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

// Refresh hints from all extensions
function refreshHints() {
    if (!state.settings.autoGenerate) return;

    let coreState = {};

    if (ValdrisCore) {
        coreState = {
            player: ValdrisCore.getDomainState?.('player'),
            time: ValdrisCore.getDomainState?.('time'),
            world: ValdrisCore.getDomainState?.('world'),
            npcs: ValdrisCore.getDomainState?.('npcs'),
            economy: ValdrisCore.getDomainState?.('economy'),
            factions: ValdrisCore.getDomainState?.('factions')
        };
    }

    currentHints = generateHints(coreState);

    // Merge with custom hints
    const customHints = state.hints.filter(h => !h.dismissed && (!h.expires || new Date(h.expires) > new Date()));
    currentHints = [...currentHints, ...customHints].sort((a, b) => a.priority - b.priority);

    render();
}

function renderHintCard(hint) {
    const cat = HINT_CATEGORIES[hint.category] || HINT_CATEGORIES.reminder;

    return h('div', { class: `vvw_hint_card vvw_cat_${hint.category}` },
        h('div', { class: 'vvw_hint_header' },
            h('span', { class: 'vvw_hint_icon' }, cat.icon),
            h('span', { class: 'vvw_hint_category' }, cat.name),
            h('button', {
                class: 'vvw_btn_icon',
                onclick: (e) => {
                    e.stopPropagation();
                    dismissHint(hint.id);
                }
            }, '×')
        ),
        h('div', { class: 'vvw_hint_message' }, hint.message)
    );
}

function dismissHint(hintId) {
    // Mark in state
    if (!state.dismissed.includes(hintId)) {
        state.dismissed.push(hintId);
    }
    // Mark custom hints as dismissed
    const customHint = state.hints.find(h => h.id === hintId);
    if (customHint) {
        customHint.dismissed = true;
    }
    // Remove from current hints
    currentHints = currentHints.filter(h => h.id !== hintId);
    saveState();
    render();
}

function addCustomHint(message, category = 'reminder') {
    const hint = createHint({
        message,
        category,
        source: 'user'
    });
    state.hints.push(hint);
    saveState();
    refreshHints();
}

function render() {
    if (!UI.container) return;

    const badge = UI.container.querySelector('.vvw_badge');
    const panel = UI.container.querySelector('.vvw_panel_body');

    // Update badge
    const unreadCount = currentHints.filter(h => !h.read && !state.dismissed.includes(h.id)).length;
    if (badge) {
        badge.textContent = unreadCount;
        badge.style.display = unreadCount > 0 ? 'flex' : 'none';
    }

    if (!panel || !UI.visible) return;

    panel.innerHTML = '';

    // Settings toggle
    panel.appendChild(h('div', { class: 'vvw_settings_row' },
        h('label', { class: 'vvw_toggle_label' },
            h('input', {
                type: 'checkbox',
                checked: state.settings.autoGenerate,
                onchange: (e) => {
                    state.settings.autoGenerate = e.target.checked;
                    saveState();
                    if (e.target.checked) refreshHints();
                }
            }),
            ' Auto-generate hints'
        ),
        h('button', { class: 'vvw_btn vvw_btn_small', onclick: refreshHints }, '🔄 Refresh')
    ));

    // Vex avatar and message
    const voiceLine = currentHints.length > 0 ?
        (currentHints[0].priority <= 1 ? getVoiceLine('warning') : getVoiceLine('hint')) :
        getVoiceLine('neutral');

    panel.appendChild(h('div', { class: 'vvw_vex_section' },
        h('div', { class: 'vvw_vex_avatar' }, VEX_PERSONALITY.icon),
        h('div', { class: 'vvw_vex_speech' },
            h('span', { class: 'vvw_vex_name' }, VEX_PERSONALITY.name),
            h('span', { class: 'vvw_vex_line' }, voiceLine)
        )
    ));

    // Hints list
    if (currentHints.length === 0) {
        panel.appendChild(h('div', { class: 'vvw_empty' }, 'No active hints. All clear!'));
    } else {
        panel.appendChild(h('div', { class: 'vvw_hints_list' },
            ...currentHints.slice(0, 10).map(hint => renderHintCard(hint))
        ));
    }

    // Add custom hint
    panel.appendChild(h('div', { class: 'vvw_add_hint' },
        h('input', {
            type: 'text',
            class: 'vvw_hint_input',
            placeholder: 'Add a personal reminder...',
            id: 'vvw_custom_hint_input'
        }),
        h('button', {
            class: 'vvw_btn vvw_btn_primary',
            onclick: () => {
                const input = document.getElementById('vvw_custom_hint_input');
                if (input && input.value.trim()) {
                    addCustomHint(input.value.trim());
                    input.value = '';
                }
            }
        }, 'Add')
    ));
}

function mountUI() {
    UI.container = h('div', { class: 'vvw_container' },
        h('button', {
            class: 'vvw_launcher',
            onclick: () => {
                UI.visible = !UI.visible;
                UI.container.querySelector('.vvw_panel').classList.toggle('vvw_hidden', !UI.visible);
                if (UI.visible) {
                    // Mark all as read
                    currentHints.forEach(h => h.read = true);
                    render();
                }
            }
        },
            VEX_PERSONALITY.icon,
            h('span', { class: 'vvw_badge', style: { display: 'none' } }, '0')
        ),
        h('div', { class: 'vvw_panel vvw_hidden' },
            h('div', { class: 'vvw_panel_header' },
                h('h2', {}, `${VEX_PERSONALITY.icon} ${VEX_PERSONALITY.name}`),
                h('span', { class: 'vvw_subtitle' }, VEX_PERSONALITY.title),
                h('button', {
                    class: 'vvw_btn_icon',
                    onclick: () => {
                        UI.visible = false;
                        UI.container.querySelector('.vvw_panel').classList.add('vvw_hidden');
                    }
                }, '×')
            ),
            h('div', { class: 'vvw_panel_body' })
        )
    );

    document.body.appendChild(UI.container);
    console.log('[Vex] UI mounted');
}

function registerEvents() {
    if (eventSource && event_types) {
        eventSource.on(event_types.CHAT_CHANGED, () => {
            loadState();
            refreshHints();
        });

        // Refresh hints after each message
        eventSource.on(event_types.MESSAGE_RECEIVED, () => {
            setTimeout(refreshHints, 500);
        });
    }
}

function initCoreIntegration() {
    if (!ValdrisCore) return;

    // Subscribe to domain changes to refresh hints
    // FIXED: Changed from .subscribe() to .on()
    ValdrisCore.ValdrisEventBus.on('domainChanged', () => {
        setTimeout(refreshHints, 100);
    });

    // Subscribe to time events
    // FIXED: Changed from .subscribe() to .on()
    ValdrisCore.ValdrisEventBus.on('newDay', () => {
        // Clear expired hints
        state.hints = state.hints.filter(h => !h.expires || new Date(h.expires) > new Date());
        saveState();
        refreshHints();
    });

    console.log('[Vex] Core integration complete');
}

// Public API
window.Vex = {
    getHints: () => currentHints,
    addHint: addCustomHint,
    dismissHint,
    refresh: refreshHints,
    buildContext: () => buildVexContext(currentHints, state.settings),
    speak: (mood) => getVoiceLine(mood),
    open: () => {
        UI.visible = true;
        UI.container?.querySelector('.vvw_panel')?.classList.remove('vvw_hidden');
        render();
    },
    close: () => {
        UI.visible = false;
        UI.container?.querySelector('.vvw_panel')?.classList.add('vvw_hidden');
    }
};

// Initialize
(async function init() {
    console.log('[Vex] Awakening...');
    try {
        loadState();
        mountUI();
        registerEvents();
        initCoreIntegration();
        refreshHints();
        console.log('[Vex] Ready to assist!');
    } catch (e) {
        console.error('[Vex] Init failed:', e);
    }
})();
