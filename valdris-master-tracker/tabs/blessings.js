/**
 * Valdris Master Tracker - Blessings Tab
 * Track divine blessings and curses
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

const BLESSING_TYPES = ['Blessing', 'Curse', 'Mixed'];
const BLESSING_DURATIONS = ['Permanent', 'Temporary', 'Conditional'];

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function getBlessingClass(type) {
    if (type === 'Curse') return 'vmt_curse';
    if (type === 'Mixed') return 'vmt_mixed';
    return 'vmt_blessing';
}

function createEffectList(effects = [], onChange) {
    const list = h('div', { class: 'vmt_tag_list' },
        ...effects.map((effect, idx) =>
            h('span', { class: 'vmt_tag' },
                effect,
                h('button', {
                    class: 'vmt_tag_remove',
                    onclick: () => {
                        const next = [...effects];
                        next.splice(idx, 1);
                        onChange(next);
                    }
                }, 'x')
            )
        )
    );

    const input = h('input', { type: 'text', class: 'vmt_input vmt_input_sm', placeholder: 'Add effect...' });
    const addBtn = h('button', {
        class: 'vmt_btn vmt_btn_sm',
        onclick: () => {
            const value = input.value.trim();
            if (!value) return;
            onChange([...(effects || []), value]);
            input.value = '';
        }
    }, '+');

    return h('div', { class: 'vmt_effect_list' }, list, h('div', { class: 'vmt_inline_add' }, input, addBtn));
}

function createBlessingCard(blessing, index, updateBlessings, render) {
    const card = h('div', { class: `vmt_card vmt_blessing_card ${getBlessingClass(blessing.type)}` });

    card.appendChild(
        h('div', { class: 'vmt_card_header' },
            h('input', {
                type: 'text',
                class: 'vmt_input vmt_input_title',
                value: blessing.name || '',
                placeholder: 'Blessing name...',
                onchange: (e) => updateBlessings(index, { name: e.target.value })
            }),
            h('button', {
                class: 'vmt_btn_icon vmt_btn_danger',
                onclick: () => updateBlessings(index, null)
            }, '')
        )
    );

    card.appendChild(
        h('div', { class: 'vmt_grid_2' },
            h('div', { class: 'vmt_field' },
                h('label', { class: 'vmt_label' }, 'Source'),
                h('input', {
                    type: 'text',
                    class: 'vmt_input',
                    value: blessing.source || '',
                    placeholder: 'God/entity...',
                    onchange: (e) => updateBlessings(index, { source: e.target.value })
                })
            ),
            h('div', { class: 'vmt_field' },
                h('label', { class: 'vmt_label' }, 'Type'),
                h('select', {
                    class: 'vmt_select',
                    onchange: (e) => updateBlessings(index, { type: e.target.value })
                }, ...BLESSING_TYPES.map(type =>
                    h('option', { value: type, selected: blessing.type === type ? 'selected' : null }, type)
                ))
            ),
            h('div', { class: 'vmt_field' },
                h('label', { class: 'vmt_label' }, 'Duration'),
                h('select', {
                    class: 'vmt_select',
                    onchange: (e) => updateBlessings(index, { duration: e.target.value })
                }, ...BLESSING_DURATIONS.map(duration =>
                    h('option', { value: duration, selected: blessing.duration === duration ? 'selected' : null }, duration)
                ))
            ),
            h('div', { class: 'vmt_field' },
                h('label', { class: 'vmt_label' }, 'Expires At'),
                h('input', {
                    type: 'date',
                    class: 'vmt_input',
                    value: blessing.expiresAt || '',
                    onchange: (e) => updateBlessings(index, { expiresAt: e.target.value || null })
                })
            )
        )
    );

    card.appendChild(
        h('div', { class: 'vmt_field' },
            h('label', { class: 'vmt_label' }, 'Description'),
            h('textarea', {
                class: 'vmt_textarea',
                placeholder: 'Describe the blessing or curse...',
                onchange: (e) => updateBlessings(index, { description: e.target.value })
            }, blessing.description || '')
        )
    );

    card.appendChild(
        h('div', { class: 'vmt_field' },
            h('label', { class: 'vmt_label' }, 'Effects'),
            createEffectList(blessing.effects || [], (effects) => updateBlessings(index, { effects }))
        )
    );

    card.appendChild(
        h('div', { class: 'vmt_grid_2' },
            h('div', { class: 'vmt_field' },
                h('label', { class: 'vmt_label' }, 'Conditions'),
                h('input', {
                    type: 'text',
                    class: 'vmt_input',
                    value: blessing.conditions || '',
                    placeholder: 'Requirements to maintain...',
                    onchange: (e) => updateBlessings(index, { conditions: e.target.value })
                })
            ),
            h('label', { class: 'vmt_toggle' },
                h('input', {
                    type: 'checkbox',
                    checked: blessing.active ? 'checked' : null,
                    onchange: (e) => updateBlessings(index, { active: e.target.checked })
                }),
                h('span', { class: 'vmt_toggle_label' }, 'Active')
            )
        )
    );

    return card;
}

export function renderBlessingsTab(openModal, render) {
    const state = getState();
    const blessings = state.blessings || [];

    const container = h('div', { class: 'vmt_tab_panel' });
    container.appendChild(
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Blessings & Curses'),
            h('button', {
                class: 'vmt_btn vmt_btn_primary',
                onclick: async () => {
                    const next = [...blessings, {
                        id: generateId(),
                        name: '',
                        source: '',
                        type: 'Blessing',
                        description: '',
                        effects: [],
                        conditions: '',
                        duration: 'Permanent',
                        expiresAt: null,
                        active: true
                    }];
                    await updateField('blessings', next);
                    render();
                }
            }, '+ Add')
        )
    );

    const list = h('div', { class: 'vmt_card_list' });

    const updateBlessings = async (index, patch) => {
        const current = getState().blessings || [];
        const next = [...current];
        if (patch === null) {
            next.splice(index, 1);
        } else {
            next[index] = { ...next[index], ...patch };
        }
        await updateField('blessings', next);
        if (patch === null) render();
    };

    blessings.forEach((blessing, index) => {
        list.appendChild(createBlessingCard(blessing, index, updateBlessings));
    });

    container.appendChild(list);
    return container;
}
