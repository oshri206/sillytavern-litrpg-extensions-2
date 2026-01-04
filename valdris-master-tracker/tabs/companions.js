/**
 * Valdris Master Tracker - Companions Tab
 * Pets, summons, hirelings, and mounts with stats and status tracking
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
 * Companion types
 */
const COMPANION_TYPES = ['Pet', 'Summon', 'Hireling', 'Mount'];

/**
 * Companion statuses
 */
const COMPANION_STATUSES = ['With Party', 'Stabled', 'Dismissed', 'Dead', 'Missing'];

/**
 * Loyalty/Bond levels
 */
const BOND_LEVELS = [
    { min: 0, max: 20, name: 'Wary', color: '#dd6666' },
    { min: 21, max: 40, name: 'Neutral', color: '#aaaaaa' },
    { min: 41, max: 60, name: 'Friendly', color: '#66aa66' },
    { min: 61, max: 80, name: 'Loyal', color: '#5588ee' },
    { min: 81, max: 100, name: 'Bonded', color: '#b380ff' }
];

/**
 * Get bond level from score
 */
function getBondLevel(score) {
    for (const level of BOND_LEVELS) {
        if (score >= level.min && score <= level.max) {
            return level;
        }
    }
    return BOND_LEVELS[1]; // Default to Neutral
}

/**
 * Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Get status color
 */
function getStatusColor(status) {
    switch (status) {
        case 'With Party': return '#66dd88';
        case 'Stabled': return '#5588ee';
        case 'Dismissed': return '#aaaaaa';
        case 'Dead': return '#dd4444';
        case 'Missing': return '#ddaa33';
        default: return '#aaaaaa';
    }
}

/**
 * Get type icon
 */
function getTypeIcon(type) {
    switch (type) {
        case 'Pet': return '';
        case 'Summon': return '';
        case 'Hireling': return '';
        case 'Mount': return '';
        default: return '';
    }
}

/**
 * Create a companion card
 */
function createCompanionCard(companion, index, onEdit, onDelete, onStatusChange) {
    const bondLevel = getBondLevel(companion.bond || 50);
    const statusColor = getStatusColor(companion.status);

    return h('div', { class: `vmt_companion_card vmt_companion_${companion.type?.toLowerCase() || 'pet'}` },
        h('div', { class: 'vmt_companion_header' },
            companion.portrait ?
                h('div', { class: 'vmt_companion_portrait' },
                    h('img', { src: companion.portrait, alt: companion.name, onerror: (e) => e.target.style.display = 'none' })
                ) :
                h('div', { class: 'vmt_companion_portrait vmt_portrait_placeholder' },
                    h('span', {}, getTypeIcon(companion.type))
                ),
            h('div', { class: 'vmt_companion_info' },
                h('div', { class: 'vmt_companion_name' }, companion.name),
                h('div', { class: 'vmt_companion_type_row' },
                    h('span', { class: 'vmt_companion_type_badge' }, companion.type || 'Pet'),
                    h('span', {
                        class: 'vmt_companion_status_badge',
                        style: `background: ${statusColor}20; color: ${statusColor}; border-color: ${statusColor}40`
                    }, companion.status || 'With Party')
                )
            ),
            h('div', { class: 'vmt_companion_actions' },
                h('button', {
                    class: 'vmt_btn_icon',
                    onclick: () => onEdit(index),
                    title: 'Edit companion'
                }, ''),
                h('button', {
                    class: 'vmt_btn_icon vmt_btn_danger',
                    onclick: () => onDelete(index),
                    title: 'Remove companion'
                }, '')
            )
        ),
        // Mini stat block
        h('div', { class: 'vmt_companion_stats' },
            h('div', { class: 'vmt_companion_stat' },
                h('span', { class: 'vmt_stat_label' }, 'HP'),
                h('span', { class: 'vmt_stat_value vmt_stat_hp' }, `${companion.hp?.current || 0}/${companion.hp?.max || 0}`)
            ),
            h('div', { class: 'vmt_companion_stat' },
                h('span', { class: 'vmt_stat_label' }, 'ATK'),
                h('span', { class: 'vmt_stat_value' }, companion.attack || '-')
            ),
            h('div', { class: 'vmt_companion_stat' },
                h('span', { class: 'vmt_stat_label' }, 'DEF'),
                h('span', { class: 'vmt_stat_value' }, companion.defense || '-')
            )
        ),
        // Bond/Loyalty bar
        h('div', { class: 'vmt_companion_bond' },
            h('div', { class: 'vmt_bond_header' },
                h('span', { class: 'vmt_bond_label' }, 'Bond'),
                h('span', { class: 'vmt_bond_level', style: `color: ${bondLevel.color}` }, bondLevel.name)
            ),
            h('div', { class: 'vmt_bond_bar' },
                h('div', {
                    class: 'vmt_bond_fill',
                    style: `width: ${companion.bond || 50}%; background: linear-gradient(90deg, ${bondLevel.color}, ${bondLevel.color}aa)`
                })
            )
        ),
        // Abilities
        companion.abilities ?
            h('div', { class: 'vmt_companion_abilities' },
                h('span', { class: 'vmt_abilities_label' }, 'Abilities: '),
                h('span', { class: 'vmt_abilities_text' }, companion.abilities)
            ) : null,
        // Notes
        companion.notes ?
            h('div', { class: 'vmt_companion_notes' },
                h('span', { class: 'vmt_notes_text' }, companion.notes)
            ) : null,
        // Quick status change
        h('div', { class: 'vmt_companion_status_controls' },
            h('select', {
                class: 'vmt_status_select',
                value: companion.status || 'With Party',
                onchange: (e) => onStatusChange(index, e.target.value)
            },
                COMPANION_STATUSES.map(status =>
                    h('option', {
                        value: status,
                        selected: (companion.status || 'With Party') === status ? 'selected' : null
                    }, status)
                )
            )
        )
    );
}

