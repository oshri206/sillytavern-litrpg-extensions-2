/**
 * Valdris Master Tracker - Reputation Tab
 * Per-faction reputation tracking with scores, ranks, progress bars, and history
 */

import { getState, updateField } from '../state-manager.js';

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
 * Reputation rank definitions
 */
const REPUTATION_RANKS = [
    { min: -100, max: -75, name: 'Hated', color: '#cc3333' },
    { min: -74, max: -50, name: 'Hostile', color: '#dd5555' },
    { min: -49, max: -25, name: 'Unfriendly', color: '#dd8844' },
    { min: -24, max: 24, name: 'Neutral', color: '#aaaaaa' },
    { min: 25, max: 49, name: 'Friendly', color: '#66aa66' },
    { min: 50, max: 74, name: 'Honored', color: '#5588ee' },
    { min: 75, max: 100, name: 'Exalted', color: '#b380ff' }
];

/**
 * Get rank from score
 */
function getRankFromScore(score) {
    for (const rank of REPUTATION_RANKS) {
        if (score >= rank.min && score <= rank.max) {
            return rank;
        }
    }
    return REPUTATION_RANKS[3]; // Default to Neutral
}

/**
 * Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Format date for history
 */
function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Create a faction reputation item
 */
function createFactionItem(faction, index, onEdit, onDelete, onAddHistory, onViewHistory) {
    const rank = getRankFromScore(faction.score);
    const progressPercent = ((faction.score + 100) / 200) * 100;

    return h('div', { class: 'vmt_reputation_item' },
        h('div', { class: 'vmt_reputation_header_row' },
            h('div', { class: 'vmt_reputation_name_section' },
                h('div', { class: 'vmt_reputation_name' }, faction.name),
                h('span', {
                    class: 'vmt_reputation_rank_badge',
                    style: `background: ${rank.color}20; color: ${rank.color}; border-color: ${rank.color}40`
                }, rank.name)
            ),
            h('div', { class: 'vmt_reputation_actions' },
                h('button', {
                    class: 'vmt_btn_icon',
                    onclick: () => onAddHistory(index),
                    title: 'Add reputation change'
                }, '+'),
                h('button', {
                    class: 'vmt_btn_icon',
                    onclick: () => onViewHistory(index),
                    title: 'View history'
                }, ''),
                h('button', {
                    class: 'vmt_btn_icon',
                    onclick: () => onEdit(index),
                    title: 'Edit faction'
                }, ''),
                h('button', {
                    class: 'vmt_btn_icon vmt_btn_danger',
                    onclick: () => onDelete(index),
                    title: 'Delete faction'
                }, '')
            )
        ),
        h('div', { class: 'vmt_reputation_bar_container' },
            h('div', { class: 'vmt_reputation_bar' },
                h('div', {
                    class: 'vmt_reputation_fill',
                    style: `width: ${progressPercent}%; background: linear-gradient(90deg, ${rank.color}, ${rank.color}aa)`
                }),
                h('div', { class: 'vmt_reputation_bar_markers' },
                    h('span', { class: 'vmt_bar_marker', style: 'left: 0%' }, ''),
                    h('span', { class: 'vmt_bar_marker', style: 'left: 25%' }, ''),
                    h('span', { class: 'vmt_bar_marker', style: 'left: 50%' }, ''),
                    h('span', { class: 'vmt_bar_marker', style: 'left: 75%' }, ''),
                    h('span', { class: 'vmt_bar_marker', style: 'left: 100%' }, '')
                )
            ),
            h('div', { class: 'vmt_reputation_score_display' },
                h('span', { class: 'vmt_reputation_score_value' }, faction.score),
                h('span', { class: 'vmt_reputation_score_range' }, ' / 100')
            )
        ),
        faction.history && faction.history.length > 0 ?
            h('div', { class: 'vmt_reputation_recent' },
                h('span', { class: 'vmt_reputation_recent_label' }, 'Recent: '),
                h('span', { class: `vmt_reputation_change ${faction.history[0].change >= 0 ? 'positive' : 'negative'}` },
                    `${faction.history[0].change >= 0 ? '+' : ''}${faction.history[0].change}`
                ),
                h('span', { class: 'vmt_reputation_reason' }, ` - ${faction.history[0].reason}`)
            ) : null
    );
}

// Local filter state
let reputationFilter = 'All';

/**
 * Render the Reputation tab content
 */
