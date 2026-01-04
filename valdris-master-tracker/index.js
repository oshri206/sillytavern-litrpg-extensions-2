/**
 * Valdris Master Tracker
 * Comprehensive character tracker for LitRPG roleplay
 * Main entry point with UI, modals, and tab navigation
 */

const EXT_NAME = 'valdris-master-tracker';

// Import state manager
import {
    initStateManager,
    getState,
    setState,
    updateField,
    subscribe,
    createEmptyState,
    recalculateDerivedStats
} from './state-manager.js';

// Import tab renderers
import { renderOverviewTab } from './tabs/overview.js';
import { renderStatsTab } from './tabs/stats.js';
import { renderClassLevelTab } from './tabs/class-level.js';
import { renderSkillsTab } from './tabs/skills.js';
import { renderSpellsTab } from './tabs/spells.js';
import { renderTraitsTab } from './tabs/traits.js';
import { renderTitlesTab } from './tabs/titles.js';
import { renderModifiersTab } from './tabs/modifiers.js';
import { renderEquipmentTab } from './tabs/equipment.js';
import { renderInventoryTab } from './tabs/inventory.js';
import { renderReputationTab } from './tabs/reputation.js';
import { renderCompanionsTab } from './tabs/companions.js';
import { renderAchievementsTab } from './tabs/achievements.js';
import { renderAffinitiesTab } from './tabs/affinities.js';
import { renderContractsTab } from './tabs/contracts.js';
import { renderPropertiesTab } from './tabs/properties.js';
import { renderTransformationsTab } from './tabs/transformations.js';
import { renderBountiesTab } from './tabs/bounties.js';
import { renderLegacyTab } from './tabs/legacy.js';
import { renderSurvivalMetersTab } from './tabs/survival-meters.js';
import { renderBlessingsTab } from './tabs/blessings.js';
import { renderMasteriesTab } from './tabs/masteries.js';
import { renderKarmaTab } from './tabs/karma.js';
import { renderLimitationsTab } from './tabs/limitations.js';
import { renderCollectionsTab } from './tabs/collections.js';
import { renderGuildsTab } from './tabs/guilds.js';
import { renderDungeonsTab } from './tabs/dungeons.js';
import { renderTalentsTab } from './tabs/talents.js';
import { renderLoadoutsTab } from './tabs/loadouts.js';
import { renderSettingsTab } from './tabs/settings.js';
import { buildContextBlock } from './context-utils.js';

// SillyTavern module references
let extension_settings, getContext, saveSettingsDebounced;
let eventSource, event_types;

// Import SillyTavern modules
try {
    const extModule = await import('../../../extensions.js');
    extension_settings = extModule.extension_settings;
    getContext = extModule.getContext;
    saveSettingsDebounced = extModule.saveSettingsDebounced;
} catch (e) {
    console.error('[VMasterTracker] Failed to import extensions.js', e);
}

try {
    const scriptModule = await import('../../../../script.js');
    eventSource = scriptModule.eventSource;
    event_types = scriptModule.event_types;
    if (!saveSettingsDebounced) saveSettingsDebounced = scriptModule.saveSettingsDebounced;
} catch (e) {
    console.error('[VMasterTracker] Failed to import script.js', e);
}

// Initialize state manager with SillyTavern references
initStateManager(getContext, saveSettingsDebounced);

// UI State
const UI = {
    mounted: false,
    root: null,
    launcher: null,
    activeTab: 'overview',
    panelVisible: true,
    modalStack: []
};

// Tab definitions
const TABS = [
    { key: 'overview', label: 'Overview', icon: '' },
    { key: 'stats', label: 'Stats', icon: '' },
    { key: 'class', label: 'Class', icon: '' },
    { key: 'skills', label: 'Skills', icon: '' },
    { key: 'spells', label: 'Spells', icon: '' },
    { key: 'traits', label: 'Traits', icon: '' },
    { key: 'titles', label: 'Titles', icon: '' },
    { key: 'modifiers', label: 'Modifiers', icon: '' },
    { key: 'equipment', label: 'Equipment', icon: '' },
    { key: 'inventory', label: 'Inventory', icon: '' },
    { key: 'reputation', label: 'Reputation', icon: '' },
    { key: 'companions', label: 'Companions', icon: '' },
    { key: 'achievements', label: 'Achievements', icon: '' },
    { key: 'affinities', label: 'Affinities', icon: '' },
    { key: 'contracts', label: 'Contracts', icon: '' },
    { key: 'properties', label: 'Properties', icon: '' },
    { key: 'transformations', label: 'Forms', icon: '' },
    { key: 'bounties', label: 'Bounties', icon: '' },
    { key: 'legacy', label: 'Legacy', icon: '' },
    { key: 'survival', label: 'Survival', icon: '' },
    { key: 'blessings', label: 'Blessings', icon: '' },
    { key: 'masteries', label: 'Masteries', icon: '' },
    { key: 'karma', label: 'Karma', icon: '' },
    { key: 'limitations', label: 'Limitations', icon: '' },
    { key: 'collections', label: 'Collections', icon: '' },
    { key: 'guilds', label: 'Guilds', icon: '' },
    { key: 'dungeons', label: 'Dungeons', icon: '' },
    { key: 'talents', label: 'Talents', icon: '' },
    { key: 'loadouts', label: 'Loadouts', icon: '' },
    { key: 'settings', label: 'Settings', icon: '' }
];

// Cleanup tracking
const _cleanup = {
    intervals: [],
    listeners: [],
    unsubscribers: []
};

/**
 * Helper function to create DOM elements
 */
function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class') el.className = v;
        else if (k.startsWith('on') && typeof v === 'function') {
            el.addEventListener(k.substring(2), v);
        } else if (v === false || v === null || v === undefined) continue;
        else el.setAttribute(k, String(v));
    }
    for (const c of children.flat()) {
        if (c === null || c === undefined) continue;
        if (typeof c === 'string' || typeof c === 'number') {
            el.appendChild(document.createTextNode(String(c)));
        } else {
            el.appendChild(c);
        }
    }
    return el;
}

/**
 * Mount the main UI
 */
function mountUI() {
    if (UI.mounted) return;
    UI.mounted = true;

    // Create launcher button
    const launcher = document.createElement('button');
    launcher.id = 'vmt_launcher';
    launcher.className = 'vmt_launcher';
    launcher.innerHTML = '';
    launcher.title = 'Toggle Valdris Master Tracker';
    launcher.addEventListener('click', togglePanel);
    document.body.appendChild(launcher);
    UI.launcher = launcher;

    // Create main panel
    const wrapper = document.createElement('div');
    wrapper.id = 'vmt_root';
    wrapper.className = 'vmt_dock';

    wrapper.innerHTML = `
        <div class="vmt_panel">
            <div class="vmt_header">
                <div class="vmt_title">
                    <span class="vmt_badge">VMT</span>
                    <span class="vmt_title_text">Master Tracker</span>
                </div>
                <div class="vmt_header_actions">
                    <button class="vmt_btn vmt_btn_reset" id="vmt_btn_reset" title="Reset to defaults">⟳</button>
                    <button class="vmt_btn vmt_btn_collapse" id="vmt_btn_collapse" title="Collapse panel">▾</button>
                </div>
            </div>

            <div class="vmt_tabs_wrapper">
                <button class="vmt_tab_scroll_btn vmt_tab_scroll_left" id="vmt_tab_scroll_left" title="Scroll left">‹</button>
                <div class="vmt_tabs" id="vmt_tabs"></div>
                <button class="vmt_tab_scroll_btn vmt_tab_scroll_right" id="vmt_tab_scroll_right" title="Scroll right">›</button>
            </div>
            <div class="vmt_body" id="vmt_body"></div>

            <div class="vmt_footer">
                <div class="vmt_status" id="vmt_status">Ready</div>
            </div>
        </div>

        <div class="vmt_modal" id="vmt_modal" aria-hidden="true">
            <div class="vmt_modal_backdrop"></div>
            <div class="vmt_modal_card">
                <div class="vmt_modal_header">
                    <div class="vmt_modal_title" id="vmt_modal_title">Modal</div>
                    <button class="vmt_btn" id="vmt_modal_close">✕</button>
                </div>
                <div class="vmt_modal_body" id="vmt_modal_body"></div>
                <div class="vmt_modal_footer" id="vmt_modal_footer"></div>
            </div>
        </div>
    `;

    document.body.appendChild(wrapper);
    UI.root = wrapper;

    // Set up tab buttons
    const tabsEl = wrapper.querySelector('#vmt_tabs');
    for (const t of TABS) {
        const btn = document.createElement('button');
        btn.className = 'vmt_tab';
        btn.dataset.tab = t.key;
        btn.innerHTML = `<span class="vmt_tab_icon">${t.icon}</span><span class="vmt_tab_label">${t.label}</span>`;
        btn.addEventListener('click', () => {
            UI.activeTab = t.key;
            render();
            // Scroll active tab into view
            btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        });
        tabsEl.appendChild(btn);
    }

    // Set up tab scrolling
    const scrollLeftBtn = wrapper.querySelector('#vmt_tab_scroll_left');
    const scrollRightBtn = wrapper.querySelector('#vmt_tab_scroll_right');

    function updateTabScrollButtons() {
        if (!tabsEl) return;
        const canScrollLeft = tabsEl.scrollLeft > 0;
        const canScrollRight = tabsEl.scrollLeft < (tabsEl.scrollWidth - tabsEl.clientWidth - 1);
        scrollLeftBtn.classList.toggle('vmt_scroll_hidden', !canScrollLeft);
        scrollRightBtn.classList.toggle('vmt_scroll_hidden', !canScrollRight);
    }

    scrollLeftBtn.addEventListener('click', () => {
        tabsEl.scrollBy({ left: -150, behavior: 'smooth' });
    });

    scrollRightBtn.addEventListener('click', () => {
        tabsEl.scrollBy({ left: 150, behavior: 'smooth' });
    });

    tabsEl.addEventListener('scroll', updateTabScrollButtons);

    // Initial check for scroll buttons
    setTimeout(updateTabScrollButtons, 100);

    // Update on window resize
    const resizeHandler = () => updateTabScrollButtons();
    window.addEventListener('resize', resizeHandler);
    _cleanup.listeners.push({ element: window, event: 'resize', handler: resizeHandler });

    // Set up header buttons
    wrapper.querySelector('#vmt_btn_collapse').addEventListener('click', togglePanel);
    wrapper.querySelector('#vmt_btn_reset').addEventListener('click', () => {
        openModal('confirm-reset', {
            onConfirm: async () => {
                await setState(createEmptyState());
                await recalculateDerivedStats();
                render();
                closeModal();
                setStatus('Reset to defaults');
            }
        });
    });

    // Modal close handlers
    wrapper.querySelector('#vmt_modal_close').addEventListener('click', closeModal);
    wrapper.querySelector('.vmt_modal_backdrop').addEventListener('click', closeModal);

    console.log('[VMasterTracker] UI mounted');
}

/**
 * Toggle panel visibility
 */
function togglePanel() {
    UI.panelVisible = !UI.panelVisible;
    if (UI.root) {
        UI.root.classList.toggle('vmt_hidden', !UI.panelVisible);
    }
    if (UI.launcher) {
        UI.launcher.classList.toggle('vmt_active', UI.panelVisible);
    }
}

/**
 * Set status message
 */
