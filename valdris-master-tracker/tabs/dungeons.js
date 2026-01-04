/**
 * Valdris Master Tracker - Dungeons Tab
 * Track dungeon progress and exploration
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

const DUNGEON_TYPES = ['Natural', 'Artificial', 'Corrupted', 'Divine', 'Vex', 'Unknown'];
const DUNGEON_DIFFICULTIES = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
const DUNGEON_STATUSES = ['Undiscovered', 'Discovered', 'In Progress', 'Cleared', 'Failed'];

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function createTagList(items = [], onChange) {
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

    const input = h('input', { type: 'text', class: 'vmt_input vmt_input_sm', placeholder: 'Add item...' });
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

function difficultyClass(difficulty) {
    return `vmt-diff-${String(difficulty).toLowerCase()}`;
}

function createDungeonCard(dungeon, index, updateDungeons) {
    const percent = dungeon.floorsTotal > 0
        ? Math.min(100, Math.max(0, (dungeon.floorsCleared / dungeon.floorsTotal) * 100))
        : 0;

    const card = h('div', { class: 'vmt_card vmt_dungeon_card' });

    card.appendChild(
        h('div', { class: 'vmt_card_header' },
            h('input', {
                type: 'text',
                class: 'vmt_input vmt_input_title',
                value: dungeon.name || '',
                placeholder: 'Dungeon name...',
                onchange: (e) => updateDungeons(index, { name: e.target.value })
            }),
            h('span', { class: `vmt_dungeon_difficulty ${difficultyClass(dungeon.difficulty)}` }, dungeon.difficulty || 'D'),
            h('button', {
                class: 'vmt_btn_icon vmt_btn_danger',
                onclick: () => updateDungeons(index, null)
            }, '')
        )
    );

    card.appendChild(
        h('div', { class: 'vmt_grid_2' },
            h('div', { class: 'vmt_field' },
                h('label', { class: 'vmt_label' }, 'Location'),
                h('input', {
                    type: 'text',
                    class: 'vmt_input',
                    value: dungeon.location || '',
                    placeholder: 'Location...',
                    onchange: (e) => updateDungeons(index, { location: e.target.value })
                })
            ),
            h('div', { class: 'vmt_field' },
                h('label', { class: 'vmt_label' }, 'Type'),
                h('select', {
                    class: 'vmt_select',
                    onchange: (e) => updateDungeons(index, { type: e.target.value })
                }, ...DUNGEON_TYPES.map(type =>
                    h('option', { value: type, selected: dungeon.type === type ? 'selected' : null }, type)
                ))
            ),
            h('div', { class: 'vmt_field' },
                h('label', { class: 'vmt_label' }, 'Difficulty'),
                h('select', {
                    class: 'vmt_select',
                    onchange: (e) => updateDungeons(index, { difficulty: e.target.value })
                }, ...DUNGEON_DIFFICULTIES.map(diff =>
                    h('option', { value: diff, selected: dungeon.difficulty === diff ? 'selected' : null }, diff)
                ))
            ),
            h('div', { class: 'vmt_field' },
                h('label', { class: 'vmt_label' }, 'Status'),
                h('select', {
                    class: 'vmt_select',
                    onchange: (e) => updateDungeons(index, { status: e.target.value })
                }, ...DUNGEON_STATUSES.map(status =>
                    h('option', { value: status, selected: dungeon.status === status ? 'selected' : null }, status)
                ))
            )
        )
    );

    card.appendChild(
        h('div', { class: 'vmt_dungeon_progress' },
            h('div', { class: 'vmt_dungeon_progress_header' },
                h('span', { class: 'vmt_label' }, `Floors: ${dungeon.floorsCleared || 0}/${dungeon.floorsTotal || 0}`),
                h('span', { class: 'vmt_label' }, `${Math.round(percent)}%`)
            ),
            h('div', { class: 'vmt_progress_bar' },
                h('div', { class: 'vmt_progress_fill', style: `width: ${percent}%` })
            ),
            h('div', { class: 'vmt_grid_2' },
                h('div', { class: 'vmt_field' },
                    h('label', { class: 'vmt_label' }, 'Floors Cleared'),
                    h('input', {
                        type: 'number',
                        class: 'vmt_input vmt_input_sm',
                        value: dungeon.floorsCleared ?? 0,
                        min: 0,
                        onchange: (e) => updateDungeons(index, { floorsCleared: Number(e.target.value) })
                    })
                ),
                h('div', { class: 'vmt_field' },
                    h('label', { class: 'vmt_label' }, 'Total Floors'),
                    h('input', {
                        type: 'number',
                        class: 'vmt_input vmt_input_sm',
                        value: dungeon.floorsTotal ?? 0,
                        min: 0,
                        onchange: (e) => updateDungeons(index, { floorsTotal: Number(e.target.value) })
                    })
                )
            )
        )
    );

    card.appendChild(
        h('div', { class: 'vmt_grid_2' },
            h('div', { class: 'vmt_field' },
                h('label', { class: 'vmt_label' }, 'Bosses Defeated'),
                createTagList(dungeon.bossesDefeated || [], (bossesDefeated) => updateDungeons(index, { bossesDefeated }))
            ),
            h('div', { class: 'vmt_field' },
                h('label', { class: 'vmt_label' }, 'Loot Obtained'),
                createTagList(dungeon.lootObtained || [], (lootObtained) => updateDungeons(index, { lootObtained }))
            )
        )
    );

    card.appendChild(
        h('div', { class: 'vmt_field' },
            h('label', { class: 'vmt_label' }, 'Notes'),
            h('textarea', {
                class: 'vmt_textarea',
                placeholder: 'Notes...',
                onchange: (e) => updateDungeons(index, { notes: e.target.value })
            }, dungeon.notes || '')
        )
    );

    return card;
}

export function renderDungeonsTab(openModal, render) {
    const state = getState();
    const dungeons = state.dungeons || [];

    const container = h('div', { class: 'vmt_tab_panel' });
    container.appendChild(
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Dungeons'),
            h('button', {
                class: 'vmt_btn vmt_btn_primary',
                onclick: async () => {
                    const next = [...dungeons, {
                        id: generateId(),
                        name: '',
                        location: '',
                        type: 'Natural',
                        difficulty: 'D',
                        floorsTotal: 1,
                        floorsCleared: 0,
                        bossesDefeated: [],
                        lootObtained: [],
                        status: 'Undiscovered',
                        notes: ''
                    }];
                    await updateField('dungeons', next);
                    render();
                }
            }, '+ Add')
        )
    );

    const list = h('div', { class: 'vmt_card_list' });
    const updateDungeons = async (index, patch) => {
        const current = getState().dungeons || [];
        const next = [...current];
        if (patch === null) {
            next.splice(index, 1);
        } else {
            next[index] = { ...next[index], ...patch };
        }
        await updateField('dungeons', next);
        if (patch === null) render();
    };

    dungeons.forEach((dungeon, index) => {
        list.appendChild(createDungeonCard(dungeon, index, updateDungeons));
    });

    container.appendChild(list);
    return container;
}
