/**
 * Valdris Master Tracker - Spells Tab
 * Spell list, spell slots, filtering and sorting
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
 * Spell schools/elements
 */
const SPELL_SCHOOLS = [
    'Evocation', 'Conjuration', 'Abjuration', 'Transmutation',
    'Divination', 'Enchantment', 'Illusion', 'Necromancy',
    'Fire', 'Ice', 'Lightning', 'Earth', 'Water', 'Wind',
    'Light', 'Dark', 'Arcane', 'Nature', 'Holy', 'Unholy'
];

/**
 * Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Local filter/sort state
let spellFilter = 'All';
let spellSort = 'name';

/**
 * Create a spell item card
 */
function createSpellItem(spell, index, onEdit, onDelete) {
    const costChanged = spell.defaultManaCost !== spell.currentManaCost;
    const damageChanged = spell.defaultDamageEffect !== spell.currentDamageEffect;

    return h('div', { class: `vmt_spell_item ${spell.concentration ? 'vmt_spell_concentration' : ''}` },
        h('div', { class: 'vmt_spell_header_row' },
            h('div', { class: 'vmt_spell_name_section' },
                h('span', { class: 'vmt_spell_name' }, spell.name),
                spell.concentration ? h('span', { class: 'vmt_spell_conc_badge' }, 'C') : null
            ),
            h('div', { class: 'vmt_spell_actions' },
                h('button', {
                    class: 'vmt_btn_icon',
                    onclick: () => onEdit(index),
                    title: 'Edit spell'
                }, ''),
                h('button', {
                    class: 'vmt_btn_icon vmt_btn_danger',
                    onclick: () => onDelete(index),
                    title: 'Delete spell'
                }, '')
            )
        ),
        spell.description ? h('div', { class: 'vmt_spell_desc' }, spell.description) : null,
        h('div', { class: 'vmt_spell_meta' },
            h('span', { class: 'vmt_spell_badge vmt_badge_school' }, spell.school || 'Arcane'),
            spell.level !== undefined ? h('span', { class: 'vmt_spell_badge vmt_badge_level' }, spell.level === 0 ? 'Cantrip' : `Lv ${spell.level}`) : null
        ),
        h('div', { class: 'vmt_spell_stats' },
            h('div', { class: 'vmt_spell_stat_item' },
                h('span', { class: 'vmt_spell_stat_label' }, 'Mana'),
                h('span', { class: `vmt_spell_stat_value ${costChanged ? 'vmt_modified' : ''}` },
                    String(spell.currentManaCost ?? spell.defaultManaCost ?? 0),
                    costChanged ? h('span', { class: 'vmt_spell_default' }, ` (${spell.defaultManaCost})`) : null
                )
            ),
            h('div', { class: 'vmt_spell_stat_item' },
                h('span', { class: 'vmt_spell_stat_label' }, 'Effect'),
                h('span', { class: `vmt_spell_stat_value ${damageChanged ? 'vmt_modified' : ''}` },
                    spell.currentDamageEffect || spell.defaultDamageEffect || '-',
                    damageChanged ? h('span', { class: 'vmt_spell_default' }, ` (${spell.defaultDamageEffect})`) : null
                )
            )
        ),
        h('div', { class: 'vmt_spell_details' },
            spell.castingTime ? h('span', { class: 'vmt_spell_detail' }, `Cast: ${spell.castingTime}`) : null,
            spell.range ? h('span', { class: 'vmt_spell_detail' }, `Range: ${spell.range}`) : null,
            spell.duration ? h('span', { class: 'vmt_spell_detail' }, `Duration: ${spell.duration}`) : null
        )
    );
}

/**
 * Create spell slot tracker for a level
 */
function createSpellSlotRow(level, slotData, onUpdate) {
    const used = slotData.used || 0;
    const max = slotData.max || 0;
    const remaining = max - used;

    return h('div', { class: 'vmt_slot_row' },
        h('span', { class: 'vmt_slot_level' }, level === 0 ? 'Cantrip' : `Lv ${level}`),
        h('div', { class: 'vmt_slot_controls' },
            h('button', {
                class: 'vmt_btn_slot vmt_btn_decrement',
                onclick: () => onUpdate(level, 'used', Math.max(0, used - 1)),
                disabled: used <= 0
            }, '-'),
            h('span', { class: 'vmt_slot_count' }, `${remaining}/${max}`),
            h('button', {
                class: 'vmt_btn_slot vmt_btn_increment',
                onclick: () => onUpdate(level, 'used', Math.min(max, used + 1)),
                disabled: used >= max
            }, '+')
        ),
        h('div', { class: 'vmt_slot_max_control' },
            h('label', { class: 'vmt_slot_max_label' }, 'Max:'),
            h('input', {
                type: 'number',
                class: 'vmt_input_tiny',
                value: max,
                min: 0,
                max: 20,
                onchange: (e) => onUpdate(level, 'max', parseInt(e.target.value, 10) || 0)
            })
        )
    );
}

/**
 * Create school filter dropdown
 */