function setStatus(msg) {
    const statusEl = UI.root?.querySelector('#vmt_status');
    if (statusEl) {
        statusEl.textContent = msg;
        setTimeout(() => {
            if (statusEl.textContent === msg) {
                statusEl.textContent = 'Ready';
            }
        }, 3000);
    }
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function showToast(message, options = {}) {
    if (!options.show && options.show !== undefined) return null;
    const toast = document.createElement('div');
    toast.className = 'vmt-toast';
    const text = document.createElement('span');
    text.textContent = message;
    toast.appendChild(text);

    let timeoutId;
    if (options.actionLabel && typeof options.onAction === 'function') {
        const action = document.createElement('button');
        action.className = 'vmt-toast-undo';
        action.textContent = options.actionLabel;
        action.addEventListener('click', () => {
            options.onAction();
            toast.remove();
            if (timeoutId) clearTimeout(timeoutId);
        });
        toast.appendChild(action);
    }

    document.body.appendChild(toast);
    if (options.duration) {
        timeoutId = setTimeout(() => toast.remove(), options.duration);
    }
    return toast;
}

function normalizeRegex(pattern) {
    if (!pattern) return null;
    if (pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
        const lastSlash = pattern.lastIndexOf('/');
        const body = pattern.slice(1, lastSlash);
        const flags = pattern.slice(lastSlash + 1) || 'gi';
        return new RegExp(body, flags);
    }
    return new RegExp(pattern, 'gi');
}

function getMessageContent(messageId) {
    const ctx = getContext?.();
    const chat = ctx?.chat || ctx?.messages || [];
    const message = chat.find(entry => entry.id === messageId || entry.index === messageId) || chat[messageId];
    return message?.mes || message?.message || message?.content || '';
}

async function recordParseHistory(summary, message, applied) {
    const state = getState();
    const history = [...(state.settings?.parseHistory || [])];
    history.push({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        summary,
        message: message?.slice(0, 200) || '',
        applied: Boolean(applied)
    });
    await updateField('settings.parseHistory', history.slice(-100));
}

async function applyResourceDelta(path, delta, min, max) {
    const state = getState();
    const current = path.split('.').reduce((acc, key) => acc?.[key], state) ?? 0;
    const next = clamp(current + delta, min, max);
    await updateField(path, next);
    return async () => updateField(path, current);
}

async function applySetValue(path, value) {
    const state = getState();
    const current = path.split('.').reduce((acc, key) => acc?.[key], state);
    await updateField(path, value);
    return async () => updateField(path, current);
}

async function applyItemGains(items) {
    const state = getState();
    const inventory = [...(state.inventory || [])];
    const addedIds = [];
    const incrementedCounts = {};
    const counts = items.reduce((acc, name) => {
        acc[name] = (acc[name] || 0) + 1;
        return acc;
    }, {});

    Object.entries(counts).forEach(([name, count]) => {
        const existing = inventory.find(item => item.name === name);
        if (existing) {
            existing.quantity = (existing.quantity || 1) + count;
            incrementedCounts[name] = count;
        } else {
            const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
            inventory.push({ id, name, quantity: count });
            addedIds.push(id);
        }
    });
    await updateField('inventory', inventory);
    return async () => {
        const current = [...(getState().inventory || [])];
        const updated = current
            .map(item => {
                if (addedIds.includes(item.id)) return null;
                const decrement = incrementedCounts[item.name];
                if (decrement) {
                    const nextQty = (item.quantity || 1) - decrement;
                    if (nextQty <= 0) return null;
                    return { ...item, quantity: nextQty };
                }
                return item;
            })
            .filter(Boolean);
        await updateField('inventory', updated);
    };
}

async function applyStatusGains(statuses) {
    const state = getState();
    const buffs = [...(state.buffs || [])];
    const added = [];
    statuses.forEach(status => {
        if (!buffs.find(buff => buff.name === status)) {
            buffs.push({ name: status, effect: '' });
            added.push(status);
        }
    });
    await updateField('buffs', buffs);
    return async () => {
        const current = [...(getState().buffs || [])];
        const next = current.filter(buff => !added.includes(buff.name));
        await updateField('buffs', next);
    };
}

async function parseMessageForChanges(text) {
    const state = getState();
    const autoParsing = state.settings?.autoParsing;
    if (!autoParsing?.enabled || !text) return;

    const categories = autoParsing.parseCategories || {};
    const changes = [];

    const patterns = {
        damage: /(?:takes?|receives?|suffers?)\s+(\d+)\s+(?:points?\s+of\s+)?damage/gi,
        healing: /(?:heals?|recovers?|restores?)\s+(\d+)\s+(?:HP|health|hit\s+points?)/gi,
        manaUse: /(?:spends?|uses?|costs?)\s+(\d+)\s+(?:MP|mana|magic)/gi,
        manaRestore: /(?:recovers?|restores?|regains?)\s+(\d+)\s+(?:MP|mana)/gi,
        xpGain: /(?:gains?|earns?|receives?)\s+(\d+)\s+(?:XP|experience)/gi,
        levelUp: /(?:levels?\s+up|reached?\s+level|now\s+level)\s+(\d+)/gi,
        goldGain: /(?:gains?|finds?|receives?|loots?)\s+(\d+)\s+gold/gi,
        goldLoss: /(?:spends?|pays?|loses?)\s+(\d+)\s+gold/gi,
        itemGain: /(?:obtains?|receives?|finds?|picks?\s+up)\s+(?:a\s+|the\s+)?([A-Z][^.!?]+?)(?:\.|!|\?|$)/gi,
        statusGain: /(?:is\s+now|becomes?|gains?\s+the\s+status)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi
    };

    const sumMatches = (regex) => {
        let total = 0;
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(text)) !== null) {
            total += Number(match[1] || 0);
        }
        return total;
    };

    if (categories.damage) {
        const amount = sumMatches(patterns.damage);
        if (amount > 0) {
            changes.push({
                summary: `-${amount} HP`,
                apply: () => applyResourceDelta('hp.current', -amount, 0, state.hp?.max ?? 0)
            });
        }
    }

    if (categories.healing) {
        const amount = sumMatches(patterns.healing);
        if (amount > 0) {
            changes.push({
                summary: `+${amount} HP`,
                apply: () => applyResourceDelta('hp.current', amount, 0, state.hp?.max ?? 0)
            });
        }
    }

    if (categories.mana) {
        const spent = sumMatches(patterns.manaUse);
        const restored = sumMatches(patterns.manaRestore);
        if (spent > 0) {
            changes.push({
                summary: `-${spent} MP`,
                apply: () => applyResourceDelta('mp.current', -spent, 0, state.mp?.max ?? 0)
            });
        }
        if (restored > 0) {
            changes.push({
                summary: `+${restored} MP`,
                apply: () => applyResourceDelta('mp.current', restored, 0, state.mp?.max ?? 0)
            });
        }
    }

    if (categories.xp) {
        const xp = sumMatches(patterns.xpGain);
        if (xp > 0) {
            changes.push({
                summary: `+${xp} XP`,
                apply: () => applyResourceDelta('xp.current', xp, 0, Number.MAX_SAFE_INTEGER)
            });
        }
        patterns.levelUp.lastIndex = 0;
        const levelMatch = patterns.levelUp.exec(text);
        if (levelMatch) {
            const level = Number(levelMatch[1]);
            if (!Number.isNaN(level)) {
                changes.push({
                    summary: `Level ${level}`,
                    apply: () => applySetValue('level', level)
                });
            }
        }
    }

    if (categories.gold) {
        const gained = sumMatches(patterns.goldGain);
        const lost = sumMatches(patterns.goldLoss);
        if (gained > 0) {
            changes.push({
                summary: `+${gained} gold`,
                apply: () => applyResourceDelta('currencies.gold', gained, 0, Number.MAX_SAFE_INTEGER)
            });
        }
        if (lost > 0) {
            changes.push({
                summary: `-${lost} gold`,
                apply: () => applyResourceDelta('currencies.gold', -lost, 0, Number.MAX_SAFE_INTEGER)
            });
        }
    }

    if (categories.items) {
        const items = [];
        patterns.itemGain.lastIndex = 0;
        let match;
        while ((match = patterns.itemGain.exec(text)) !== null) {
            if (match[1]) items.push(match[1].trim());
        }
        if (items.length) {
            changes.push({
                summary: `Items: ${items.join(', ')}`,
                apply: () => applyItemGains(items)
            });
        }
    }

    if (categories.status) {
        const statuses = [];
        patterns.statusGain.lastIndex = 0;
        let match;
        while ((match = patterns.statusGain.exec(text)) !== null) {
            if (match[1]) statuses.push(match[1].trim());
        }
        if (statuses.length) {
            changes.push({
                summary: `Status: ${statuses.join(', ')}`,
                apply: () => applyStatusGains(statuses)
            });
        }
    }

    (autoParsing.customPatterns || []).forEach(pattern => {
        if (pattern.enabled === false) return;
        const regex = normalizeRegex(pattern.pattern);
        if (!regex) return;
        let match;
        regex.lastIndex = 0;
        while ((match = regex.exec(text)) !== null) {
            if (pattern.field === 'item' && match[1]) {
                changes.push({
                    summary: `Item: ${match[1]}`,
                    apply: () => applyItemGains([match[1].trim()])
                });
            } else if (pattern.field === 'status' && match[1]) {
                changes.push({
                    summary: `Status: ${match[1]}`,
                    apply: () => applyStatusGains([match[1].trim()])
                });
            } else if (match[1]) {
                const value = Number(match[1]);
                if (Number.isNaN(value)) return;
                const operation = pattern.operation || '+';
                const field = pattern.field || '';
                const pathMap = {
                    hp: 'hp.current',
                    mp: 'mp.current',
                    sp: 'stamina.current',
                    xp: 'xp.current',
                    gold: 'currencies.gold'
                };
                const path = pathMap[field];
                if (!path) return;
                if (operation === 'set') {
                    changes.push({
                        summary: `Set ${field.toUpperCase()} ${value}`,
                        apply: () => applySetValue(path, value)
                    });
                } else {
                    const delta = operation === '-' ? -value : value;
                    changes.push({
                        summary: `${delta >= 0 ? '+' : ''}${delta} ${field.toUpperCase()}`,
                        apply: () => applyResourceDelta(path, delta, 0, Number.MAX_SAFE_INTEGER)
                    });
                }
            }
        }
    });

    if (!changes.length) return;

    const summary = changes.map(change => change.summary).join(' | ');
    const applyAll = async () => {
        const undoStack = [];
        for (const change of changes) {
            const undo = await change.apply();
            if (undo) undoStack.push(undo);
        }
        await recordParseHistory(summary, text, true);
        if (autoParsing.showToasts) {
            const undoWindow = (autoParsing.undoWindow || 5) * 1000;
            showToast(`Applied: ${summary}`, {
                actionLabel: 'Undo',
                duration: undoWindow,
                show: autoParsing.showToasts,
                onAction: () => {
                    undoStack.reverse().forEach(undo => undo());
                }
            });
        }
    };

    if (autoParsing.autoApply) {
        await applyAll();
    } else {
        await recordParseHistory(`Pending: ${summary}`, text, false);
        showToast(`Detected: ${summary}`, {
            actionLabel: 'Apply',
            duration: (autoParsing.undoWindow || 5) * 1000,
            show: autoParsing.showToasts,
            onAction: applyAll
        });
    }
}

function injectContextBlock(data, block, position) {
    if (!data || !block) return;
    const positionKeys = {
        authorNote: ['author_note', 'authorNote', 'author_note_text', 'authorNoteText'],
        systemPrompt: ['system_prompt', 'systemPrompt', 'system'],
        worldInfo: ['world_info', 'worldInfo', 'worldInfoString']
    };

    const keys = positionKeys[position] || positionKeys.authorNote;
    const targetKey = keys.find(key => typeof data[key] === 'string') || keys[0];
    const existing = data[targetKey] || '';
    data[targetKey] = existing ? `${existing}\n${block}` : block;
}

/**
 * Open a modal dialog
 */
