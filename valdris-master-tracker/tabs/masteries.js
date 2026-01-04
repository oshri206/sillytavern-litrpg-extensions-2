/**
 * Valdris Master Tracker - Masteries Tab
 * Track mastery progression
 */

import { getState, updateField } from '../state-manager.js';

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

const MASTERY_CATEGORIES = ['Weapon', 'Magic', 'Craft', 'Combat Style', 'Other'];
const MASTERY_RANKS = ['Novice', 'Apprentice', 'Journeyman', 'Expert', 'Master', 'Grandmaster', 'Legendary'];

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function getRankClass(rank) {
    return `vmt-rank-${rank.toLowerCase().replace(/\s+/g, '')}`;
}

function createAbilityList(items = [], onChange) {
    const list = h('div', { class: 'vmt_tag_list' },
        ...items.map((item, idx) =>
            h('span', { class: 'vmt_tag' },
                item,
                h('button', {
                    class: 'vmt_tag_remove',
                    onclick: () => {
                        const next = [...items];
                        next.splice(idx, 1);
                        onChange(next);
                    }
                }, 'x')
            )
        )
    );

    const input = h('input', { type: 'text', class: 'vmt_input vmt_input_sm', placeholder: 'Add ability...' });
    const addBtn = h('button', {
        class: 'vmt_btn vmt_btn_sm',
        onclick: () => {
            const value = input.value.trim();
            if (!value) return;
            onChange([...(items || []), value]);
            input.value = '';
        }
    }, '+');

    return h('div', { class: 'vmt_effect_list' }, list, h('div', { class: 'vmt_inline_add' }, input, addBtn));
}

function createMasteryCard(mastery, index, updateMasteries) {
    const percent = mastery.xpToNext > 0 ? Math.min(100, Math.max(0, (mastery.currentXP / mastery.xpToNext) * 100)) : 0;

    const card = h('div', { class: 'vmt_card vmt_mastery_card' });
    card.appendChild(
        h('div', { class: 'vmt_card_header' },
            h('input', {
                type: 'text',
                class: 'vmt_input vmt_input_title',
                value: mastery.name || '',
                placeholder: 'Mastery name...',
                onchange: (e) => updateMasteries(index, { name: e.target.value })
            }),
            h('div', { class: `vmt_mastery_rank_badge ${getRankClass(mastery.rank || 'Novice')}` }, mastery.rank || 'Novice'),
            h('button', {
                class: 'vmt_btn_icon vmt_btn_danger',
                onclick: () => updateMasteries(index, null)
            }, '')
        )
    );

    card.appendChild(
        h('div', { class: 'vmt_grid_2' },
            h('div', { class: 'vmt_field' },
                h('label', { class: 'vmt_label' }, 'Category'),
                h('select', {
                    class: 'vmt_select',
                    onchange: (e) => updateMasteries(index, { category: e.target.value })
                }, ...MASTERY_CATEGORIES.map(cat =>
                    h('option', { value: cat, selected: mastery.category === cat ? 'selected' : null }, cat)
                ))
            ),
            h('div', { class: 'vmt_field' },
                h('label', { class: 'vmt_label' }, 'Rank'),
                h('select', {
                    class: 'vmt_select',
                    onchange: (e) => updateMasteries(index, { rank: e.target.value })
                }, ...MASTERY_RANKS.map(rank =>
                    h('option', { value: rank, selected: mastery.rank === rank ? 'selected' : null }, rank)
                ))
            )
        )
    );

    card.appendChild(
        h('div', { class: 'vmt_mastery_progress' },
            h('div', { class: 'vmt_mastery_progress_header' },
                h('span', { class: 'vmt_label' }, `XP: ${mastery.currentXP || 0} / ${mastery.xpToNext || 0}`),
                h('span', { class: 'vmt_label' }, `${Math.round(percent)}%`)
            ),
            h('div', { class: 'vmt_progress_bar' },
                h('div', { class: 'vmt_progress_fill', style: `width: ${percent}%` })
            ),
            h('div', { class: 'vmt_grid_2' },
                h('div', { class: 'vmt_field' },
                    h('label', { class: 'vmt_label' }, 'Current XP'),
                    h('input', {
                        type: 'number',
                        class: 'vmt_input',
                        value: mastery.currentXP ?? 0,
                        min: 0,
                        onchange: (e) => updateMasteries(index, { currentXP: Number(e.target.value) })
                    })
                ),
                h('div', { class: 'vmt_field' },
                    h('label', { class: 'vmt_label' }, 'XP to Next'),
                    h('input', {
                        type: 'number',
                        class: 'vmt_input',
                        value: mastery.xpToNext ?? 0,
                        min: 0,
                        onchange: (e) => updateMasteries(index, { xpToNext: Number(e.target.value) })
                    })
                )
            )
        )
    );

    card.appendChild(
        h('div', { class: 'vmt_field' },
            h('label', { class: 'vmt_label' }, 'Description'),
            h('textarea', {
                class: 'vmt_textarea',
                placeholder: 'Describe the mastery...',
                onchange: (e) => updateMasteries(index, { description: e.target.value })
            }, mastery.description || '')
        )
    );

    card.appendChild(
        h('div', { class: 'vmt_grid_2' },
            h('div', { class: 'vmt_field' },
                h('label', { class: 'vmt_label' }, 'Unlocked Abilities'),
                createAbilityList(mastery.unlockedAbilities || [], (unlockedAbilities) => updateMasteries(index, { unlockedAbilities }))
            ),
            h('div', { class: 'vmt_field' },
                h('label', { class: 'vmt_label' }, 'Next Rank Ability'),
                h('input', {
                    type: 'text',
                    class: 'vmt_input',
                    value: mastery.nextRankAbility || '',
                    placeholder: 'Preview unlock...',
                    onchange: (e) => updateMasteries(index, { nextRankAbility: e.target.value })
                })
            )
        )
    );

    return card;
}

export function renderMasteriesTab(openModal, render) {
    const state = getState();
    const masteries = state.masteries || [];

    const container = h('div', { class: 'vmt_tab_panel' });
    container.appendChild(
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Masteries'),
            h('button', {
                class: 'vmt_btn vmt_btn_primary',
                onclick: async () => {
                    const next = [...masteries, {
                        id: generateId(),
                        name: '',
                        category: 'Weapon',
                        rank: 'Novice',
                        currentXP: 0,
                        xpToNext: 100,
                        description: '',
                        unlockedAbilities: [],
                        nextRankAbility: ''
                    }];
                    await updateField('masteries', next);
                    render();
                }
            }, '+ Add')
        )
    );

    const list = h('div', { class: 'vmt_card_list' });
    const updateMasteries = async (index, patch) => {
        const current = getState().masteries || [];
        const next = [...current];
        if (patch === null) {
            next.splice(index, 1);
        } else {
            next[index] = { ...next[index], ...patch };
        }
        await updateField('masteries', next);
        if (patch === null) render();
    };

    masteries.forEach((mastery, index) => {
        list.appendChild(createMasteryCard(mastery, index, updateMasteries));
    });

    container.appendChild(list);
    return container;
}
