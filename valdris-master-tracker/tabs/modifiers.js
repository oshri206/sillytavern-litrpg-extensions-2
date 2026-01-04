/**
 * Valdris Master Tracker - Modifiers Tab
 * Permanent, Temporary, and Conditional modifiers with resistances and immunities
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
 * Resistance types with icons
 */
const RESISTANCES = {
    fire: { label: 'Fire', icon: '', color: '#ff6b35' },
    ice: { label: 'Ice', icon: '', color: '#5bc0de' },
    lightning: { label: 'Lightning', icon: '', color: '#f0ad4e' },
    poison: { label: 'Poison', icon: '', color: '#5cb85c' },
    holy: { label: 'Holy', icon: '', color: '#fff4b3' },
    shadow: { label: 'Shadow', icon: '', color: '#8b5cf6' },
    physical: { label: 'Physical', icon: '', color: '#9ca3af' },
    arcane: { label: 'Arcane', icon: '', color: '#a855f7' }
};

/**
 * Immunity types
 */
const IMMUNITIES = {
    poison: 'Poison',
    paralysis: 'Paralysis',
    sleep: 'Sleep',
    fear: 'Fear',
    charm: 'Charm',
    stun: 'Stun',
    bleed: 'Bleed',
    burn: 'Burn',
    freeze: 'Freeze',
    blind: 'Blind'
};

/**
 * Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Local filter state
let modifierFilter = 'all'; // 'all', 'buff', 'debuff'

/**
 * Create a modifier item
 */
function createModifierItem(modifier, modType, index, onEdit, onDelete) {
    const isBuff = modifier.type === 'buff';

    return h('div', { class: `vmt_modifier_item ${isBuff ? 'vmt_mod_buff' : 'vmt_mod_debuff'}` },
        h('div', { class: 'vmt_mod_header' },
            h('div', { class: 'vmt_mod_name_section' },
                h('span', { class: 'vmt_mod_icon' }, isBuff ? '' : ''),
                h('span', { class: 'vmt_mod_name' }, modifier.name)
            ),
            h('div', { class: 'vmt_mod_actions' },
                h('button', {
                    class: 'vmt_btn_icon',
                    onclick: () => onEdit(modType, index),
                    title: 'Edit modifier'
                }, ''),
                h('button', {
                    class: 'vmt_btn_icon vmt_btn_danger',
                    onclick: () => onDelete(modType, index),
                    title: 'Delete modifier'
                }, '')
            )
        ),
        h('div', { class: 'vmt_mod_details' },
            h('span', { class: 'vmt_mod_effect' }, modifier.effect),
            modifier.value ? h('span', { class: 'vmt_mod_value' }, modifier.value) : null
        ),
        h('div', { class: 'vmt_mod_meta' },
            modifier.source ? h('span', { class: 'vmt_mod_source' }, `Source: ${modifier.source}`) : null,
            modType === 'temporary' && modifier.duration ? h('span', { class: 'vmt_mod_duration' },
                `Duration: ${modifier.remaining || modifier.duration}/${modifier.duration}`
            ) : null,
            modType === 'conditional' && modifier.trigger ? h('span', { class: 'vmt_mod_trigger' },
                `Trigger: ${modifier.trigger}`
            ) : null
        )
    );
}

/**
 * Create resistance row
 */
function createResistanceRow(key, value, onChange) {
    const info = RESISTANCES[key];
    const barWidth = Math.min(100, Math.max(0, value));

    return h('div', { class: 'vmt_resistance_row' },
        h('div', { class: 'vmt_res_info' },
            h('span', { class: 'vmt_res_icon', style: `color: ${info.color}` }, info.icon),
            h('span', { class: 'vmt_res_label' }, info.label)
        ),
        h('div', { class: 'vmt_res_bar_container' },
            h('div', { class: 'vmt_res_bar', style: `width: ${barWidth}%; background: ${info.color}` })
        ),
        h('input', {
            type: 'number',
            class: 'vmt_res_input',
            value: value,
            min: -100,
            max: 200,
            onchange: (e) => onChange(key, parseInt(e.target.value, 10) || 0)
        }),
        h('span', { class: 'vmt_res_percent' }, '%')
    );
}

/**
 * Create immunity checkbox
 */
function createImmunityCheckbox(key, label, checked, onChange) {
    return h('label', { class: 'vmt_immunity_item' },
        h('input', {
            type: 'checkbox',
            class: 'vmt_immunity_checkbox',
            checked: checked ? 'checked' : null,
            onchange: () => onChange(key)
        }),
        h('span', { class: 'vmt_immunity_label' }, label)
    );
}

/**
 * Create buff/debuff filter
 */
