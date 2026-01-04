/**
 * Valdris Master Tracker - Stats Tab
 * Core attributes and derived stats management
 */

import { getState, updateField, calculateDerivedStats, recalculateDerivedStats } from '../state-manager.js';

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
 * Attribute display names and descriptions
 */
const ATTRIBUTE_INFO = {
    STR: {
        name: 'Strength',
        icon: '',
        description: 'Physical power. Affects Attack Power and Defense.',
        formula: 'Attack Power +1.5, Defense +0.3'
    },
    DEX: {
        name: 'Dexterity',
        icon: '',
        description: 'Agility and precision. Affects Crit Chance, Evasion, Speed.',
        formula: 'Attack +0.5, Crit +0.3, Evasion +0.8, Speed +0.5'
    },
    CON: {
        name: 'Constitution',
        icon: '',
        description: 'Endurance and vitality. Affects Defense.',
        formula: 'Defense +1.2'
    },
    INT: {
        name: 'Intelligence',
        icon: '',
        description: 'Mental acuity. Affects Magic Power and Evasion.',
        formula: 'Magic Power +1.5, Evasion +0.2'
    },
    WIS: {
        name: 'Wisdom',
        icon: '',
        description: 'Insight and willpower. Affects Magic Power and Crit Chance.',
        formula: 'Magic Power +0.5, Crit +0.1'
    },
    CHA: {
        name: 'Charisma',
        icon: '',
        description: 'Force of personality. Affects social interactions.',
        formula: 'Social skill bonuses'
    }
};

/**
 * Derived stat display info
 */
const DERIVED_INFO = {
    attackPower: {
        name: 'Attack Power',
        icon: '',
        description: 'Physical damage output',
        formula: 'STR × 1.5 + DEX × 0.5'
    },
    defense: {
        name: 'Defense',
        icon: '',
        description: 'Damage reduction',
        formula: 'CON × 1.2 + STR × 0.3'
    },
    magicPower: {
        name: 'Magic Power',
        icon: '',
        description: 'Magical damage and healing',
        formula: 'INT × 1.5 + WIS × 0.5'
    },
    critChance: {
        name: 'Crit Chance',
        icon: '',
        description: 'Critical hit probability',
        formula: '5 + DEX × 0.3 + WIS × 0.1 (max 50%)'
    },
    evasion: {
        name: 'Evasion',
        icon: '',
        description: 'Chance to dodge attacks',
        formula: 'DEX × 0.8 + INT × 0.2'
    },
    speed: {
        name: 'Speed',
        icon: '',
        description: 'Movement and action speed',
        formula: '10 + DEX × 0.5'
    }
};

/**
 * Create an editable attribute row
 */
function createAttributeRow(key, attr, onUpdate, render) {
    const info = ATTRIBUTE_INFO[key];
    const total = attr.base + attr.modifier;
    const modStr = attr.modifier >= 0 ? `+${attr.modifier}` : String(attr.modifier);

    const row = h('div', { class: 'vmt_attr_row' },
        // Icon and name
        h('div', { class: 'vmt_attr_name' },
            h('span', { class: 'vmt_attr_icon' }, info.icon),
            h('span', { class: 'vmt_attr_label' }, key),
            h('span', { class: 'vmt_attr_fullname' }, info.name)
        ),
        // Base value (editable)
        h('div', { class: 'vmt_attr_base' },
            h('label', { class: 'vmt_attr_sublabel' }, 'Base'),
            h('input', {
                type: 'number',
                class: 'vmt_input_small',
                value: attr.base,
                min: 1,
                max: 999,
                onchange: async (e) => {
                    const val = parseInt(e.target.value, 10) || 1;
                    await onUpdate(`attributes.${key}.base`, Math.max(1, val));
                    await recalculateDerivedStats();
                    render();
                }
            })
        ),
        // Modifier (editable)
        h('div', { class: 'vmt_attr_mod' },
            h('label', { class: 'vmt_attr_sublabel' }, 'Mod'),
            h('input', {
                type: 'number',
                class: 'vmt_input_small',
                value: attr.modifier,
                min: -99,
                max: 99,
                onchange: async (e) => {
                    const val = parseInt(e.target.value, 10) || 0;
                    await onUpdate(`attributes.${key}.modifier`, val);
                    await recalculateDerivedStats();
                    render();
                }
            })
        ),
        // Total display
        h('div', { class: 'vmt_attr_total' },
            h('span', { class: 'vmt_total_value' }, String(total)),
            attr.modifier !== 0
                ? h('span', { class: `vmt_total_mod ${attr.modifier > 0 ? 'positive' : 'negative'}` }, `(${modStr})`)
                : null
        ),
        // Info tooltip trigger
        h('div', {
            class: 'vmt_attr_info',
            title: `${info.description}\n\nFormula: ${info.formula}`
        }, 'ℹ')
    );

    return row;
}

/**
 * Create a derived stat row (read-only with breakdown)
 */
