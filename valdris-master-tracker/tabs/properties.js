/**
 * Valdris Master Tracker - Properties Tab
 * Track owned locations and assets
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
 * Property types
 */
const PROPERTY_TYPES = ['Home', 'Shop', 'Land', 'Business', 'Stronghold', 'Other'];

/**
 * Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Format gold value
 */
function formatGold(value) {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return String(value);
}

/**
 * Get type icon
 */
function getTypeIcon(type) {
    switch (type) {
        case 'Home': return '';
        case 'Shop': return '';
        case 'Land': return '';
        case 'Business': return '';
        case 'Stronghold': return '';
        default: return '';
    }
}

/**
 * Get type color
 */
function getTypeColor(type) {
    switch (type) {
        case 'Home': return '#66aa66';
        case 'Shop': return '#ddaa33';
        case 'Land': return '#aa7744';
        case 'Business': return '#5588ee';
        case 'Stronghold': return '#b380ff';
        default: return '#aaaaaa';
    }
}

// Local state for expanded properties
let expandedProperties = new Set();

/**
 * Create a property card
 */
function createPropertyCard(property, index, onEdit, onDelete, render) {
    const typeColor = getTypeColor(property.type);
    const isExpanded = expandedProperties.has(property.id);
    const netIncome = (property.income || 0) - (property.expenses || 0);

    return h('div', {
        class: 'vmt_property_card',
        style: `border-left-color: ${typeColor}`
    },
        // Header
        h('div', { class: 'vmt_property_header' },
            h('div', {
                class: 'vmt_property_expand_toggle',
                onclick: () => {
                    if (isExpanded) {
                        expandedProperties.delete(property.id);
                    } else {
                        expandedProperties.add(property.id);
                    }
                    render();
                }
            }, isExpanded ? '▼' : '▶'),
            h('div', { class: 'vmt_property_icon', style: `color: ${typeColor}` }, getTypeIcon(property.type)),
            h('div', { class: 'vmt_property_info' },
                h('div', { class: 'vmt_property_name' }, property.name || 'Unnamed Property'),
                h('div', { class: 'vmt_property_meta_row' },
                    h('span', {
                        class: 'vmt_property_type_badge',
                        style: `background: ${typeColor}20; color: ${typeColor}; border-color: ${typeColor}40`
                    }, property.type || 'Other'),
                    property.location ? h('span', { class: 'vmt_property_location' }, property.location) : null
                )
            ),
            h('div', { class: 'vmt_property_value_display' },
                h('div', { class: 'vmt_property_value_amount' }, `${formatGold(property.value || 0)}`),
                netIncome !== 0 ? h('div', {
                    class: `vmt_property_income ${netIncome > 0 ? 'positive' : 'negative'}`
                }, `${netIncome > 0 ? '+' : ''}${formatGold(netIncome)}/period`) : null
            ),
            h('div', { class: 'vmt_property_actions' },
                h('button', {
                    class: 'vmt_btn_icon',
                    onclick: () => onEdit(index),
                    title: 'Edit property'
                }, ''),
                h('button', {
                    class: 'vmt_btn_icon vmt_btn_danger',
                    onclick: () => onDelete(index),
                    title: 'Remove property'
                }, '')
            )
        ),
        // Expanded details
        isExpanded ? h('div', { class: 'vmt_property_details' },
            property.description ? h('div', { class: 'vmt_property_description' }, property.description) : null,
            // Income/Expenses breakdown
            (property.income > 0 || property.expenses > 0) ? h('div', { class: 'vmt_property_finances' },
                h('div', { class: 'vmt_finance_item income' },
                    h('span', { class: 'vmt_label' }, 'Income: '),
                    h('span', { class: 'vmt_value' }, `${formatGold(property.income || 0)}/period`)
                ),
                h('div', { class: 'vmt_finance_item expenses' },
                    h('span', { class: 'vmt_label' }, 'Expenses: '),
                    h('span', { class: 'vmt_value' }, `${formatGold(property.expenses || 0)}/period`)
                ),
                h('div', { class: `vmt_finance_item net ${netIncome >= 0 ? 'positive' : 'negative'}` },
                    h('span', { class: 'vmt_label' }, 'Net: '),
                    h('span', { class: 'vmt_value' }, `${netIncome >= 0 ? '+' : ''}${formatGold(netIncome)}/period`)
                )
            ) : null,
            // Staff list
            (property.staff && property.staff.length > 0) ? h('div', { class: 'vmt_property_staff' },
                h('div', { class: 'vmt_section_label' }, 'Staff'),
                h('div', { class: 'vmt_staff_list' },
                    property.staff.map(s =>
                        h('div', { class: 'vmt_staff_item' },
                            h('span', { class: 'vmt_staff_name' }, s.name),
                            h('span', { class: 'vmt_staff_role' }, s.role)
                        )
                    )
                )
            ) : null,
            // Upgrades list
            (property.upgrades && property.upgrades.length > 0) ? h('div', { class: 'vmt_property_upgrades' },
                h('div', { class: 'vmt_section_label' }, 'Upgrades'),
                h('div', { class: 'vmt_upgrades_list' },
                    property.upgrades.map(u =>
                        h('span', { class: 'vmt_upgrade_badge' }, u)
                    )
                )
            ) : null,
            // Notes
            property.notes ? h('div', { class: 'vmt_property_notes' }, property.notes) : null
        ) : null
    );
}

