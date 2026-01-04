/**
 * Valdris Master Tracker - Loadouts Tab
 * Save and switch equipment/skill configurations
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

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
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

function formatEquipmentSummary(equipment = {}) {
    return Object.entries(equipment)
        .filter(([, item]) => item && item.name)
        .map(([slot, item]) => `${slot}: ${item.name}`)
        .join(' • ') || 'No equipment saved';
}

function createLoadoutCard(loadout, index, updateLoadouts, render) {
    return h('div', { class: 'vmt_card vmt_loadout_card' },
        h('div', { class: 'vmt_card_header' },
            h('input', {
                type: 'text',
                class: 'vmt_input vmt_input_title',
                value: loadout.name || '',
                placeholder: 'Loadout name...',
                onchange: (e) => updateLoadouts(index, { name: e.target.value })
            }),
            h('button', {
                class: 'vmt_btn vmt_btn_sm',
                onclick: async () => {
                    const state = getState();
                    await updateField('equipment', clone(loadout.equipment || {}));
                    const activeNames = loadout.activeSkills || [];
                    const updatedSkills = (state.skills?.active || []).filter(skill => activeNames.includes(skill.name));
                    await updateField('skills.active', updatedSkills);
                    await updateLoadouts(index, { lastLoadedAt: new Date().toISOString() });
                    render();
                }
            }, 'Load'),
            h('button', {
                class: 'vmt_btn_icon vmt_btn_danger',
                onclick: () => updateLoadouts(index, null, true)
            }, '')
        ),
        h('div', { class: 'vmt_field' },
            h('label', { class: 'vmt_label' }, 'Description'),
            h('input', {
                type: 'text',
                class: 'vmt_input',
                value: loadout.description || '',
                placeholder: 'Description...',
                onchange: (e) => updateLoadouts(index, { description: e.target.value })
            })
        ),
        h('div', { class: 'vmt_loadout_summary' },
            h('span', { class: 'vmt_label' }, 'Equipment Snapshot'),
            h('div', { class: 'vmt_text_muted' }, formatEquipmentSummary(loadout.equipment || {}))
        ),
        h('div', { class: 'vmt_grid_2' },
            h('div', { class: 'vmt_field' },
                h('label', { class: 'vmt_label' }, 'Active Skills'),
                createTagList(loadout.activeSkills || [], (activeSkills) => updateLoadouts(index, { activeSkills }))
            ),
            h('div', { class: 'vmt_field' },
                h('label', { class: 'vmt_label' }, 'Active Spells'),
                createTagList(loadout.activeSpells || [], (activeSpells) => updateLoadouts(index, { activeSpells }))
            )
        ),
        h('div', { class: 'vmt_field' },
            h('label', { class: 'vmt_label' }, 'Quick Items'),
            createTagList(loadout.quickItems || [], (quickItems) => updateLoadouts(index, { quickItems }))
        ),
        h('div', { class: 'vmt_field' },
            h('label', { class: 'vmt_label' }, 'Notes'),
            h('textarea', {
                class: 'vmt_textarea',
                onchange: (e) => updateLoadouts(index, { notes: e.target.value })
            }, loadout.notes || '')
        )
    );
}

export function renderLoadoutsTab(openModal, render) {
    const state = getState();
    const loadouts = state.loadouts || [];

    const container = h('div', { class: 'vmt_tab_panel' });

    container.appendChild(
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Loadouts'),
            h('button', {
                class: 'vmt_btn vmt_btn_primary',
                onclick: async () => {
                    if (loadouts.length >= 10) return;
                    const next = [...loadouts, {
                        id: generateId(),
                        name: `Loadout ${loadouts.length + 1}`,
                        description: '',
                        equipment: clone(state.equipment || {}),
                        activeSkills: (state.skills?.active || []).map(skill => skill.name).filter(Boolean),
                        activeSpells: (state.spells || []).map(spell => spell.name).filter(Boolean),
                        quickItems: [],
                        notes: ''
                    }];
                    await updateField('loadouts', next);
                    render();
                }
            }, 'Save Current Loadout')
        )
    );

    if (loadouts.length >= 10) {
        container.appendChild(h('div', { class: 'vmt_text_muted' }, 'Maximum of 10 loadouts reached.'));
    }

    const list = h('div', { class: 'vmt_card_list' });
    const updateLoadouts = async (index, patch, shouldRender = false) => {
        const current = getState().loadouts || [];
        const next = [...current];
        if (patch === null) {
            next.splice(index, 1);
        } else {
            next[index] = { ...next[index], ...patch };
        }
        await updateField('loadouts', next);
        if (shouldRender) render();
    };

    loadouts.forEach((loadout, index) => {
        list.appendChild(createLoadoutCard(loadout, index, updateLoadouts, render));
    });

    container.appendChild(list);
    return container;
}