function createModFilter(activeFilter, onFilterChange) {
    return h('div', { class: 'vmt_mod_filter' },
        h('button', {
            class: `vmt_filter_btn ${activeFilter === 'all' ? 'active' : ''}`,
            onclick: () => onFilterChange('all')
        }, 'All'),
        h('button', {
            class: `vmt_filter_btn vmt_filter_buff ${activeFilter === 'buff' ? 'active' : ''}`,
            onclick: () => onFilterChange('buff')
        }, 'Buffs'),
        h('button', {
            class: `vmt_filter_btn vmt_filter_debuff ${activeFilter === 'debuff' ? 'active' : ''}`,
            onclick: () => onFilterChange('debuff')
        }, 'Debuffs')
    );
}

/**
 * Create a modifier section (permanent/temporary/conditional)
 */
function createModifierSection(title, subtitle, modType, modifiers, openModal, render) {
    const filteredMods = modifierFilter === 'all'
        ? modifiers
        : modifiers.filter(m => m.type === modifierFilter);

    const handleEdit = (type, index) => {
        openModal('edit-modifier', {
            modifier: modifiers[index],
            modType: type,
            onSave: async (updated) => {
                const state = getState();
                const list = [...(state.modifiers[type] || [])];
                list[index] = { ...list[index], ...updated };
                await updateField(`modifiers.${type}`, list);
                render();
            }
        });
    };

    const handleDelete = async (type, index) => {
        const state = getState();
        const list = (state.modifiers[type] || []).filter((_, i) => i !== index);
        await updateField(`modifiers.${type}`, list);
        render();
    };

    const handleAdd = () => {
        openModal('add-modifier', {
            modType,
            onSave: async (modifier) => {
                const state = getState();
                const newMod = { ...modifier, id: generateId() };
                const list = [...(state.modifiers[modType] || []), newMod];
                await updateField(`modifiers.${modType}`, list);
                render();
            }
        });
    };

    return h('div', { class: 'vmt_mod_section' },
        h('div', { class: 'vmt_mod_section_header' },
            h('div', { class: 'vmt_mod_section_info' },
                h('span', { class: 'vmt_mod_section_title' }, title),
                h('span', { class: 'vmt_mod_section_subtitle' }, subtitle)
            ),
            h('button', {
                class: 'vmt_btn_small vmt_btn_add',
                onclick: handleAdd
            }, '+ Add')
        ),
        h('div', { class: 'vmt_mod_list' },
            filteredMods.length === 0
                ? h('div', { class: 'vmt_empty_small' }, `No ${modifierFilter === 'all' ? '' : modifierFilter + ' '}modifiers`)
                : filteredMods.map((mod, i) => {
                    const originalIndex = modifiers.indexOf(mod);
                    return createModifierItem(mod, modType, originalIndex, handleEdit, handleDelete);
                })
        )
    );
}

/**
 * Render the Modifiers tab content
 */
export function renderModifiersTab(openModal, render) {
    const state = getState();
    const modifiers = state.modifiers || { permanent: [], temporary: [], conditional: [] };
    const resistances = state.resistances || {};
    const immunities = state.immunities || {};

    const container = h('div', { class: 'vmt_modifiers_tab' });

    // Buff/Debuff Filter
    container.appendChild(createModFilter(modifierFilter, (filter) => {
        modifierFilter = filter;
        render();
    }));

    // Permanent Modifiers
    container.appendChild(createModifierSection(
        'Permanent',
        'Always active effects',
        'permanent',
        modifiers.permanent || [],
        openModal,
        render
    ));

    // Temporary Modifiers
    container.appendChild(createModifierSection(
        'Temporary',
        'Duration-based effects',
        'temporary',
        modifiers.temporary || [],
        openModal,
        render
    ));

    // Conditional Modifiers
    container.appendChild(createModifierSection(
        'Conditional',
        'Trigger-based effects',
        'conditional',
        modifiers.conditional || [],
        openModal,
        render
    ));

    // Resistances Section
    const resSection = h('div', { class: 'vmt_section vmt_resistances_section' },
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Resistances')
        )
    );

    const resGrid = h('div', { class: 'vmt_resistances_grid' });

    const handleResChange = async (key, value) => {
        await updateField(`resistances.${key}`, value);
        render();
    };

    for (const key of Object.keys(RESISTANCES)) {
        resGrid.appendChild(createResistanceRow(key, resistances[key] || 0, handleResChange));
    }

    resSection.appendChild(resGrid);
    container.appendChild(resSection);

    // Immunities Section
    const immSection = h('div', { class: 'vmt_section vmt_immunities_section' },
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Status Immunities')
        )
    );

    const immGrid = h('div', { class: 'vmt_immunities_grid' });

    const handleImmChange = async (key) => {
        await updateField(`immunities.${key}`, !immunities[key]);
        render();
    };

    for (const [key, label] of Object.entries(IMMUNITIES)) {
        immGrid.appendChild(createImmunityCheckbox(key, label, immunities[key], handleImmChange));
    }

    immSection.appendChild(immGrid);
    container.appendChild(immSection);

    return container;
}