export function renderReputationTab(openModal, render) {
    const state = getState();
    const factions = state.reputation || [];

    const container = h('div', { class: 'vmt_reputation_tab' });

    // Summary section
    const summary = h('div', { class: 'vmt_reputation_summary' },
        h('div', { class: 'vmt_summary_item vmt_summary_total' },
            h('div', { class: 'vmt_summary_label' }, 'Factions'),
            h('div', { class: 'vmt_summary_value' }, factions.length)
        ),
        ...REPUTATION_RANKS.filter(r => ['Hated', 'Hostile', 'Neutral', 'Friendly', 'Exalted'].includes(r.name)).map(rank => {
            const count = factions.filter(f => getRankFromScore(f.score).name === rank.name).length;
            return h('div', {
                class: 'vmt_summary_item',
                style: `border-bottom: 2px solid ${rank.color}`
            },
                h('div', { class: 'vmt_summary_label' }, rank.name),
                h('div', { class: 'vmt_summary_value', style: `color: ${rank.color}` }, count)
            );
        })
    );
    container.appendChild(summary);

    // Main factions section
    const factionsSection = h('div', { class: 'vmt_section vmt_reputation_section' },
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Factions'),
            h('button', {
                class: 'vmt_btn_small vmt_btn_add',
                onclick: () => openModal('add-faction', {
                    onSave: async (faction) => {
                        const newFaction = {
                            ...faction,
                            id: generateId(),
                            history: []
                        };
                        const updated = [...factions, newFaction];
                        await updateField('reputation', updated);
                        render();
                    }
                })
            }, '+ Add Faction')
        )
    );

    // Filter buttons
    const filterContainer = h('div', { class: 'vmt_reputation_filter' },
        h('button', {
            class: `vmt_filter_btn ${reputationFilter === 'All' ? 'active' : ''}`,
            onclick: () => { reputationFilter = 'All'; render(); }
        }, 'All'),
        ...REPUTATION_RANKS.map(rank =>
            h('button', {
                class: `vmt_filter_btn ${reputationFilter === rank.name ? 'active' : ''}`,
                style: reputationFilter === rank.name ? `background: ${rank.color}20; border-color: ${rank.color}; color: ${rank.color}` : '',
                onclick: () => { reputationFilter = rank.name; render(); }
            }, rank.name)
        )
    );
    factionsSection.appendChild(filterContainer);

    // Factions list
    const filteredFactions = reputationFilter === 'All'
        ? factions
        : factions.filter(f => getRankFromScore(f.score).name === reputationFilter);

    const factionsList = h('div', { class: 'vmt_reputation_list' });

    if (filteredFactions.length === 0) {
        factionsList.appendChild(h('div', { class: 'vmt_empty' },
            reputationFilter === 'All' ? 'No factions tracked' : `No ${reputationFilter} factions`
        ));
    } else {
        filteredFactions.forEach((faction, i) => {
            const originalIndex = factions.indexOf(faction);
            factionsList.appendChild(createFactionItem(
                faction,
                originalIndex,
                // Edit
                (idx) => openModal('edit-faction', {
                    faction: factions[idx],
                    onSave: async (updated) => {
                        const list = [...factions];
                        list[idx] = { ...list[idx], ...updated };
                        await updateField('reputation', list);
                        render();
                    }
                }),
                // Delete
                async (idx) => {
                    const list = factions.filter((_, j) => j !== idx);
                    await updateField('reputation', list);
                    render();
                },
                // Add history
                (idx) => openModal('add-reputation-change', {
                    faction: factions[idx],
                    onSave: async (change) => {
                        const list = [...factions];
                        const newScore = Math.max(-100, Math.min(100, list[idx].score + change.change));
                        const historyEntry = {
                            id: generateId(),
                            change: change.change,
                            reason: change.reason,
                            timestamp: Date.now(),
                            previousScore: list[idx].score,
                            newScore: newScore
                        };
                        list[idx] = {
                            ...list[idx],
                            score: newScore,
                            history: [historyEntry, ...(list[idx].history || [])].slice(0, 50) // Keep last 50 entries
                        };
                        await updateField('reputation', list);
                        render();
                    }
                }),
                // View history
                (idx) => openModal('view-reputation-history', {
                    faction: factions[idx]
                })
            ));
        });
    }

    factionsSection.appendChild(factionsList);
    container.appendChild(factionsSection);

    return container;
}