function openModal(type, data = {}) {
    const modal = UI.root?.querySelector('#vmt_modal');
    const titleEl = UI.root?.querySelector('#vmt_modal_title');
    const bodyEl = UI.root?.querySelector('#vmt_modal_body');
    const footerEl = UI.root?.querySelector('#vmt_modal_footer');

    if (!modal || !titleEl || !bodyEl || !footerEl) return;

    // Clear previous content
    bodyEl.innerHTML = '';
    footerEl.innerHTML = '';

    // Build modal content based on type
    switch (type) {
        case 'edit-value':
            titleEl.textContent = `Edit ${data.field}`;
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Value'),
                    h('input', {
                        type: 'number',
                        class: 'vmt_modal_input',
                        id: 'vmt_modal_value',
                        value: data.currentValue
                    })
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const val = document.getElementById('vmt_modal_value').value;
                        data.onSave(val);
                        closeModal();
                    }
                }, 'Save')
            );
            footerEl.appendChild(
                h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel')
            );
            break;

        case 'edit-title':
            titleEl.textContent = 'Edit Active Title';
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Title Name'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_modal_title_name',
                        value: data.title?.name || '',
                        placeholder: 'e.g., Dragon Slayer'
                    })
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Effects'),
                    h('textarea', {
                        class: 'vmt_modal_textarea',
                        id: 'vmt_modal_title_effects',
                        placeholder: 'e.g., +10% damage to dragons'
                    }, data.title?.effects || '')
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        data.onSave({
                            name: document.getElementById('vmt_modal_title_name').value,
                            effects: document.getElementById('vmt_modal_title_effects').value
                        });
                        closeModal();
                    }
                }, 'Save')
            );
            footerEl.appendChild(
                h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel')
            );
            break;

        case 'manage-status':
            titleEl.textContent = data.type === 'buffs' ? 'Manage Buffs' : 'Manage Debuffs';
            const listContainer = h('div', { class: 'vmt_status_list' });
            const items = [...data.items];

            const renderStatusList = () => {
                listContainer.innerHTML = '';
                if (items.length === 0) {
                    listContainer.appendChild(h('div', { class: 'vmt_empty' }, `No ${data.type} active`));
                } else {
                    items.forEach((item, i) => {
                        listContainer.appendChild(
                            h('div', { class: 'vmt_status_item_row' },
                                h('span', { class: 'vmt_status_name' }, item.name),
                                h('span', { class: 'vmt_status_effect' }, item.effect || ''),
                                h('button', {
                                    class: 'vmt_btn_icon vmt_btn_danger',
                                    onclick: () => {
                                        items.splice(i, 1);
                                        renderStatusList();
                                    }
                                }, '')
                            )
                        );
                    });
                }
            };

            renderStatusList();
            bodyEl.appendChild(listContainer);
            bodyEl.appendChild(
                h('div', { class: 'vmt_add_status_row' },
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_new_status_name',
                        placeholder: 'Name'
                    }),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_new_status_effect',
                        placeholder: 'Effect (optional)'
                    }),
                    h('button', {
                        class: 'vmt_btn vmt_btn_add',
                        onclick: () => {
                            const name = document.getElementById('vmt_new_status_name').value.trim();
                            if (name) {
                                items.push({
                                    name,
                                    effect: document.getElementById('vmt_new_status_effect').value.trim()
                                });
                                document.getElementById('vmt_new_status_name').value = '';
                                document.getElementById('vmt_new_status_effect').value = '';
                                renderStatusList();
                            }
                        }
                    }, '+')
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        data.onSave(items);
                        closeModal();
                    }
                }, 'Save')
            );
            footerEl.appendChild(
                h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel')
            );
            break;

        case 'add-feature':
        case 'edit-feature':
            titleEl.textContent = type === 'add-feature' ? 'Add Class Feature' : 'Edit Class Feature';
            const feature = data.feature || { name: '', description: '', level: 1 };
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Feature Name'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_feature_name',
                        value: feature.name,
                        placeholder: 'e.g., Second Wind'
                    })
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Level Acquired'),
                    h('input', {
                        type: 'number',
                        class: 'vmt_modal_input',
                        id: 'vmt_feature_level',
                        value: feature.level,
                        min: 1,
                        max: 999
                    })
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Description'),
                    h('textarea', {
                        class: 'vmt_modal_textarea',
                        id: 'vmt_feature_desc',
                        placeholder: 'Describe the feature...'
                    }, feature.description || '')
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const newFeature = {
                            name: document.getElementById('vmt_feature_name').value.trim(),
                            level: parseInt(document.getElementById('vmt_feature_level').value, 10) || 1,
                            description: document.getElementById('vmt_feature_desc').value.trim()
                        };
                        if (newFeature.name) {
                            data.onSave(newFeature);
                            closeModal();
                        }
                    }
                }, 'Save')
            );
            footerEl.appendChild(
                h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel')
            );
            break;

        case 'add-class':
            titleEl.textContent = 'Add Multiclass';
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Class Name'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_class_name',
                        placeholder: 'e.g., Rogue'
                    })
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Subclass (Optional)'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_class_subclass',
                        placeholder: 'e.g., Assassin'
                    })
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Starting Level'),
                    h('input', {
                        type: 'number',
                        class: 'vmt_modal_input',
                        id: 'vmt_class_level',
                        value: 1,
                        min: 1,
                        max: 999
                    })
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const name = document.getElementById('vmt_class_name').value.trim();
                        if (name) {
                            data.onSave({
                                name,
                                subclass: document.getElementById('vmt_class_subclass').value.trim(),
                                level: parseInt(document.getElementById('vmt_class_level').value, 10) || 1,
                                xp: { current: 0, needed: 100 },
                                features: []
                            });
                            closeModal();
                        }
                    }
                }, 'Add Class')
            );
            footerEl.appendChild(
                h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel')
            );
            break;

        case 'confirm-reset':
            titleEl.textContent = 'Reset All Data?';
            bodyEl.appendChild(
                h('p', { class: 'vmt_modal_text' },
                    'This will reset all character data to default values. This action cannot be undone.'
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_danger',
                    onclick: data.onConfirm
                }, 'Reset')
            );
            footerEl.appendChild(
                h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel')
            );
            break;

        case 'reset-attributes':
            titleEl.textContent = 'Reset Attributes?';
            bodyEl.appendChild(
                h('p', { class: 'vmt_modal_text' },
                    'This will reset all attributes to base 10 with no modifiers.'
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_danger',
                    onclick: () => {
                        data.onConfirm();
                        closeModal();
                    }
                }, 'Reset')
            );
            footerEl.appendChild(
                h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel')
            );
            break;

        // ===== Skills Modals =====
        case 'add-active-skill':
        case 'edit-active-skill':
            titleEl.textContent = type === 'add-active-skill' ? 'Add Active Skill' : 'Edit Active Skill';
            const activeSkill = data.skill || { name: '', description: '', cooldown: '', resourceCost: '', rank: 1, damageEffect: '', category: 'Combat' };
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Skill Name'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_skill_name',
                        value: activeSkill.name,
                        placeholder: 'e.g., Power Strike'
                    })
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Description'),
                    h('textarea', {
                        class: 'vmt_modal_textarea',
                        id: 'vmt_skill_desc',
                        placeholder: 'Describe the skill...'
                    }, activeSkill.description || '')
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Category'),
                        h('select', { class: 'vmt_modal_select', id: 'vmt_skill_category' },
                            ['Combat', 'Magic', 'Utility', 'Social', 'Crafting'].map(cat =>
                                h('option', { value: cat, selected: activeSkill.category === cat ? 'selected' : null }, cat)
                            )
                        )
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Rank'),
                        h('input', {
                            type: 'number',
                            class: 'vmt_modal_input',
                            id: 'vmt_skill_rank',
                            value: activeSkill.rank || 1,
                            min: 1,
                            max: 99
                        })
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Cooldown'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_skill_cooldown',
                            value: activeSkill.cooldown || '',
                            placeholder: 'e.g., 3 turns'
                        })
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Resource Cost'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_skill_cost',
                            value: activeSkill.resourceCost || '',
                            placeholder: 'e.g., 20 MP'
                        })
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Damage/Effect'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_skill_damage',
                        value: activeSkill.damageEffect || '',
                        placeholder: 'e.g., 2d6+STR damage'
                    })
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const skill = {
                            name: document.getElementById('vmt_skill_name').value.trim(),
                            description: document.getElementById('vmt_skill_desc').value.trim(),
                            category: document.getElementById('vmt_skill_category').value,
                            rank: parseInt(document.getElementById('vmt_skill_rank').value, 10) || 1,
                            cooldown: document.getElementById('vmt_skill_cooldown').value.trim(),
                            resourceCost: document.getElementById('vmt_skill_cost').value.trim(),
                            damageEffect: document.getElementById('vmt_skill_damage').value.trim()
                        };
                        if (skill.name) {
                            data.onSave(skill);
                            closeModal();
                        }
                    }
                }, 'Save')
            );
            footerEl.appendChild(
                h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel')
            );
            break;

        case 'add-passive-skill':
        case 'edit-passive-skill':
            titleEl.textContent = type === 'add-passive-skill' ? 'Add Passive Skill' : 'Edit Passive Skill';
            const passiveSkill = data.skill || { name: '', description: '', effect: '', category: 'Combat' };
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Skill Name'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_pskill_name',
                        value: passiveSkill.name,
                        placeholder: 'e.g., Iron Will'
                    })
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Description'),
                    h('textarea', {
                        class: 'vmt_modal_textarea',
                        id: 'vmt_pskill_desc',
                        placeholder: 'Describe the skill...'
                    }, passiveSkill.description || '')
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Category'),
                    h('select', { class: 'vmt_modal_select', id: 'vmt_pskill_category' },
                        ['Combat', 'Magic', 'Utility', 'Social', 'Crafting'].map(cat =>
                            h('option', { value: cat, selected: passiveSkill.category === cat ? 'selected' : null }, cat)
                        )
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Effect'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_pskill_effect',
                        value: passiveSkill.effect || '',
                        placeholder: 'e.g., +10% mental resistance'
                    })
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const skill = {
                            name: document.getElementById('vmt_pskill_name').value.trim(),
                            description: document.getElementById('vmt_pskill_desc').value.trim(),
                            category: document.getElementById('vmt_pskill_category').value,
                            effect: document.getElementById('vmt_pskill_effect').value.trim()
                        };
                        if (skill.name) {
                            data.onSave(skill);
                            closeModal();
                        }
                    }
                }, 'Save')
            );
            footerEl.appendChild(
                h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel')
            );
            break;

        // ===== Spell Modals =====
        case 'add-spell':
        case 'edit-spell':
            titleEl.textContent = type === 'add-spell' ? 'Add Spell' : 'Edit Spell';
            const spell = data.spell || {
                name: '', description: '', school: 'Evocation', level: 1,
                defaultManaCost: 0, currentManaCost: 0,
                defaultDamageEffect: '', currentDamageEffect: '',
                castingTime: '', range: '', duration: '', concentration: false
            };
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Spell Name'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_spell_name',
                        value: spell.name,
                        placeholder: 'e.g., Fireball'
                    })
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Description'),
                    h('textarea', {
                        class: 'vmt_modal_textarea',
                        id: 'vmt_spell_desc',
                        placeholder: 'Describe the spell...'
                    }, spell.description || '')
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'School/Element'),
                        h('select', { class: 'vmt_modal_select', id: 'vmt_spell_school' },
                            ['Evocation', 'Conjuration', 'Abjuration', 'Transmutation', 'Divination', 'Enchantment', 'Illusion', 'Necromancy',
                             'Fire', 'Ice', 'Lightning', 'Earth', 'Water', 'Wind', 'Light', 'Dark', 'Arcane', 'Nature', 'Holy', 'Unholy'].map(s =>
                                h('option', { value: s, selected: spell.school === s ? 'selected' : null }, s)
                            )
                        )
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Spell Level'),
                        h('input', {
                            type: 'number',
                            class: 'vmt_modal_input',
                            id: 'vmt_spell_level',
                            value: spell.level ?? 1,
                            min: 0,
                            max: 9
                        })
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Default Mana Cost'),
                        h('input', {
                            type: 'number',
                            class: 'vmt_modal_input',
                            id: 'vmt_spell_mana_default',
                            value: spell.defaultManaCost || 0,
                            min: 0
                        })
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Current Mana Cost'),
                        h('input', {
                            type: 'number',
                            class: 'vmt_modal_input',
                            id: 'vmt_spell_mana_current',
                            value: spell.currentManaCost || spell.defaultManaCost || 0,
                            min: 0
                        })
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Default Damage/Effect'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_spell_damage_default',
                            value: spell.defaultDamageEffect || '',
                            placeholder: 'e.g., 8d6 fire'
                        })
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Current Damage/Effect'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_spell_damage_current',
                            value: spell.currentDamageEffect || spell.defaultDamageEffect || '',
                            placeholder: 'e.g., 10d6 fire'
                        })
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_third' },
                        h('label', { class: 'vmt_modal_label' }, 'Casting Time'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_spell_cast',
                            value: spell.castingTime || '',
                            placeholder: '1 action'
                        })
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_third' },
                        h('label', { class: 'vmt_modal_label' }, 'Range'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_spell_range',
                            value: spell.range || '',
                            placeholder: '120 ft'
                        })
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_third' },
                        h('label', { class: 'vmt_modal_label' }, 'Duration'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_spell_duration',
                            value: spell.duration || '',
                            placeholder: 'Instant'
                        })
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_checkbox_label' },
                        h('input', {
                            type: 'checkbox',
                            id: 'vmt_spell_conc',
                            checked: spell.concentration ? 'checked' : null
                        }),
                        h('span', {}, ' Requires Concentration')
                    )
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const newSpell = {
                            name: document.getElementById('vmt_spell_name').value.trim(),
                            description: document.getElementById('vmt_spell_desc').value.trim(),
                            school: document.getElementById('vmt_spell_school').value,
                            level: parseInt(document.getElementById('vmt_spell_level').value, 10) || 0,
                            defaultManaCost: parseInt(document.getElementById('vmt_spell_mana_default').value, 10) || 0,
                            currentManaCost: parseInt(document.getElementById('vmt_spell_mana_current').value, 10) || 0,
                            defaultDamageEffect: document.getElementById('vmt_spell_damage_default').value.trim(),
                            currentDamageEffect: document.getElementById('vmt_spell_damage_current').value.trim(),
                            castingTime: document.getElementById('vmt_spell_cast').value.trim(),
                            range: document.getElementById('vmt_spell_range').value.trim(),
                            duration: document.getElementById('vmt_spell_duration').value.trim(),
                            concentration: document.getElementById('vmt_spell_conc').checked
                        };
                        if (newSpell.name) {
                            data.onSave(newSpell);
                            closeModal();
                        }
                    }
                }, 'Save')
            );
            footerEl.appendChild(
                h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel')
            );
            break;

        // ===== Trait Modals =====
        case 'add-trait':
        case 'edit-trait':
            titleEl.textContent = type === 'add-trait' ? 'Add Trait' : 'Edit Trait';
            const trait = data.trait || { name: '', description: '', source: '', mechanicalEffect: '', category: 'innate' };
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Trait Name'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_trait_name',
                        value: trait.name,
                        placeholder: 'e.g., Darkvision'
                    })
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Description'),
                    h('textarea', {
                        class: 'vmt_modal_textarea',
                        id: 'vmt_trait_desc',
                        placeholder: 'Describe the trait...'
                    }, trait.description || '')
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Category'),
                        h('select', { class: 'vmt_modal_select', id: 'vmt_trait_category' },
                            [
                                { key: 'innate', label: 'Innate' },
                                { key: 'acquired', label: 'Acquired' },
                                { key: 'racial', label: 'Racial' },
                                { key: 'background', label: 'Background' }
                            ].map(cat =>
                                h('option', { value: cat.key, selected: trait.category === cat.key ? 'selected' : null }, cat.label)
                            )
                        )
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Source'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_trait_source',
                            value: trait.source || '',
                            placeholder: 'e.g., Elf heritage'
                        })
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Mechanical Effect'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_trait_effect',
                        value: trait.mechanicalEffect || '',
                        placeholder: 'e.g., See in darkness up to 60 ft'
                    })
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const newTrait = {
                            name: document.getElementById('vmt_trait_name').value.trim(),
                            description: document.getElementById('vmt_trait_desc').value.trim(),
                            category: document.getElementById('vmt_trait_category').value,
                            source: document.getElementById('vmt_trait_source').value.trim(),
                            mechanicalEffect: document.getElementById('vmt_trait_effect').value.trim()
                        };
                        if (newTrait.name) {
                            data.onSave(newTrait);
                            closeModal();
                        }
                    }
                }, 'Save')
            );
            footerEl.appendChild(
                h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel')
            );
            break;

        // ===== Title Modals =====
        case 'add-character-title':
        case 'edit-character-title':
            titleEl.textContent = type === 'add-character-title' ? 'Add Title' : 'Edit Title';
            const charTitle = data.title || { name: '', description: '', effects: '', source: '', rarity: 'common' };
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Title Name'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_chartitle_name',
                        value: charTitle.name,
                        placeholder: 'e.g., Dragon Slayer'
                    })
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Description'),
                    h('textarea', {
                        class: 'vmt_modal_textarea',
                        id: 'vmt_chartitle_desc',
                        placeholder: 'Describe how the title was earned...'
                    }, charTitle.description || '')
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Rarity'),
                        h('select', { class: 'vmt_modal_select', id: 'vmt_chartitle_rarity' },
                            ['common', 'uncommon', 'rare', 'epic', 'legendary'].map(r =>
                                h('option', { value: r, selected: charTitle.rarity === r ? 'selected' : null }, r.charAt(0).toUpperCase() + r.slice(1))
                            )
                        )
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Source'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_chartitle_source',
                            value: charTitle.source || '',
                            placeholder: 'e.g., Defeated Alduin'
                        })
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Effects'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_chartitle_effects',
                        value: charTitle.effects || '',
                        placeholder: 'e.g., +10% damage to dragons'
                    })
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const newTitle = {
                            name: document.getElementById('vmt_chartitle_name').value.trim(),
                            description: document.getElementById('vmt_chartitle_desc').value.trim(),
                            rarity: document.getElementById('vmt_chartitle_rarity').value,
                            source: document.getElementById('vmt_chartitle_source').value.trim(),
                            effects: document.getElementById('vmt_chartitle_effects').value.trim()
                        };
                        if (newTitle.name) {
                            data.onSave(newTitle);
                            closeModal();
                        }
                    }
                }, 'Save')
            );
            footerEl.appendChild(
                h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel')
            );
            break;

        // ===== Modifier Modals =====
        case 'add-modifier':
        case 'edit-modifier':
            titleEl.textContent = type === 'add-modifier' ? 'Add Modifier' : 'Edit Modifier';
            const modCat = data.category || 'permanent';
            const modifier = data.modifier || { name: '', effect: '', value: '', source: '', type: 'buff', duration: '', remaining: '', trigger: '' };
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Modifier Name'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_mod_name',
                        value: modifier.name,
                        placeholder: 'e.g., Blessing of Strength'
                    })
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Effect'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_mod_effect',
                            value: modifier.effect || '',
                            placeholder: 'e.g., +5 STR'
                        })
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Value'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_mod_value',
                            value: modifier.value || '',
                            placeholder: 'e.g., 5'
                        })
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Type'),
                        h('select', { class: 'vmt_modal_select', id: 'vmt_mod_type' },
                            h('option', { value: 'buff', selected: modifier.type === 'buff' ? 'selected' : null }, 'Buff'),
                            h('option', { value: 'debuff', selected: modifier.type === 'debuff' ? 'selected' : null }, 'Debuff')
                        )
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Source'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_mod_source',
                            value: modifier.source || '',
                            placeholder: 'e.g., Holy amulet'
                        })
                    )
                )
            );
            if (modCat === 'temporary') {
                bodyEl.appendChild(
                    h('div', { class: 'vmt_modal_row' },
                        h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                            h('label', { class: 'vmt_modal_label' }, 'Duration'),
                            h('input', {
                                type: 'text',
                                class: 'vmt_modal_input',
                                id: 'vmt_mod_duration',
                                value: modifier.duration || '',
                                placeholder: 'e.g., 1 hour'
                            })
                        ),
                        h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                            h('label', { class: 'vmt_modal_label' }, 'Remaining'),
                            h('input', {
                                type: 'text',
                                class: 'vmt_modal_input',
                                id: 'vmt_mod_remaining',
                                value: modifier.remaining || '',
                                placeholder: 'e.g., 30 mins'
                            })
                        )
                    )
                );
            }
            if (modCat === 'conditional') {
                bodyEl.appendChild(
                    h('div', { class: 'vmt_modal_field' },
                        h('label', { class: 'vmt_modal_label' }, 'Trigger Condition'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_mod_trigger',
                            value: modifier.trigger || '',
                            placeholder: 'e.g., When HP below 50%'
                        })
                    )
                );
            }
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const newMod = {
                            name: document.getElementById('vmt_mod_name').value.trim(),
                            effect: document.getElementById('vmt_mod_effect').value.trim(),
                            value: document.getElementById('vmt_mod_value').value.trim(),
                            type: document.getElementById('vmt_mod_type').value,
                            source: document.getElementById('vmt_mod_source').value.trim()
                        };
                        if (modCat === 'temporary') {
                            newMod.duration = document.getElementById('vmt_mod_duration')?.value.trim() || '';
                            newMod.remaining = document.getElementById('vmt_mod_remaining')?.value.trim() || '';
                        }
                        if (modCat === 'conditional') {
                            newMod.trigger = document.getElementById('vmt_mod_trigger')?.value.trim() || '';
                        }
                        if (newMod.name) {
                            data.onSave(newMod);
                            closeModal();
                        }
                    }
                }, 'Save')
            );
            footerEl.appendChild(
                h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel')
            );
            break;

        // ===== Equipment Modal =====
        case 'view-equipment':
            titleEl.textContent = data.slotLabel || 'Equipment Slot';
            const equippedItem = data.item;
            if (equippedItem) {
                bodyEl.appendChild(
                    h('div', { class: 'vmt_modal_equipment_view' },
                        h('div', { class: `vmt_modal_item_name vmt_rarity_${equippedItem.rarity || 'common'}` }, equippedItem.name),
                        equippedItem.description ? h('div', { class: 'vmt_modal_item_desc' }, equippedItem.description) : null,
                        equippedItem.stats ? h('div', { class: 'vmt_modal_item_stats' },
                            h('span', { class: 'vmt_stats_label' }, 'Stats: '),
                            h('span', {}, equippedItem.stats)
                        ) : null,
                        h('div', { class: 'vmt_modal_item_meta' },
                            h('span', { class: 'vmt_item_rarity' }, (equippedItem.rarity || 'common').charAt(0).toUpperCase() + (equippedItem.rarity || 'common').slice(1)),
                            equippedItem.value ? h('span', { class: 'vmt_item_value' }, `Value: ${equippedItem.value}g`) : null
                        )
                    )
                );
                footerEl.appendChild(
                    h('button', {
                        class: 'vmt_btn vmt_btn_danger',
                        onclick: () => {
                            data.onUnequip();
                            closeModal();
                        }
                    }, 'Unequip')
                );
            } else {
                bodyEl.appendChild(h('div', { class: 'vmt_empty' }, 'No item equipped'));
            }
            footerEl.appendChild(
                h('button', { class: 'vmt_btn', onclick: closeModal }, 'Close')
            );
            break;

        case 'select-equipment':
            titleEl.textContent = `Equip to ${data.slotLabel || 'Slot'}`;
            const equipableItems = data.items || [];
            const itemListContainer = h('div', { class: 'vmt_modal_item_list' });
            if (equipableItems.length === 0) {
                itemListContainer.appendChild(h('div', { class: 'vmt_empty' }, 'No equippable items in inventory'));
            } else {
                equipableItems.forEach(item => {
                    itemListContainer.appendChild(
                        h('div', {
                            class: `vmt_modal_item_option vmt_rarity_${item.rarity || 'common'}`,
                            onclick: () => {
                                data.onSelect(item);
                                closeModal();
                            }
                        },
                            h('div', { class: 'vmt_item_option_name' }, item.name),
                            item.stats ? h('div', { class: 'vmt_item_option_stats' }, item.stats) : null
                        )
                    );
                });
            }
            bodyEl.appendChild(itemListContainer);
            footerEl.appendChild(
                h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel')
            );
            break;

        // ===== Inventory Item Modals =====
        case 'add-item':
        case 'edit-item':
            titleEl.textContent = type === 'add-item' ? 'Add Item' : 'Edit Item';
            const item = data.item || {
                name: '', quantity: 1, weight: 0, value: 0, category: 'Misc',
                description: '', rarity: 'common', equippable: false, slot: '', stats: ''
            };
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Item Name'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_item_name',
                        value: item.name,
                        placeholder: 'e.g., Iron Sword'
                    })
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Description'),
                    h('textarea', {
                        class: 'vmt_modal_textarea',
                        id: 'vmt_item_desc',
                        placeholder: 'Describe the item...'
                    }, item.description || '')
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_third' },
                        h('label', { class: 'vmt_modal_label' }, 'Quantity'),
                        h('input', {
                            type: 'number',
                            class: 'vmt_modal_input',
                            id: 'vmt_item_qty',
                            value: item.quantity || 1,
                            min: 1
                        })
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_third' },
                        h('label', { class: 'vmt_modal_label' }, 'Weight'),
                        h('input', {
                            type: 'number',
                            class: 'vmt_modal_input',
                            id: 'vmt_item_weight',
                            value: item.weight || 0,
                            min: 0,
                            step: 0.1
                        })
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_third' },
                        h('label', { class: 'vmt_modal_label' }, 'Value (g)'),
                        h('input', {
                            type: 'number',
                            class: 'vmt_modal_input',
                            id: 'vmt_item_value',
                            value: item.value || 0,
                            min: 0
                        })
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Category'),
                        h('select', { class: 'vmt_modal_select', id: 'vmt_item_category' },
                            ['Weapons', 'Armor', 'Consumables', 'Materials', 'Quest Items', 'Misc'].map(cat =>
                                h('option', { value: cat, selected: item.category === cat ? 'selected' : null }, cat)
                            )
                        )
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Rarity'),
                        h('select', { class: 'vmt_modal_select', id: 'vmt_item_rarity' },
                            ['common', 'uncommon', 'rare', 'epic', 'legendary'].map(r =>
                                h('option', { value: r, selected: item.rarity === r ? 'selected' : null }, r.charAt(0).toUpperCase() + r.slice(1))
                            )
                        )
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_checkbox_label' },
                        h('input', {
                            type: 'checkbox',
                            id: 'vmt_item_equippable',
                            checked: item.equippable ? 'checked' : null,
                            onchange: (e) => {
                                const slotField = document.getElementById('vmt_item_slot_field');
                                if (slotField) slotField.style.display = e.target.checked ? 'block' : 'none';
                            }
                        }),
                        h('span', {}, ' Equippable')
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field', id: 'vmt_item_slot_field', style: item.equippable ? '' : 'display: none' },
                    h('label', { class: 'vmt_modal_label' }, 'Equipment Slot'),
                    h('select', { class: 'vmt_modal_select', id: 'vmt_item_slot' },
                        [
                            { key: '', label: 'Select slot...' },
                            { key: 'head', label: 'Head' },
                            { key: 'chest', label: 'Chest' },
                            { key: 'hands', label: 'Hands' },
                            { key: 'legs', label: 'Legs' },
                            { key: 'feet', label: 'Feet' },
                            { key: 'back', label: 'Back' },
                            { key: 'mainHand', label: 'Main Hand' },
                            { key: 'offHand', label: 'Off Hand' },
                            { key: 'ring1', label: 'Ring' },
                            { key: 'ring2', label: 'Ring' },
                            { key: 'amulet', label: 'Amulet' },
                            { key: 'accessory1', label: 'Accessory' },
                            { key: 'accessory2', label: 'Accessory' },
                            { key: 'accessory3', label: 'Accessory' }
                        ].map(s =>
                            h('option', { value: s.key, selected: item.slot === s.key ? 'selected' : null }, s.label)
                        )
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Stats/Bonuses'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_item_stats',
                        value: item.stats || '',
                        placeholder: 'e.g., +5 Attack, +2 STR'
                    })
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const newItem = {
                            name: document.getElementById('vmt_item_name').value.trim(),
                            description: document.getElementById('vmt_item_desc').value.trim(),
                            quantity: parseInt(document.getElementById('vmt_item_qty').value, 10) || 1,
                            weight: parseFloat(document.getElementById('vmt_item_weight').value) || 0,
                            value: parseInt(document.getElementById('vmt_item_value').value, 10) || 0,
                            category: document.getElementById('vmt_item_category').value,
                            rarity: document.getElementById('vmt_item_rarity').value,
                            equippable: document.getElementById('vmt_item_equippable').checked,
                            slot: document.getElementById('vmt_item_slot').value,
                            stats: document.getElementById('vmt_item_stats').value.trim()
                        };
                        if (newItem.name) {
                            data.onSave(newItem);
                            closeModal();
                        }
                    }
                }, 'Save')
            );
            footerEl.appendChild(
                h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel')
            );
            break;

        case 'edit-currencies':
            titleEl.textContent = 'Edit Currencies';
            const currencies = data.currencies || { gold: 0, silver: 0, copper: 0, custom: [] };
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_third' },
                        h('label', { class: 'vmt_modal_label' }, 'Gold'),
                        h('input', {
                            type: 'number',
                            class: 'vmt_modal_input',
                            id: 'vmt_curr_gold',
                            value: currencies.gold || 0,
                            min: 0
                        })
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_third' },
                        h('label', { class: 'vmt_modal_label' }, 'Silver'),
                        h('input', {
                            type: 'number',
                            class: 'vmt_modal_input',
                            id: 'vmt_curr_silver',
                            value: currencies.silver || 0,
                            min: 0
                        })
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_third' },
                        h('label', { class: 'vmt_modal_label' }, 'Copper'),
                        h('input', {
                            type: 'number',
                            class: 'vmt_modal_input',
                            id: 'vmt_curr_copper',
                            value: currencies.copper || 0,
                            min: 0
                        })
                    )
                )
            );
            // Custom currencies section
            const customList = [...(currencies.custom || [])];
            const customContainer = h('div', { class: 'vmt_custom_currencies' },
                h('div', { class: 'vmt_modal_label' }, 'Custom Currencies')
            );
            const customListEl = h('div', { class: 'vmt_custom_list' });
            const renderCustomList = () => {
                customListEl.innerHTML = '';
                customList.forEach((cc, i) => {
                    customListEl.appendChild(
                        h('div', { class: 'vmt_custom_currency_row' },
                            h('input', {
                                type: 'text',
                                class: 'vmt_modal_input',
                                value: cc.name,
                                placeholder: 'Name',
                                onchange: (e) => { customList[i].name = e.target.value; }
                            }),
                            h('input', {
                                type: 'number',
                                class: 'vmt_modal_input',
                                value: cc.amount,
                                min: 0,
                                onchange: (e) => { customList[i].amount = parseInt(e.target.value, 10) || 0; }
                            }),
                            h('button', {
                                class: 'vmt_btn_icon vmt_btn_danger',
                                onclick: () => {
                                    customList.splice(i, 1);
                                    renderCustomList();
                                }
                            }, '')
                        )
                    );
                });
            };
            renderCustomList();
            customContainer.appendChild(customListEl);
            customContainer.appendChild(
                h('button', {
                    class: 'vmt_btn_small vmt_btn_add',
                    onclick: () => {
                        customList.push({ name: '', amount: 0 });
                        renderCustomList();
                    }
                }, '+ Add Currency')
            );
            bodyEl.appendChild(customContainer);
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        data.onSave({
                            gold: parseInt(document.getElementById('vmt_curr_gold').value, 10) || 0,
                            silver: parseInt(document.getElementById('vmt_curr_silver').value, 10) || 0,
                            copper: parseInt(document.getElementById('vmt_curr_copper').value, 10) || 0,
                            custom: customList.filter(c => c.name.trim())
                        });
                        closeModal();
                    }
                }, 'Save')
            );
            footerEl.appendChild(
                h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel')
            );
            break;

        // ===== Reputation Modals =====
        case 'add-faction':
        case 'edit-faction':
            titleEl.textContent = type === 'add-faction' ? 'Add Faction' : 'Edit Faction';
            const faction = data.faction || { name: '', score: 0 };
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Faction Name'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_faction_name',
                        value: faction.name,
                        placeholder: 'e.g., The Silver Hand'
                    })
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Starting Reputation Score (-100 to 100)'),
                    h('input', {
                        type: 'number',
                        class: 'vmt_modal_input',
                        id: 'vmt_faction_score',
                        value: faction.score || 0,
                        min: -100,
                        max: 100
                    })
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const newFaction = {
                            name: document.getElementById('vmt_faction_name').value.trim(),
                            score: parseInt(document.getElementById('vmt_faction_score').value, 10) || 0
                        };
                        if (newFaction.name) {
                            data.onSave(newFaction);
                            closeModal();
                        }
                    }
                }, 'Save')
            );
            footerEl.appendChild(
                h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel')
            );
            break;

        case 'add-reputation-change':
            titleEl.textContent = `Add Reputation Change - ${data.faction?.name || 'Faction'}`;
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Current Score'),
                    h('div', { class: 'vmt_modal_current_score' }, String(data.faction?.score || 0))
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Change Amount'),
                    h('input', {
                        type: 'number',
                        class: 'vmt_modal_input',
                        id: 'vmt_rep_change',
                        value: 0,
                        min: -200,
                        max: 200,
                        placeholder: 'e.g., +10 or -5'
                    })
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Reason'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_rep_reason',
                        placeholder: 'e.g., Completed quest for the guild'
                    })
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const change = parseInt(document.getElementById('vmt_rep_change').value, 10) || 0;
                        const reason = document.getElementById('vmt_rep_reason').value.trim() || 'No reason given';
                        data.onSave({ change, reason });
                        closeModal();
                    }
                }, 'Apply')
            );
            footerEl.appendChild(
                h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel')
            );
            break;

        case 'view-reputation-history':
            titleEl.textContent = `History - ${data.faction?.name || 'Faction'}`;
            const historyList = h('div', { class: 'vmt_reputation_history_list' });
            const history = data.faction?.history || [];
            if (history.length === 0) {
                historyList.appendChild(h('div', { class: 'vmt_empty' }, 'No history recorded'));
            } else {
                history.forEach(entry => {
                    const date = new Date(entry.timestamp);
                    historyList.appendChild(
                        h('div', { class: 'vmt_history_item' },
                            h('div', { class: 'vmt_history_header' },
                                h('span', { class: `vmt_history_change ${entry.change >= 0 ? 'positive' : 'negative'}` },
                                    `${entry.change >= 0 ? '+' : ''}${entry.change}`
                                ),
                                h('span', { class: 'vmt_history_scores' }, `${entry.previousScore} → ${entry.newScore}`)
                            ),
                            h('div', { class: 'vmt_history_reason' }, entry.reason),
                            h('div', { class: 'vmt_history_date' }, date.toLocaleString())
                        )
                    );
                });
            }
            bodyEl.appendChild(historyList);
            footerEl.appendChild(
                h('button', { class: 'vmt_btn', onclick: closeModal }, 'Close')
            );
            break;

        // ===== Companion Modals =====
        case 'add-companion':
        case 'edit-companion':
            titleEl.textContent = type === 'add-companion' ? 'Add Companion' : 'Edit Companion';
            const companion = data.companion || {
                name: '', type: 'Pet', status: 'With Party',
                hp: { current: 10, max: 10 }, attack: '', defense: '',
                abilities: '', bond: 50, portrait: '', notes: ''
            };
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Name'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_companion_name',
                        value: companion.name,
                        placeholder: 'e.g., Shadow'
                    })
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Type'),
                        h('select', { class: 'vmt_modal_select', id: 'vmt_companion_type' },
                            ['Pet', 'Summon', 'Hireling', 'Mount'].map(t =>
                                h('option', { value: t, selected: companion.type === t ? 'selected' : null }, t)
                            )
                        )
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Status'),
                        h('select', { class: 'vmt_modal_select', id: 'vmt_companion_status' },
                            ['With Party', 'Stabled', 'Dismissed', 'Dead', 'Missing'].map(s =>
                                h('option', { value: s, selected: companion.status === s ? 'selected' : null }, s)
                            )
                        )
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_third' },
                        h('label', { class: 'vmt_modal_label' }, 'Current HP'),
                        h('input', {
                            type: 'number',
                            class: 'vmt_modal_input',
                            id: 'vmt_companion_hp_current',
                            value: companion.hp?.current || 10,
                            min: 0
                        })
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_third' },
                        h('label', { class: 'vmt_modal_label' }, 'Max HP'),
                        h('input', {
                            type: 'number',
                            class: 'vmt_modal_input',
                            id: 'vmt_companion_hp_max',
                            value: companion.hp?.max || 10,
                            min: 1
                        })
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_third' },
                        h('label', { class: 'vmt_modal_label' }, 'Bond (0-100)'),
                        h('input', {
                            type: 'number',
                            class: 'vmt_modal_input',
                            id: 'vmt_companion_bond',
                            value: companion.bond || 50,
                            min: 0,
                            max: 100
                        })
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Attack'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_companion_attack',
                            value: companion.attack || '',
                            placeholder: 'e.g., 1d6+2'
                        })
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Defense'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_companion_defense',
                            value: companion.defense || '',
                            placeholder: 'e.g., 12'
                        })
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Abilities'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_companion_abilities',
                        value: companion.abilities || '',
                        placeholder: 'e.g., Bite, Track, Night Vision'
                    })
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Portrait URL'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_companion_portrait',
                        value: companion.portrait || '',
                        placeholder: 'https://...'
                    })
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Notes'),
                    h('textarea', {
                        class: 'vmt_modal_textarea',
                        id: 'vmt_companion_notes',
                        placeholder: 'Additional notes...'
                    }, companion.notes || '')
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const newCompanion = {
                            name: document.getElementById('vmt_companion_name').value.trim(),
                            type: document.getElementById('vmt_companion_type').value,
                            status: document.getElementById('vmt_companion_status').value,
                            hp: {
                                current: parseInt(document.getElementById('vmt_companion_hp_current').value, 10) || 10,
                                max: parseInt(document.getElementById('vmt_companion_hp_max').value, 10) || 10
                            },
                            bond: parseInt(document.getElementById('vmt_companion_bond').value, 10) || 50,
                            attack: document.getElementById('vmt_companion_attack').value.trim(),
                            defense: document.getElementById('vmt_companion_defense').value.trim(),
                            abilities: document.getElementById('vmt_companion_abilities').value.trim(),
                            portrait: document.getElementById('vmt_companion_portrait').value.trim(),
                            notes: document.getElementById('vmt_companion_notes').value.trim()
                        };
                        if (newCompanion.name) {
                            data.onSave(newCompanion);
                            closeModal();
                        }
                    }
                }, 'Save')
            );
            footerEl.appendChild(
                h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel')
            );
            break;

        // ===== Achievement Modals =====
        case 'add-achievement':
        case 'edit-achievement':
            titleEl.textContent = type === 'add-achievement' ? 'Add Achievement' : 'Edit Achievement';
            const achievement = data.achievement || {
                name: '', description: '', category: 'Combat',
                progressMax: 0, rewards: ''
            };
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Achievement Name'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_achievement_name',
                        value: achievement.name,
                        placeholder: 'e.g., Dragon Slayer'
                    })
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Description'),
                    h('textarea', {
                        class: 'vmt_modal_textarea',
                        id: 'vmt_achievement_desc',
                        placeholder: 'Describe the achievement...'
                    }, achievement.description || '')
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Category'),
                        h('select', { class: 'vmt_modal_select', id: 'vmt_achievement_category' },
                            ['Combat', 'Exploration', 'Social', 'Crafting', 'Hidden'].map(cat =>
                                h('option', { value: cat, selected: achievement.category === cat ? 'selected' : null }, cat)
                            )
                        )
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Progress Max (0 = no tracking)'),
                        h('input', {
                            type: 'number',
                            class: 'vmt_modal_input',
                            id: 'vmt_achievement_progress',
                            value: achievement.progressMax || 0,
                            min: 0
                        })
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Rewards'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_achievement_rewards',
                        value: achievement.rewards || '',
                        placeholder: 'e.g., +10 STR, Dragon Title'
                    })
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const newAchievement = {
                            name: document.getElementById('vmt_achievement_name').value.trim(),
                            description: document.getElementById('vmt_achievement_desc').value.trim(),
                            category: document.getElementById('vmt_achievement_category').value,
                            progressMax: parseInt(document.getElementById('vmt_achievement_progress').value, 10) || 0,
                            rewards: document.getElementById('vmt_achievement_rewards').value.trim()
                        };
                        if (newAchievement.name) {
                            data.onSave(newAchievement);
                            closeModal();
                        }
                    }
                }, 'Save')
            );
            footerEl.appendChild(
                h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel')
            );
            break;

        // ===== Affinity Modals =====
        case 'add-affinity':
            titleEl.textContent = 'Add Custom Affinity';
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Affinity Name'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_affinity_name',
                        placeholder: 'e.g., Void, Psychic, Blood'
                    })
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Starting Value (0-100)'),
                        h('input', {
                            type: 'number',
                            class: 'vmt_modal_input',
                            id: 'vmt_affinity_value',
                            value: 0,
                            min: 0,
                            max: 100
                        })
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Color'),
                        h('input', {
                            type: 'color',
                            class: 'vmt_modal_input vmt_color_input',
                            id: 'vmt_affinity_color',
                            value: '#888888'
                        })
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Notes/Effects'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_affinity_notes',
                        placeholder: 'What this affinity affects...'
                    })
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const newAffinity = {
                            name: document.getElementById('vmt_affinity_name').value.trim(),
                            value: parseInt(document.getElementById('vmt_affinity_value').value, 10) || 0,
                            color: document.getElementById('vmt_affinity_color').value,
                            notes: document.getElementById('vmt_affinity_notes').value.trim()
                        };
                        if (newAffinity.name) {
                            data.onSave(newAffinity);
                            closeModal();
                        }
                    }
                }, 'Add')
            );
            footerEl.appendChild(
                h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel')
            );
            break;

        // ===== Contract Modals =====
        case 'add-contract':
        case 'edit-contract':
            titleEl.textContent = type === 'add-contract' ? 'Add Contract' : 'Edit Contract';
            const contract = data.contract || {
                name: '', type: 'Quest', contractor: '', description: '',
                objectives: [], rewards: '', penalties: '', deadline: '', status: 'Active'
            };
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Contract Name'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_contract_name',
                        value: contract.name,
                        placeholder: 'e.g., Slay the Dragon'
                    })
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Type'),
                        h('select', { class: 'vmt_modal_select', id: 'vmt_contract_type' },
                            ['Quest', 'Pact', 'Debt', 'Service', 'Other'].map(t =>
                                h('option', { value: t, selected: contract.type === t ? 'selected' : null }, t)
                            )
                        )
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Contractor'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_contract_contractor',
                            value: contract.contractor || '',
                            placeholder: 'Who assigned this'
                        })
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Description'),
                    h('textarea', {
                        class: 'vmt_modal_textarea',
                        id: 'vmt_contract_desc',
                        placeholder: 'Contract details...'
                    }, contract.description || '')
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Objectives (one per line)'),
                    h('textarea', {
                        class: 'vmt_modal_textarea',
                        id: 'vmt_contract_objectives',
                        placeholder: 'Find the cave\nDefeat the monster\nReturn with proof'
                    }, (contract.objectives || []).map(o => o.text).join('\n'))
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Rewards'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_contract_rewards',
                            value: contract.rewards || '',
                            placeholder: '500 gold, rare item'
                        })
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Penalties'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_contract_penalties',
                            value: contract.penalties || '',
                            placeholder: 'Loss of reputation'
                        })
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Deadline (optional)'),
                    h('input', {
                        type: 'datetime-local',
                        class: 'vmt_modal_input',
                        id: 'vmt_contract_deadline',
                        value: contract.deadline || ''
                    })
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const objectivesText = document.getElementById('vmt_contract_objectives').value.trim();
                        const objectiveLines = objectivesText ? objectivesText.split('\n').filter(l => l.trim()) : [];
                        const existingObjectives = contract.objectives || [];
                        const newContract = {
                            name: document.getElementById('vmt_contract_name').value.trim(),
                            type: document.getElementById('vmt_contract_type').value,
                            contractor: document.getElementById('vmt_contract_contractor').value.trim(),
                            description: document.getElementById('vmt_contract_desc').value.trim(),
                            objectives: objectiveLines.map((text, i) => ({
                                text: text.trim(),
                                completed: existingObjectives[i]?.text === text.trim() ? existingObjectives[i].completed : false
                            })),
                            rewards: document.getElementById('vmt_contract_rewards').value.trim(),
                            penalties: document.getElementById('vmt_contract_penalties').value.trim(),
                            deadline: document.getElementById('vmt_contract_deadline').value || null,
                            status: contract.status || 'Active'
                        };
                        if (newContract.name) {
                            data.onSave(newContract);
                            closeModal();
                        }
                    }
                }, 'Save')
            );
            footerEl.appendChild(
                h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel')
            );
            break;

        // ===== Property Modals =====
        case 'add-property':
        case 'edit-property':
            titleEl.textContent = type === 'add-property' ? 'Add Property' : 'Edit Property';
            const property = data.property || {
                name: '', type: 'Home', location: '', description: '',
                value: 0, income: 0, expenses: 0, staff: [], upgrades: [], notes: ''
            };
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Property Name'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_property_name',
                        value: property.name,
                        placeholder: 'e.g., Riverside Manor'
                    })
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Type'),
                        h('select', { class: 'vmt_modal_select', id: 'vmt_property_type' },
                            ['Home', 'Shop', 'Land', 'Business', 'Stronghold', 'Other'].map(t =>
                                h('option', { value: t, selected: property.type === t ? 'selected' : null }, t)
                            )
                        )
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Location'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_property_location',
                            value: property.location || '',
                            placeholder: 'City/Region'
                        })
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Description'),
                    h('textarea', {
                        class: 'vmt_modal_textarea',
                        id: 'vmt_property_desc',
                        placeholder: 'Property details...'
                    }, property.description || '')
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_third' },
                        h('label', { class: 'vmt_modal_label' }, 'Value (gold)'),
                        h('input', {
                            type: 'number',
                            class: 'vmt_modal_input',
                            id: 'vmt_property_value',
                            value: property.value || 0,
                            min: 0
                        })
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_third' },
                        h('label', { class: 'vmt_modal_label' }, 'Income/period'),
                        h('input', {
                            type: 'number',
                            class: 'vmt_modal_input',
                            id: 'vmt_property_income',
                            value: property.income || 0,
                            min: 0
                        })
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_third' },
                        h('label', { class: 'vmt_modal_label' }, 'Expenses/period'),
                        h('input', {
                            type: 'number',
                            class: 'vmt_modal_input',
                            id: 'vmt_property_expenses',
                            value: property.expenses || 0,
                            min: 0
                        })
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Staff (name:role, one per line)'),
                    h('textarea', {
                        class: 'vmt_modal_textarea',
                        id: 'vmt_property_staff',
                        placeholder: 'John:Butler\nMary:Cook'
                    }, (property.staff || []).map(s => `${s.name}:${s.role}`).join('\n'))
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Upgrades (one per line)'),
                    h('textarea', {
                        class: 'vmt_modal_textarea',
                        id: 'vmt_property_upgrades',
                        placeholder: 'Stone walls\nWell\nStables'
                    }, (property.upgrades || []).join('\n'))
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Notes'),
                    h('textarea', {
                        class: 'vmt_modal_textarea',
                        id: 'vmt_property_notes',
                        placeholder: 'Additional notes...'
                    }, property.notes || '')
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const staffText = document.getElementById('vmt_property_staff').value.trim();
                        const staffLines = staffText ? staffText.split('\n').filter(l => l.includes(':')) : [];
                        const upgradesText = document.getElementById('vmt_property_upgrades').value.trim();
                        const upgradeLines = upgradesText ? upgradesText.split('\n').filter(l => l.trim()) : [];
                        const newProperty = {
                            name: document.getElementById('vmt_property_name').value.trim(),
                            type: document.getElementById('vmt_property_type').value,
                            location: document.getElementById('vmt_property_location').value.trim(),
                            description: document.getElementById('vmt_property_desc').value.trim(),
                            value: parseInt(document.getElementById('vmt_property_value').value, 10) || 0,
                            income: parseInt(document.getElementById('vmt_property_income').value, 10) || 0,
                            expenses: parseInt(document.getElementById('vmt_property_expenses').value, 10) || 0,
                            staff: staffLines.map(line => {
                                const [name, role] = line.split(':');
                                return { name: name.trim(), role: (role || '').trim() };
                            }),
                            upgrades: upgradeLines.map(l => l.trim()),
                            notes: document.getElementById('vmt_property_notes').value.trim()
                        };
                        if (newProperty.name) {
                            data.onSave(newProperty);
                            closeModal();
                        }
                    }
                }, 'Save')
            );
            footerEl.appendChild(
                h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel')
            );
            break;

        // ===== Transformation Modals =====
        case 'add-transformation':
        case 'edit-transformation':
            titleEl.textContent = type === 'add-transformation' ? 'Add Transformation' : 'Edit Transformation';
            const transformation = data.transformation || {
                name: '', type: 'Magical', source: '', description: '',
                effects: [], duration: 'Permanent', expiresAt: null,
                reversible: false, reversalMethod: '', active: true
            };
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Transformation Name'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_transform_name',
                        value: transformation.name,
                        placeholder: 'e.g., Werewolf Curse'
                    })
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Type'),
                        h('select', { class: 'vmt_modal_select', id: 'vmt_transform_type' },
                            ['Racial', 'Curse', 'Blessing', 'Magical', 'Class', 'Other'].map(t =>
                                h('option', { value: t, selected: transformation.type === t ? 'selected' : null }, t)
                            )
                        )
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Duration'),
                        h('select', { class: 'vmt_modal_select', id: 'vmt_transform_duration' },
                            ['Permanent', 'Temporary', 'Conditional'].map(d =>
                                h('option', { value: d, selected: transformation.duration === d ? 'selected' : null }, d)
                            )
                        )
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Source'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_transform_source',
                        value: transformation.source || '',
                        placeholder: 'What caused this transformation'
                    })
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Description'),
                    h('textarea', {
                        class: 'vmt_modal_textarea',
                        id: 'vmt_transform_desc',
                        placeholder: 'Transformation details...'
                    }, transformation.description || '')
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Effects (one per line)'),
                    h('textarea', {
                        class: 'vmt_modal_textarea',
                        id: 'vmt_transform_effects',
                        placeholder: '+5 STR\n-2 CHA\nDarkvision 60ft'
                    }, (transformation.effects || []).join('\n'))
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Expires At (for temporary)'),
                    h('input', {
                        type: 'datetime-local',
                        class: 'vmt_modal_input',
                        id: 'vmt_transform_expires',
                        value: transformation.expiresAt || ''
                    })
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_checkbox_label' },
                        h('input', {
                            type: 'checkbox',
                            id: 'vmt_transform_reversible',
                            checked: transformation.reversible ? 'checked' : null
                        }),
                        'Reversible'
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Reversal Method'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_transform_reversal',
                        value: transformation.reversalMethod || '',
                        placeholder: 'How to reverse (if reversible)'
                    })
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const effectsText = document.getElementById('vmt_transform_effects').value.trim();
                        const effectLines = effectsText ? effectsText.split('\n').filter(l => l.trim()) : [];
                        const newTransformation = {
                            name: document.getElementById('vmt_transform_name').value.trim(),
                            type: document.getElementById('vmt_transform_type').value,
                            duration: document.getElementById('vmt_transform_duration').value,
                            source: document.getElementById('vmt_transform_source').value.trim(),
                            description: document.getElementById('vmt_transform_desc').value.trim(),
                            effects: effectLines.map(l => l.trim()),
                            expiresAt: document.getElementById('vmt_transform_expires').value || null,
                            reversible: document.getElementById('vmt_transform_reversible').checked,
                            reversalMethod: document.getElementById('vmt_transform_reversal').value.trim(),
                            active: transformation.active !== undefined ? transformation.active : true
                        };
                        if (newTransformation.name) {
                            data.onSave(newTransformation);
                            closeModal();
                        }
                    }
                }, 'Save')
            );
            footerEl.appendChild(
                h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel')
            );
            break;

        // ===== Bounty Modals =====
        case 'add-bounty':
        case 'edit-bounty':
            titleEl.textContent = type === 'add-bounty' ? 'Add Bounty' : 'Edit Bounty';
            const bounty = data.bounty || {
                issuer: '', amount: 0, reason: '', region: '',
                status: 'Active', hunters: [], notes: ''
            };
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Issuer'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_bounty_issuer',
                            value: bounty.issuer,
                            placeholder: 'Who placed the bounty'
                        })
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Amount (gold)'),
                        h('input', {
                            type: 'number',
                            class: 'vmt_modal_input',
                            id: 'vmt_bounty_amount',
                            value: bounty.amount || 0,
                            min: 0
                        })
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Reason'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_bounty_reason',
                        value: bounty.reason || '',
                        placeholder: 'Why the bounty was placed'
                    })
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Region'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_bounty_region',
                        value: bounty.region || '',
                        placeholder: 'Where bounty is active'
                    })
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Known Hunters (one per line)'),
                    h('textarea', {
                        class: 'vmt_modal_textarea',
                        id: 'vmt_bounty_hunters',
                        placeholder: 'The Shadow\nIron Blade Guild'
                    }, (bounty.hunters || []).join('\n'))
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Notes'),
                    h('textarea', {
                        class: 'vmt_modal_textarea',
                        id: 'vmt_bounty_notes',
                        placeholder: 'Additional notes...'
                    }, bounty.notes || '')
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const huntersText = document.getElementById('vmt_bounty_hunters').value.trim();
                        const hunterLines = huntersText ? huntersText.split('\n').filter(l => l.trim()) : [];
                        const newBounty = {
                            issuer: document.getElementById('vmt_bounty_issuer').value.trim(),
                            amount: parseInt(document.getElementById('vmt_bounty_amount').value, 10) || 0,
                            reason: document.getElementById('vmt_bounty_reason').value.trim(),
                            region: document.getElementById('vmt_bounty_region').value.trim(),
                            hunters: hunterLines.map(l => l.trim()),
                            notes: document.getElementById('vmt_bounty_notes').value.trim(),
                            status: bounty.status || 'Active'
                        };
                        if (newBounty.issuer) {
                            data.onSave(newBounty);
                            closeModal();
                        }
                    }
                }, 'Save')
            );
            footerEl.appendChild(
                h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel')
            );
            break;

        // ===== LEGACY MODALS =====
        case 'add-bloodline-trait':
            titleEl.textContent = 'Add Bloodline Trait';
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Inherited Trait'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_bloodline_trait',
                        placeholder: 'e.g., Dragon Blood, Night Vision'
                    })
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const trait = document.getElementById('vmt_bloodline_trait').value.trim();
                        if (trait) {
                            const state = getState();
                            const traits = [...((state.legacy?.bloodline?.traits) || []), trait];
                            updateField('legacy.bloodline.traits', traits);
                            closeModal();
                        }
                    }
                }, 'Add')
            );
            footerEl.appendChild(h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel'));
            break;

        case 'add-bloodline-curse':
            titleEl.textContent = 'Add Bloodline Curse';
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Curse Name'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_bloodline_curse',
                        placeholder: 'e.g., Blood Madness, Sunlight Weakness'
                    })
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const curse = document.getElementById('vmt_bloodline_curse').value.trim();
                        if (curse) {
                            const state = getState();
                            const curses = [...((state.legacy?.bloodline?.curses) || []), curse];
                            updateField('legacy.bloodline.curses', curses);
                            closeModal();
                        }
                    }
                }, 'Add')
            );
            footerEl.appendChild(h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel'));
            break;

        case 'add-bloodline-blessing':
            titleEl.textContent = 'Add Bloodline Blessing';
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Blessing Name'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_bloodline_blessing',
                        placeholder: 'e.g., Divine Favor, Ancestral Protection'
                    })
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const blessing = document.getElementById('vmt_bloodline_blessing').value.trim();
                        if (blessing) {
                            const state = getState();
                            const blessings = [...((state.legacy?.bloodline?.blessings) || []), blessing];
                            updateField('legacy.bloodline.blessings', blessings);
                            closeModal();
                        }
                    }
                }, 'Add')
            );
            footerEl.appendChild(h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel'));
            break;

        case 'add-ancestor':
        case 'edit-ancestor':
            titleEl.textContent = type === 'add-ancestor' ? 'Add Ancestor' : 'Edit Ancestor';
            const ancestor = data.ancestor || { name: '', relation: '', notes: '' };
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Name'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_ancestor_name',
                            value: ancestor.name,
                            placeholder: 'Ancestor name'
                        })
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Relation'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_ancestor_relation',
                            value: ancestor.relation,
                            placeholder: 'e.g., Great-grandfather'
                        })
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Notes'),
                    h('textarea', {
                        class: 'vmt_modal_textarea',
                        id: 'vmt_ancestor_notes',
                        placeholder: 'Notable deeds or history...'
                    }, ancestor.notes || '')
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const newAncestor = {
                            name: document.getElementById('vmt_ancestor_name').value.trim(),
                            relation: document.getElementById('vmt_ancestor_relation').value.trim(),
                            notes: document.getElementById('vmt_ancestor_notes').value.trim()
                        };
                        if (newAncestor.name) {
                            data.onSave(newAncestor);
                            closeModal();
                        }
                    }
                }, 'Save')
            );
            footerEl.appendChild(h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel'));
            break;

        case 'add-heir':
        case 'edit-heir':
            titleEl.textContent = type === 'add-heir' ? 'Add Heir' : 'Edit Heir';
            const heir = data.heir || { name: '', relation: '', age: '', status: 'Alive', notes: '' };
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Name'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_heir_name',
                            value: heir.name,
                            placeholder: 'Heir name'
                        })
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Relation'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_heir_relation',
                            value: heir.relation,
                            placeholder: 'e.g., Son, Daughter'
                        })
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Age'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_heir_age',
                            value: heir.age || '',
                            placeholder: 'e.g., 12'
                        })
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Status'),
                        h('select', {
                            class: 'vmt_modal_select',
                            id: 'vmt_heir_status'
                        },
                            ['Alive', 'Deceased', 'Missing', 'Estranged'].map(s =>
                                h('option', { value: s, selected: heir.status === s }, s)
                            )
                        )
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Notes'),
                    h('textarea', {
                        class: 'vmt_modal_textarea',
                        id: 'vmt_heir_notes',
                        placeholder: 'Additional notes...'
                    }, heir.notes || '')
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const newHeir = {
                            name: document.getElementById('vmt_heir_name').value.trim(),
                            relation: document.getElementById('vmt_heir_relation').value.trim(),
                            age: document.getElementById('vmt_heir_age').value.trim(),
                            status: document.getElementById('vmt_heir_status').value,
                            notes: document.getElementById('vmt_heir_notes').value.trim()
                        };
                        if (newHeir.name) {
                            data.onSave(newHeir);
                            closeModal();
                        }
                    }
                }, 'Save')
            );
            footerEl.appendChild(h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel'));
            break;

        case 'add-deed':
        case 'edit-deed':
            titleEl.textContent = type === 'add-deed' ? 'Add Legacy Deed' : 'Edit Legacy Deed';
            const deed = data.deed || { name: '', description: '', date: '', impact: 'Local' };
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Deed Name'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_deed_name',
                        value: deed.name,
                        placeholder: 'e.g., Slayed the Dragon of Ashmore'
                    })
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Date'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_deed_date',
                            value: deed.date || '',
                            placeholder: 'e.g., Year 1042'
                        })
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Impact'),
                        h('select', {
                            class: 'vmt_modal_select',
                            id: 'vmt_deed_impact'
                        },
                            ['Local', 'Regional', 'National', 'Continental', 'World'].map(s =>
                                h('option', { value: s, selected: deed.impact === s }, s)
                            )
                        )
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Description'),
                    h('textarea', {
                        class: 'vmt_modal_textarea',
                        id: 'vmt_deed_description',
                        placeholder: 'What happened and why it mattered...'
                    }, deed.description || '')
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const newDeed = {
                            name: document.getElementById('vmt_deed_name').value.trim(),
                            date: document.getElementById('vmt_deed_date').value.trim(),
                            impact: document.getElementById('vmt_deed_impact').value,
                            description: document.getElementById('vmt_deed_description').value.trim()
                        };
                        if (newDeed.name) {
                            data.onSave(newDeed);
                            closeModal();
                        }
                    }
                }, 'Save')
            );
            footerEl.appendChild(h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel'));
            break;

        case 'add-inheritance':
        case 'edit-inheritance':
            titleEl.textContent = type === 'add-inheritance' ? 'Add Inheritance Item' : 'Edit Inheritance Item';
            const inheritItem = data.inheritItem || { item: '', recipient: '', conditions: '' };
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Item'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_inherit_item',
                            value: inheritItem.item,
                            placeholder: 'Item to inherit'
                        })
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Recipient'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_inherit_recipient',
                            value: inheritItem.recipient,
                            placeholder: 'Who receives it'
                        })
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Conditions (optional)'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_inherit_conditions',
                        value: inheritItem.conditions || '',
                        placeholder: 'e.g., Upon reaching adulthood'
                    })
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const newItem = {
                            item: document.getElementById('vmt_inherit_item').value.trim(),
                            recipient: document.getElementById('vmt_inherit_recipient').value.trim(),
                            conditions: document.getElementById('vmt_inherit_conditions').value.trim()
                        };
                        if (newItem.item && newItem.recipient) {
                            data.onSave(newItem);
                            closeModal();
                        }
                    }
                }, 'Save')
            );
            footerEl.appendChild(h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel'));
            break;

        case 'add-house-ally':
            titleEl.textContent = 'Add Allied House';
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'House Name'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_house_ally',
                        placeholder: 'e.g., House Brightwater'
                    })
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const ally = document.getElementById('vmt_house_ally').value.trim();
                        if (ally) {
                            const state = getState();
                            const allies = [...((state.legacy?.house?.allies) || []), ally];
                            updateField('legacy.house.allies', allies);
                            closeModal();
                        }
                    }
                }, 'Add')
            );
            footerEl.appendChild(h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel'));
            break;

        case 'add-house-enemy':
            titleEl.textContent = 'Add Rival House';
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'House Name'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_modal_input',
                        id: 'vmt_house_enemy',
                        placeholder: 'e.g., House Darkmore'
                    })
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const enemy = document.getElementById('vmt_house_enemy').value.trim();
                        if (enemy) {
                            const state = getState();
                            const enemies = [...((state.legacy?.house?.enemies) || []), enemy];
                            updateField('legacy.house.enemies', enemies);
                            closeModal();
                        }
                    }
                }, 'Add')
            );
            footerEl.appendChild(h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel'));
            break;

        // ===== SURVIVAL METERS MODALS =====
        case 'add-custom-meter':
        case 'edit-custom-meter':
            titleEl.textContent = type === 'add-custom-meter' ? 'Add Custom Meter' : 'Edit Custom Meter';
            const customMeter = data.meter || {
                name: '', current: 100, max: 100, color: '#b380ff',
                criticalThreshold: 20, description: ''
            };
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Meter Name'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_modal_input',
                            id: 'vmt_meter_name',
                            value: customMeter.name,
                            placeholder: 'e.g., Mana Corruption'
                        })
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_half' },
                        h('label', { class: 'vmt_modal_label' }, 'Bar Color'),
                        h('input', {
                            type: 'color',
                            class: 'vmt_modal_input vmt_color_input',
                            id: 'vmt_meter_color',
                            value: customMeter.color || '#b380ff'
                        })
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_row' },
                    h('div', { class: 'vmt_modal_field vmt_modal_field_third' },
                        h('label', { class: 'vmt_modal_label' }, 'Current'),
                        h('input', {
                            type: 'number',
                            class: 'vmt_modal_input',
                            id: 'vmt_meter_current',
                            value: customMeter.current,
                            min: 0
                        })
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_third' },
                        h('label', { class: 'vmt_modal_label' }, 'Max'),
                        h('input', {
                            type: 'number',
                            class: 'vmt_modal_input',
                            id: 'vmt_meter_max',
                            value: customMeter.max,
                            min: 1
                        })
                    ),
                    h('div', { class: 'vmt_modal_field vmt_modal_field_third' },
                        h('label', { class: 'vmt_modal_label' }, 'Critical %'),
                        h('input', {
                            type: 'number',
                            class: 'vmt_modal_input',
                            id: 'vmt_meter_critical',
                            value: customMeter.criticalThreshold,
                            min: 0,
                            max: 100
                        })
                    )
                )
            );
            bodyEl.appendChild(
                h('div', { class: 'vmt_modal_field' },
                    h('label', { class: 'vmt_modal_label' }, 'Description'),
                    h('textarea', {
                        class: 'vmt_modal_textarea',
                        id: 'vmt_meter_description',
                        placeholder: 'What does this meter represent?'
                    }, customMeter.description || '')
                )
            );
            footerEl.appendChild(
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: () => {
                        const newMeter = {
                            id: customMeter.id || (Date.now().toString(36) + Math.random().toString(36).substr(2, 9)),
                            name: document.getElementById('vmt_meter_name').value.trim(),
                            current: parseInt(document.getElementById('vmt_meter_current').value, 10) || 100,
                            max: parseInt(document.getElementById('vmt_meter_max').value, 10) || 100,
                            color: document.getElementById('vmt_meter_color').value,
                            criticalThreshold: parseInt(document.getElementById('vmt_meter_critical').value, 10) || 20,
                            description: document.getElementById('vmt_meter_description').value.trim()
                        };
                        if (newMeter.name) {
                            const state = getState();
                            const custom = [...((state.survivalMeters?.custom) || [])];
                            if (type === 'edit-custom-meter' && data.index !== undefined) {
                                custom[data.index] = newMeter;
                            } else {
                                custom.push(newMeter);
                            }
                            updateField('survivalMeters.custom', custom);
                            closeModal();
                        }
                    }
                }, 'Save')
            );
            footerEl.appendChild(h('button', { class: 'vmt_btn', onclick: closeModal }, 'Cancel'));
            break;

        default:
            titleEl.textContent = 'Modal';
            bodyEl.textContent = 'Unknown modal type';
    }

    modal.setAttribute('aria-hidden', 'false');
    UI.modalStack.push(type);
}