// Local filter state
let typeFilter = 'All';
let statusFilter = 'All';

/**
 * Render the Companions tab content
 */
export function renderCompanionsTab(openModal, render) {
    const state = getState();
    const companions = state.companions || [];

    const container = h('div', { class: 'vmt_companions_tab' });

    // Summary section
    const summary = h('div', { class: 'vmt_companions_summary' },
        h('div', { class: 'vmt_summary_item' },
            h('div', { class: 'vmt_summary_label' }, 'Total'),
            h('div', { class: 'vmt_summary_value' }, companions.length)
        ),
        h('div', { class: 'vmt_summary_item vmt_summary_active' },
            h('div', { class: 'vmt_summary_label' }, 'Active'),
            h('div', { class: 'vmt_summary_value' },
                companions.filter(c => c.status === 'With Party').length
            )
        ),
        ...COMPANION_TYPES.map(type => {
            const count = companions.filter(c => c.type === type).length;
            return h('div', { class: `vmt_summary_item vmt_summary_${type.toLowerCase()}` },
                h('div', { class: 'vmt_summary_label' }, type),
                h('div', { class: 'vmt_summary_value' }, count)
            );
        })
    );
    container.appendChild(summary);

    // Main section
    const mainSection = h('div', { class: 'vmt_section vmt_companions_section' },
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Companions'),
            h('button', {
                class: 'vmt_btn_small vmt_btn_add',
                onclick: () => openModal('add-companion', {
                    onSave: async (companion) => {
                        const newCompanion = {
                            ...companion,
                            id: generateId()
                        };
                        const updated = [...companions, newCompanion];
                        await updateField('companions', updated);
                        render();
                    }
                })
            }, '+ Add')
        )
    );

    // Filters
    const filterRow = h('div', { class: 'vmt_companions_filters' },
        h('div', { class: 'vmt_filter_group' },
            h('span', { class: 'vmt_filter_label' }, 'Type:'),
            h('select', {
                class: 'vmt_filter_select',
                onchange: (e) => { typeFilter = e.target.value; render(); }
            },
                h('option', { value: 'All', selected: typeFilter === 'All' ? 'selected' : null }, 'All'),
                ...COMPANION_TYPES.map(type =>
                    h('option', { value: type, selected: typeFilter === type ? 'selected' : null }, type)
                )
            )
        ),
        h('div', { class: 'vmt_filter_group' },
            h('span', { class: 'vmt_filter_label' }, 'Status:'),
            h('select', {
                class: 'vmt_filter_select',
                onchange: (e) => { statusFilter = e.target.value; render(); }
            },
                h('option', { value: 'All', selected: statusFilter === 'All' ? 'selected' : null }, 'All'),
                ...COMPANION_STATUSES.map(status =>
                    h('option', { value: status, selected: statusFilter === status ? 'selected' : null }, status)
                )
            )
        )
    );
    mainSection.appendChild(filterRow);

    // Companions list
    let filteredCompanions = companions;
    if (typeFilter !== 'All') {
        filteredCompanions = filteredCompanions.filter(c => c.type === typeFilter);
    }
    if (statusFilter !== 'All') {
        filteredCompanions = filteredCompanions.filter(c => (c.status || 'With Party') === statusFilter);
    }

    const companionsList = h('div', { class: 'vmt_companions_list' });

    if (filteredCompanions.length === 0) {
        companionsList.appendChild(h('div', { class: 'vmt_empty' }, 'No companions'));
    } else {
        filteredCompanions.forEach((companion, i) => {
            const originalIndex = companions.indexOf(companion);
            companionsList.appendChild(createCompanionCard(
                companion,
                originalIndex,
                // Edit
                (idx) => openModal('edit-companion', {
                    companion: companions[idx],
                    onSave: async (updated) => {
                        const list = [...companions];
                        list[idx] = { ...list[idx], ...updated };
                        await updateField('companions', list);
                        render();
                    }
                }),
                // Delete
                async (idx) => {
                    const list = companions.filter((_, j) => j !== idx);
                    await updateField('companions', list);
                    render();
                },
                // Status change
                async (idx, newStatus) => {
                    const list = [...companions];
                    list[idx] = { ...list[idx], status: newStatus };
                    await updateField('companions', list);
                    render();
                }
            ));
        });
    }

    mainSection.appendChild(companionsList);
    container.appendChild(mainSection);

    return container;
}