function createSchoolFilter(activeFilter, onFilterChange) {
    return h('div', { class: 'vmt_spell_filters' },
        h('select', {
            class: 'vmt_filter_select',
            value: activeFilter,
            onchange: (e) => onFilterChange(e.target.value)
        },
            h('option', { value: 'All' }, 'All Schools'),
            ...SPELL_SCHOOLS.map(school =>
                h('option', { value: school, selected: activeFilter === school ? 'selected' : null }, school)
            )
        )
    );
}

/**
 * Create sort dropdown
 */
function createSortSelect(activeSort, onSortChange) {
    return h('div', { class: 'vmt_spell_sort' },
        h('label', { class: 'vmt_sort_label' }, 'Sort:'),
        h('select', {
            class: 'vmt_sort_select',
            value: activeSort,
            onchange: (e) => onSortChange(e.target.value)
        },
            h('option', { value: 'name', selected: activeSort === 'name' ? 'selected' : null }, 'Name'),
            h('option', { value: 'level', selected: activeSort === 'level' ? 'selected' : null }, 'Level'),
            h('option', { value: 'cost', selected: activeSort === 'cost' ? 'selected' : null }, 'Mana Cost'),
            h('option', { value: 'school', selected: activeSort === 'school' ? 'selected' : null }, 'School')
        )
    );
}

/**
 * Render the Spells tab content
 */
export function renderSpellsTab(openModal, render) {
    const state = getState();
    const spells = state.spells || [];
    const spellSlots = state.spellSlots || {};

    const container = h('div', { class: 'vmt_spells_tab' });

    // Spell Slots Section
    const slotsSection = h('div', { class: 'vmt_section vmt_spell_slots_section' },
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Spell Slots'),
            h('button', {
                class: 'vmt_btn_small',
                onclick: async () => {
                    // Reset all slots
                    const resetSlots = {};
                    for (let i = 1; i <= 9; i++) {
                        resetSlots[i] = { used: 0, max: spellSlots[i]?.max || 0 };
                    }
                    await updateField('spellSlots', resetSlots);
                    render();
                }
            }, 'Rest')
        )
    );

    const slotsGrid = h('div', { class: 'vmt_slots_grid' });

    const handleSlotUpdate = async (level, field, value) => {
        await updateField(`spellSlots.${level}.${field}`, value);
        render();
    };

    for (let level = 1; level <= 9; level++) {
        const slotData = spellSlots[level] || { used: 0, max: 0 };
        if (slotData.max > 0 || level <= 3) {
            slotsGrid.appendChild(createSpellSlotRow(level, slotData, handleSlotUpdate));
        }
    }

    slotsSection.appendChild(slotsGrid);
    container.appendChild(slotsSection);

    // Spells List Section
    const spellsSection = h('div', { class: 'vmt_section vmt_spells_list_section' },
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Spells'),
            h('button', {
                class: 'vmt_btn_small vmt_btn_add',
                onclick: () => openModal('add-spell', {
                    onSave: async (spell) => {
                        const newSpell = { ...spell, id: generateId() };
                        const updated = [...spells, newSpell];
                        await updateField('spells', updated);
                        render();
                    }
                })
            }, '+ Add')
        )
    );

    // Filter and sort controls
    const controlsRow = h('div', { class: 'vmt_spell_controls' },
        createSchoolFilter(spellFilter, (filter) => {
            spellFilter = filter;
            render();
        }),
        createSortSelect(spellSort, (sort) => {
            spellSort = sort;
            render();
        })
    );
    spellsSection.appendChild(controlsRow);

    // Filter spells
    let filteredSpells = spellFilter === 'All'
        ? [...spells]
        : spells.filter(s => s.school === spellFilter);

    // Sort spells
    filteredSpells.sort((a, b) => {
        switch (spellSort) {
            case 'name':
                return (a.name || '').localeCompare(b.name || '');
            case 'level':
                return (a.level || 0) - (b.level || 0);
            case 'cost':
                return (a.currentManaCost ?? a.defaultManaCost ?? 0) - (b.currentManaCost ?? b.defaultManaCost ?? 0);
            case 'school':
                return (a.school || '').localeCompare(b.school || '');
            default:
                return 0;
        }
    });

    const spellsList = h('div', { class: 'vmt_spells_list' });
    if (filteredSpells.length === 0) {
        spellsList.appendChild(h('div', { class: 'vmt_empty' }, 'No spells known'));
    } else {
        filteredSpells.forEach((spell) => {
            const originalIndex = spells.indexOf(spell);
            spellsList.appendChild(createSpellItem(
                spell,
                originalIndex,
                (idx) => openModal('edit-spell', {
                    spell: spells[idx],
                    onSave: async (updated) => {
                        const list = [...spells];
                        list[idx] = { ...list[idx], ...updated };
                        await updateField('spells', list);
                        render();
                    }
                }),
                async (idx) => {
                    const list = spells.filter((_, j) => j !== idx);
                    await updateField('spells', list);
                    render();
                }
            ));
        });
    }
    spellsSection.appendChild(spellsList);
    container.appendChild(spellsSection);

    return container;
}