/**
 * Close the current modal
 */
function closeModal() {
    const modal = UI.root?.querySelector('#vmt_modal');
    if (modal) {
        modal.setAttribute('aria-hidden', 'true');
    }
    UI.modalStack.pop();
}

/**
 * Render the current tab content
 */
function render() {
    if (!UI.root) return;

    // Update tab button active states
    for (const btn of UI.root.querySelectorAll('.vmt_tab')) {
        btn.classList.toggle('active', btn.dataset.tab === UI.activeTab);
    }

    // Render tab content
    const body = UI.root.querySelector('#vmt_body');
    if (!body) return;

    body.innerHTML = '';

    switch (UI.activeTab) {
        case 'overview':
            body.appendChild(renderOverviewTab(openModal, render));
            break;
        case 'stats':
            body.appendChild(renderStatsTab(openModal, render));
            break;
        case 'class':
            body.appendChild(renderClassLevelTab(openModal, render));
            break;
        case 'skills':
            body.appendChild(renderSkillsTab(openModal, render));
            break;
        case 'spells':
            body.appendChild(renderSpellsTab(openModal, render));
            break;
        case 'traits':
            body.appendChild(renderTraitsTab(openModal, render));
            break;
        case 'titles':
            body.appendChild(renderTitlesTab(openModal, render));
            break;
        case 'modifiers':
            body.appendChild(renderModifiersTab(openModal, render));
            break;
        case 'equipment':
            body.appendChild(renderEquipmentTab(openModal, render));
            break;
        case 'inventory':
            body.appendChild(renderInventoryTab(openModal, render));
            break;
        case 'reputation':
            body.appendChild(renderReputationTab(openModal, render));
            break;
        case 'companions':
            body.appendChild(renderCompanionsTab(openModal, render));
            break;
        case 'achievements':
            body.appendChild(renderAchievementsTab(openModal, render));
            break;
        case 'affinities':
            body.appendChild(renderAffinitiesTab(openModal, render));
            break;
        case 'contracts':
            body.appendChild(renderContractsTab(openModal, render));
            break;
        case 'properties':
            body.appendChild(renderPropertiesTab(openModal, render));
            break;
        case 'transformations':
            body.appendChild(renderTransformationsTab(openModal, render));
            break;
        case 'bounties':
            body.appendChild(renderBountiesTab(openModal, render));
            break;
        case 'legacy':
            body.appendChild(renderLegacyTab(openModal, render));
            break;
        case 'survival':
            body.appendChild(renderSurvivalMetersTab(openModal, render));
            break;
        case 'blessings':
            body.appendChild(renderBlessingsTab(openModal, render));
            break;
        case 'masteries':
            body.appendChild(renderMasteriesTab(openModal, render));
            break;
        case 'karma':
            body.appendChild(renderKarmaTab(openModal, render));
            break;
        case 'limitations':
            body.appendChild(renderLimitationsTab(openModal, render));
            break;
        case 'collections':
            body.appendChild(renderCollectionsTab(openModal, render));
            break;
        case 'guilds':
            body.appendChild(renderGuildsTab(openModal, render));
            break;
        case 'dungeons':
            body.appendChild(renderDungeonsTab(openModal, render));
            break;
        case 'talents':
            body.appendChild(renderTalentsTab(openModal, render));
            break;
        case 'loadouts':
            body.appendChild(renderLoadoutsTab(openModal, render));
            break;
        case 'settings':
            body.appendChild(renderSettingsTab(openModal, render));
            break;
        default:
            body.textContent = 'Unknown tab';
    }
}