// Local filter state
let typeFilter = 'All';

/**
 * Render the Properties tab content
 */
export function renderPropertiesTab(openModal, render) {
    const state = getState();
    const properties = state.properties || [];

    const container = h('div', { class: 'vmt_properties_tab' });

    // Calculate totals
    const totalValue = properties.reduce((sum, p) => sum + (p.value || 0), 0);
    const totalIncome = properties.reduce((sum, p) => sum + (p.income || 0), 0);
    const totalExpenses = properties.reduce((sum, p) => sum + (p.expenses || 0), 0);
    const netIncome = totalIncome - totalExpenses;

    // Summary section
    const summary = h('div', { class: 'vmt_properties_summary' },
        h('div', { class: 'vmt_summary_item vmt_summary_total_value' },
            h('div', { class: 'vmt_summary_label' }, 'Total Value'),
            h('div', { class: 'vmt_summary_value vmt_highlight' }, `${formatGold(totalValue)}`)
        ),
        h('div', { class: 'vmt_summary_item vmt_summary_income' },
            h('div', { class: 'vmt_summary_label' }, 'Income'),
            h('div', { class: 'vmt_summary_value positive' }, `+${formatGold(totalIncome)}`)
        ),
        h('div', { class: 'vmt_summary_item vmt_summary_expenses' },
            h('div', { class: 'vmt_summary_label' }, 'Expenses'),
            h('div', { class: 'vmt_summary_value negative' }, `-${formatGold(totalExpenses)}`)
        ),
        h('div', { class: `vmt_summary_item vmt_summary_net ${netIncome >= 0 ? 'positive' : 'negative'}` },
            h('div', { class: 'vmt_summary_label' }, 'Net'),
            h('div', { class: 'vmt_summary_value' }, `${netIncome >= 0 ? '+' : ''}${formatGold(netIncome)}`)
        )
    );
    container.appendChild(summary);

    // Main section
    const mainSection = h('div', { class: 'vmt_section vmt_properties_section' },
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Properties'),
            h('button', {
                class: 'vmt_btn_small vmt_btn_add',
                onclick: () => openModal('add-property', {
                    onSave: async (property) => {
                        const newProperty = {
                            ...property,
                            id: generateId()
                        };
                        const updated = [...properties, newProperty];
                        await updateField('properties', updated);
                        render();
                    }
                })
            }, '+ Add')
        )
    );

    // Filters
    const filterRow = h('div', { class: 'vmt_properties_filters' },
        h('div', { class: 'vmt_filter_group' },
            h('span', { class: 'vmt_filter_label' }, 'Type:'),
            h('select', {
                class: 'vmt_filter_select',
                onchange: (e) => { typeFilter = e.target.value; render(); }
            },
                h('option', { value: 'All', selected: typeFilter === 'All' ? 'selected' : null }, 'All'),
                ...PROPERTY_TYPES.map(type =>
                    h('option', { value: type, selected: typeFilter === type ? 'selected' : null }, type)
                )
            )
        )
    );
    mainSection.appendChild(filterRow);

    // Properties list
    let filteredProperties = properties;
    if (typeFilter !== 'All') {
        filteredProperties = filteredProperties.filter(p => p.type === typeFilter);
    }

    // Sort by value descending
    filteredProperties.sort((a, b) => (b.value || 0) - (a.value || 0));

    const propertiesList = h('div', { class: 'vmt_properties_list' });

    if (filteredProperties.length === 0) {
        propertiesList.appendChild(h('div', { class: 'vmt_empty' }, 'No properties owned'));
    } else {
        filteredProperties.forEach((property) => {
            const originalIndex = properties.indexOf(property);
            propertiesList.appendChild(createPropertyCard(
                property,
                originalIndex,
                // Edit
                (idx) => openModal('edit-property', {
                    property: properties[idx],
                    onSave: async (updated) => {
                        const list = [...properties];
                        list[idx] = { ...list[idx], ...updated };
                        await updateField('properties', list);
                        render();
                    }
                }),
                // Delete
                async (idx) => {
                    const list = properties.filter((_, j) => j !== idx);
                    expandedProperties.delete(properties[idx].id);
                    await updateField('properties', list);
                    render();
                },
                render
            ));
        });
    }

    mainSection.appendChild(propertiesList);
    container.appendChild(mainSection);

    return container;
}
