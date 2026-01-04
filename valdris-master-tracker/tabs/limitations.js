/**
 * Valdris Master Tracker - Limitations Tab
 * Track restrictions, vows, weaknesses, and geas
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

const LIMITATION_TYPES = ['Vow', 'Curse', 'Weakness', 'Restriction', 'Geas', 'Other'];
const expandedLimitations = new Set();

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
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

function createLimitationCard(item, index, updateLimitations, render) {
    const isExpanded = expandedLimitations.has(item.id);
    const activeClass = item.active ? 'vmt_limitation_active' : '';

    const card = h('div', { class: `vmt_card vmt_limitation_card ${activeClass}` });

    card.appendChild(
        h('div', { class: 'vmt_card_header vmt_collapsible_header' },
            h('button', {
                class: 'vmt_collapse_toggle',
                onclick: () => {
                    if (isExpanded) {
                        expandedLimitations.delete(item.id);
                    } else {
                        expandedLimitations.add(item.id);
                    }
                    render();
                }
            }, isExpanded ? '▼' : '▶'),
            h('input', {
                type: 'text',
                class: 'vmt_input vmt_input_title',
                value: item.name || '',
                placeholder: 'Limitation name...',
                onchange: (e) => updateLimitations(index, { name: e.target.value })
            }),
            h('label', { class: 'vmt_toggle' },
                h('input', {
                    type: 'checkbox',
                    checked: item.active ? 'checked' : null,
                    onchange: (e) => updateLimitations(index, { active: e.target.checked })
                }),
                h('span', { class: 'vmt_toggle_label' }, 'Active')
            ),
            h('button', {
                class: 'vmt_btn_icon vmt_btn_danger',
                onclick: () => updateLimitations(index, null)
            }, '')
        )
    );

    if (isExpanded) {
        card.appendChild(
            h('div', { class: 'vmt_card_body' },
                h('div', { class: 'vmt_grid_2' },
                    h('div', { class: 'vmt_field' },
                        h('label', { class: 'vmt_label' }, 'Type'),
                        h('select', {
                            class: 'vmt_select',
                            onchange: (e) => updateLimitations(index, { type: e.target.value })
                        }, ...LIMITATION_TYPES.map(type =>
                            h('option', { value: type, selected: item.type === type ? 'selected' : null }, type)
                        ))
                    ),
                    h('div', { class: 'vmt_field' },
                        h('label', { class: 'vmt_label' }, 'Source'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_input',
                            value: item.source || '',
                            placeholder: 'Origin...',
                            onchange: (e) => updateLimitations(index, { source: e.target.value })
                        })
                    )
                ),
                h('div', { class: 'vmt_field' },
                    h('label', { class: 'vmt_label' }, 'Description'),
                    h('textarea', {
                        class: 'vmt_textarea',
                        placeholder: 'Describe the limitation...',
                        onchange: (e) => updateLimitations(index, { description: e.target.value })
                    }, item.description || '')
                ),
                h('div', { class: 'vmt_field' },
                    h('label', { class: 'vmt_label' }, 'Effects'),
                    createEffectList(item.effects || [], (effects) => updateLimitations(index, { effects }))
                ),
                h('div', { class: 'vmt_grid_2' },
                    h('div', { class: 'vmt_field' },
                        h('label', { class: 'vmt_label' }, 'Break Condition'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_input',
                            value: item.breakCondition || '',
                            placeholder: 'How to remove...',
                            onchange: (e) => updateLimitations(index, { breakCondition: e.target.value })
                        })
                    ),
                    h('div', { class: 'vmt_field' },
                        h('label', { class: 'vmt_label' }, 'Penalty'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_input',
                            value: item.penalty || '',
                            placeholder: 'Penalty if broken...',
                            onchange: (e) => updateLimitations(index, { penalty: e.target.value })
                        })
                    )
                )
            )
        );
    }

    return card;
}

export function renderLimitationsTab(openModal, render) {
    const state = getState();
    const limitations = state.limitations || [];

    const container = h('div', { class: 'vmt_tab_panel' });
    container.appendChild(
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Limitations'),
            h('button', {
                class: 'vmt_btn vmt_btn_primary',
                onclick: async () => {
                    const next = [...limitations, {
                        id: generateId(),
                        name: '',
                        type: 'Weakness',
                        source: '',
                        description: '',
                        effects: [],
                        breakCondition: '',
                        penalty: '',
                        active: true
                    }];
                    await updateField('limitations', next);
                    render();
                }
            }, '+ Add')
        )
    );

    const list = h('div', { class: 'vmt_card_list' });
    const updateLimitations = async (index, patch) => {
        const current = getState().limitations || [];
        const next = [...current];
        if (patch === null) {
            next.splice(index, 1);
        } else {
            next[index] = { ...next[index], ...patch };
        }
        await updateField('limitations', next);
        if (patch === null) render();
    };

    limitations.forEach((item, index) => {
        list.appendChild(createLimitationCard(item, index, updateLimitations, render));
    });

    container.appendChild(list);
    return container;
}