/**
 * Register SillyTavern event handlers
 */
function registerEvents() {
    if (!eventSource || !event_types) {
        console.warn('[VMasterTracker] Event source not available');
        return;
    }

    // Chat changed - re-render with new chat's data
    eventSource.on(event_types.CHAT_CHANGED, () => {
        console.log('[VMasterTracker] Chat changed, re-rendering');
        render();
    });

    eventSource.on(event_types.GENERATE_BEFORE_COMBINE_PROMPTS, (data) => {
        const state = getState();
        const settings = state.settings?.contextInjection;
        if (!settings?.enabled) return;
        const block = buildContextBlock(state, settings);
        injectContextBlock(data, block, settings.position);
    });

    eventSource.on(event_types.MESSAGE_RECEIVED, async (messageId) => {
        const state = getState();
        if (!state.settings?.autoParsing?.enabled) return;
        const message = getMessageContent(messageId);
        await parseMessageForChanges(message);
    });

    console.log('[VMasterTracker] Events registered');
}

/**
 * Cleanup function
 */
function cleanup() {
    _cleanup.intervals.forEach(id => clearInterval(id));
    _cleanup.intervals = [];

    _cleanup.listeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    _cleanup.listeners = [];

    _cleanup.unsubscribers.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
    });
    _cleanup.unsubscribers = [];

    if (UI.root) {
        UI.root.remove();
        UI.root = null;
    }

    if (UI.launcher) {
        UI.launcher.remove();
        UI.launcher = null;
    }

    UI.mounted = false;
    console.log('[VMasterTracker] Cleanup complete');
}

/**
 * Global API for external access
 */
window.VMasterTracker = {
    // State access
    getState,
    setState,
    updateField,
    subscribe,

    // UI control
    open: () => {
        UI.panelVisible = true;
        if (UI.root) UI.root.classList.remove('vmt_hidden');
        if (UI.launcher) UI.launcher.classList.add('vmt_active');
    },
    close: () => {
        UI.panelVisible = false;
        if (UI.root) UI.root.classList.add('vmt_hidden');
        if (UI.launcher) UI.launcher.classList.remove('vmt_active');
    },
    toggle: togglePanel,

    // Utilities
    render,
    recalculateDerivedStats,

    // Events
    EVENTS: {
        STATE_CHANGED: 'state_changed'
    }
};

/**
 * Main initialization
 */
(async function main() {
    console.log('[VMasterTracker] Loading...');

    try {
        mountUI();
        registerEvents();

        // Initial render
        render();

        // Subscribe to state changes for re-render
        const unsub = subscribe(() => render());
        _cleanup.unsubscribers.push(unsub);

        console.log('[VMasterTracker] Ready!');
    } catch (e) {
        console.error('[VMasterTracker] Init failed:', e);
    }
})();