function createDerivedRow(key, value, attributes) {
    const info = DERIVED_INFO[key];

    // Calculate breakdown values for tooltip
    const getTotal = (attr) => attributes[attr].base + attributes[attr].modifier;
    let breakdown = '';

    switch (key) {
        case 'attackPower':
            breakdown = `STR(${getTotal('STR')}) × 1.5 + DEX(${getTotal('DEX')}) × 0.5`;
            break;
        case 'defense':
            breakdown = `CON(${getTotal('CON')}) × 1.2 + STR(${getTotal('STR')}) × 0.3`;
            break;
        case 'magicPower':
            breakdown = `INT(${getTotal('INT')}) × 1.5 + WIS(${getTotal('WIS')}) × 0.5`;
            break;
        case 'critChance':
            breakdown = `5 + DEX(${getTotal('DEX')}) × 0.3 + WIS(${getTotal('WIS')}) × 0.1`;
            break;
        case 'evasion':
            breakdown = `DEX(${getTotal('DEX')}) × 0.8 + INT(${getTotal('INT')}) × 0.2`;
            break;
        case 'speed':
            breakdown = `10 + DEX(${getTotal('DEX')}) × 0.5`;
            break;
    }

    const row = h('div', { class: 'vmt_derived_row' },
        h('div', { class: 'vmt_derived_name' },
            h('span', { class: 'vmt_derived_icon' }, info.icon),
            h('span', { class: 'vmt_derived_label' }, info.name)
        ),
        h('div', { class: 'vmt_derived_value' },
            h('span', { class: 'vmt_derived_number' }, String(value)),
            key === 'critChance' ? h('span', { class: 'vmt_derived_unit' }, '%') : null
        ),
        h('div', {
            class: 'vmt_derived_info',
            title: `${info.description}\n\nCalculation: ${breakdown}`
        }, 'ℹ')
    );

    return row;
}

/**
 * Render the Stats tab content
 */
export function renderStatsTab(openModal, render) {
    const state = getState();
    const { attributes, derivedStats } = state;

    const container = h('div', { class: 'vmt_stats_tab' });

    // Core Attributes Section
    const attrSection = h('div', { class: 'vmt_section vmt_attributes_section' },
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Core Attributes'),
            h('button', {
                class: 'vmt_btn_small',
                onclick: () => openModal('reset-attributes', {
                    onConfirm: async () => {
                        const defaultAttrs = {
                            STR: { base: 10, modifier: 0 },
                            DEX: { base: 10, modifier: 0 },
                            CON: { base: 10, modifier: 0 },
                            INT: { base: 10, modifier: 0 },
                            WIS: { base: 10, modifier: 0 },
                            CHA: { base: 10, modifier: 0 }
                        };
                        await updateField('attributes', defaultAttrs);
                        await recalculateDerivedStats();
                        render();
                    }
                })
            }, 'Reset')
        )
    );

    const attrGrid = h('div', { class: 'vmt_attr_grid' });
    for (const key of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']) {
        attrGrid.appendChild(createAttributeRow(key, attributes[key], updateField, render));
    }
    attrSection.appendChild(attrGrid);
    container.appendChild(attrSection);

    // Derived Stats Section
    const derivedSection = h('div', { class: 'vmt_section vmt_derived_section' },
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Derived Stats'),
            h('button', {
                class: 'vmt_btn_small',
                onclick: async () => {
                    await recalculateDerivedStats();
                    render();
                }
            }, 'Recalc')
        )
    );

    const derivedGrid = h('div', { class: 'vmt_derived_grid' });
    for (const key of ['attackPower', 'defense', 'magicPower', 'critChance', 'evasion', 'speed']) {
        derivedGrid.appendChild(createDerivedRow(key, derivedStats[key], attributes));
    }
    derivedSection.appendChild(derivedGrid);
    container.appendChild(derivedSection);

    // Quick Stats Summary
    const summarySection = h('div', { class: 'vmt_section vmt_summary_section' },
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Point Totals')
        ),
        h('div', { class: 'vmt_summary_grid' },
            h('div', { class: 'vmt_summary_item' },
                h('span', { class: 'vmt_summary_label' }, 'Total Base Points'),
                h('span', { class: 'vmt_summary_value' },
                    String(Object.values(attributes).reduce((sum, a) => sum + a.base, 0))
                )
            ),
            h('div', { class: 'vmt_summary_item' },
                h('span', { class: 'vmt_summary_label' }, 'Total Modifiers'),
                h('span', { class: 'vmt_summary_value' },
                    String(Object.values(attributes).reduce((sum, a) => sum + a.modifier, 0))
                )
            ),
            h('div', { class: 'vmt_summary_item' },
                h('span', { class: 'vmt_summary_label' }, 'Combined Total'),
                h('span', { class: 'vmt_summary_value vmt_highlight' },
                    String(Object.values(attributes).reduce((sum, a) => sum + a.base + a.modifier, 0))
                )
            )
        )
    );
    container.appendChild(summarySection);

    return container;
}
