/**
 * Valdris Master Tracker - Transformations Tab
 * Track permanent or temporary form changes
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
 * Transformation types
 */
const TRANSFORMATION_TYPES = ['Racial', 'Curse', 'Blessing', 'Magical', 'Class', 'Other'];

/**
 * Duration types
 */
const DURATION_TYPES = ['Permanent', 'Temporary', 'Conditional'];

/**
 * Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Get type color
 */
function getTypeColor(type) {
    switch (type) {
        case 'Racial': return '#aa7744';
        case 'Curse': return '#dd4444';
        case 'Blessing': return '#ffdd77';
        case 'Magical': return '#b380ff';
        case 'Class': return '#5588ee';
        default: return '#aaaaaa';
    }
}

/**
 * Get duration color
 */
function getDurationColor(duration) {
    switch (duration) {
        case 'Permanent': return '#66aa66';
        case 'Temporary': return '#ddaa33';
        case 'Conditional': return '#5588ee';
        default: return '#aaaaaa';
    }
}

/**
 * Check if transformation has expired
 */
function isExpired(transformation) {
    if (transformation.duration !== 'Temporary' || !transformation.expiresAt) return false;
    return new Date(transformation.expiresAt) < new Date();
}

/**
 * Format expiration date
 */
function formatExpiration(expiresAt) {
    if (!expiresAt) return '';
    const date = new Date(expiresAt);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Local state for expanded transformations
let expandedTransformations = new Set();

/**
 * Create a transformation item
 */
function createTransformationItem(transformation, index, onEdit, onDelete, onToggleActive, render) {
    const typeColor = getTypeColor(transformation.type);
    const durationColor = getDurationColor(transformation.duration);
    const isExpanded = expandedTransformations.has(transformation.id);
    const expired = isExpired(transformation);

    return h('div', {
        class: `vmt_transformation_item ${transformation.active ? 'vmt_active' : 'vmt_inactive'} ${expired ? 'vmt_expired' : ''}`,
        style: `border-left-color: ${typeColor}`
    },
        // Header
        h('div', { class: 'vmt_transformation_header' },
            // Toggle button for conditional/toggleable transformations
            (transformation.duration === 'Conditional' || transformation.reversible) ?
                h('button', {
                    class: `vmt_toggle_btn ${transformation.active ? 'active' : ''}`,
                    onclick: () => onToggleActive(index),
                    title: transformation.active ? 'Deactivate' : 'Activate'
                }, transformation.active ? '' : '') : null,
            h('div', {
                class: 'vmt_transformation_expand_toggle',
                onclick: () => {
                    if (isExpanded) {
                        expandedTransformations.delete(transformation.id);
                    } else {
                        expandedTransformations.add(transformation.id);
                    }
                    render();
                }
            }, isExpanded ? '▼' : '▶'),
            h('div', { class: 'vmt_transformation_info' },
                h('div', { class: 'vmt_transformation_name' },
                    transformation.name || 'Unnamed Transformation',
                    !transformation.active ? h('span', { class: 'vmt_inactive_badge' }, '(Inactive)') : null,
                    expired ? h('span', { class: 'vmt_expired_badge' }, '(Expired)') : null
                ),
                h('div', { class: 'vmt_transformation_meta_row' },
                    h('span', {
                        class: 'vmt_transformation_type_badge',
                        style: `background: ${typeColor}20; color: ${typeColor}; border-color: ${typeColor}40`
                    }, transformation.type || 'Other'),
                    h('span', {
                        class: 'vmt_transformation_duration_badge',
                        style: `background: ${durationColor}20; color: ${durationColor}; border-color: ${durationColor}40`
                    }, transformation.duration || 'Permanent'),
                    transformation.reversible ? h('span', { class: 'vmt_reversible_badge' }, 'Reversible') : null
                )
            ),
            h('div', { class: 'vmt_transformation_actions' },
                h('button', {
                    class: 'vmt_btn_icon',
                    onclick: () => onEdit(index),
                    title: 'Edit transformation'
                }, ''),
                h('button', {
                    class: 'vmt_btn_icon vmt_btn_danger',
                    onclick: () => onDelete(index),
                    title: 'Remove transformation'
                }, '')
            )
        ),
        // Quick effects preview (always visible if active)
        transformation.active && transformation.effects && transformation.effects.length > 0 ?
            h('div', { class: 'vmt_transformation_effects_preview' },
                transformation.effects.slice(0, 3).map(effect =>
                    h('span', { class: 'vmt_effect_badge' }, effect)
                ),
                transformation.effects.length > 3 ?
                    h('span', { class: 'vmt_effect_more' }, `+${transformation.effects.length - 3} more`) : null
            ) : null,
        // Expanded details
        isExpanded ? h('div', { class: 'vmt_transformation_details' },
            transformation.source ? h('div', { class: 'vmt_transformation_source' },
                h('span', { class: 'vmt_label' }, 'Source: '),
                h('span', { class: 'vmt_value' }, transformation.source)
            ) : null,
            transformation.description ? h('div', { class: 'vmt_transformation_description' }, transformation.description) : null,
            // All effects
            transformation.effects && transformation.effects.length > 0 ? h('div', { class: 'vmt_transformation_effects' },
                h('div', { class: 'vmt_section_label' }, 'Effects'),
                h('div', { class: 'vmt_effects_list' },
                    transformation.effects.map(effect =>
                        h('div', { class: 'vmt_effect_item' }, effect)
                    )
                )
            ) : null,
            // Expiration for temporary
            transformation.duration === 'Temporary' && transformation.expiresAt ? h('div', {
                class: `vmt_transformation_expiration ${expired ? 'expired' : ''}`
            },
                h('span', { class: 'vmt_label' }, expired ? 'Expired: ' : 'Expires: '),
                h('span', { class: 'vmt_value' }, formatExpiration(transformation.expiresAt))
            ) : null,
            // Reversal method
            transformation.reversible && transformation.reversalMethod ? h('div', { class: 'vmt_transformation_reversal' },
                h('span', { class: 'vmt_label' }, 'To reverse: '),
                h('span', { class: 'vmt_value' }, transformation.reversalMethod)
            ) : null
        ) : null
    );
}

// Local filter state
let typeFilter = 'All';
let activeFilter = 'All';

/**
 * Render the Transformations tab content
 */
export function renderTransformationsTab(openModal, render) {
    const state = getState();
    const transformations = state.transformations || [];

    const container = h('div', { class: 'vmt_transformations_tab' });

    // Calculate counts
    const activeCount = transformations.filter(t => t.active).length;
    const permanentCount = transformations.filter(t => t.duration === 'Permanent').length;
    const temporaryCount = transformations.filter(t => t.duration === 'Temporary').length;
    const curseCount = transformations.filter(t => t.type === 'Curse' && t.active).length;
    const blessingCount = transformations.filter(t => t.type === 'Blessing' && t.active).length;

    // Summary section
    const summary = h('div', { class: 'vmt_transformations_summary' },
        h('div', { class: 'vmt_summary_item' },
            h('div', { class: 'vmt_summary_label' }, 'Total'),
            h('div', { class: 'vmt_summary_value' }, transformations.length)
        ),
        h('div', { class: 'vmt_summary_item vmt_summary_active' },
            h('div', { class: 'vmt_summary_label' }, 'Active'),
            h('div', { class: 'vmt_summary_value' }, activeCount)
        ),
        curseCount > 0 ? h('div', { class: 'vmt_summary_item vmt_summary_curse' },
            h('div', { class: 'vmt_summary_label' }, 'Curses'),
            h('div', { class: 'vmt_summary_value' }, curseCount)
        ) : null,
        blessingCount > 0 ? h('div', { class: 'vmt_summary_item vmt_summary_blessing' },
            h('div', { class: 'vmt_summary_label' }, 'Blessings'),
            h('div', { class: 'vmt_summary_value' }, blessingCount)
        ) : null
    );
    container.appendChild(summary);

    // Main section
    const mainSection = h('div', { class: 'vmt_section vmt_transformations_section' },
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Transformations'),
            h('button', {
                class: 'vmt_btn_small vmt_btn_add',
                onclick: () => openModal('add-transformation', {
                    onSave: async (transformation) => {
                        const newTransformation = {
                            ...transformation,
                            id: generateId(),
                            active: true
                        };
                        const updated = [...transformations, newTransformation];
                        await updateField('transformations', updated);
                        render();
                    }
                })
            }, '+ Add')
        )
    );

    // Filters
    const filterRow = h('div', { class: 'vmt_transformations_filters' },
        h('div', { class: 'vmt_filter_group' },
            h('span', { class: 'vmt_filter_label' }, 'Type:'),
            h('select', {
                class: 'vmt_filter_select',
                onchange: (e) => { typeFilter = e.target.value; render(); }
            },
                h('option', { value: 'All', selected: typeFilter === 'All' ? 'selected' : null }, 'All'),
                ...TRANSFORMATION_TYPES.map(type =>
                    h('option', { value: type, selected: typeFilter === type ? 'selected' : null }, type)
                )
            )
        ),
        h('div', { class: 'vmt_filter_group' },
            h('span', { class: 'vmt_filter_label' }, 'Status:'),
            h('select', {
                class: 'vmt_filter_select',
                onchange: (e) => { activeFilter = e.target.value; render(); }
            },
                h('option', { value: 'All', selected: activeFilter === 'All' ? 'selected' : null }, 'All'),
                h('option', { value: 'Active', selected: activeFilter === 'Active' ? 'selected' : null }, 'Active'),
                h('option', { value: 'Inactive', selected: activeFilter === 'Inactive' ? 'selected' : null }, 'Inactive')
            )
        )
    );
    mainSection.appendChild(filterRow);

    // Transformations list
    let filteredTransformations = transformations;
    if (typeFilter !== 'All') {
        filteredTransformations = filteredTransformations.filter(t => t.type === typeFilter);
    }
    if (activeFilter !== 'All') {
        filteredTransformations = filteredTransformations.filter(t =>
            activeFilter === 'Active' ? t.active : !t.active
        );
    }

    // Sort: Active first, then by type
    filteredTransformations.sort((a, b) => {
        if (a.active && !b.active) return -1;
        if (b.active && !a.active) return 1;
        return 0;
    });

    const transformationsList = h('div', { class: 'vmt_transformations_list' });

    if (filteredTransformations.length === 0) {
        transformationsList.appendChild(h('div', { class: 'vmt_empty' }, 'No transformations'));
    } else {
        filteredTransformations.forEach((transformation) => {
            const originalIndex = transformations.indexOf(transformation);
            transformationsList.appendChild(createTransformationItem(
                transformation,
                originalIndex,
                // Edit
                (idx) => openModal('edit-transformation', {
                    transformation: transformations[idx],
                    onSave: async (updated) => {
                        const list = [...transformations];
                        list[idx] = { ...list[idx], ...updated };
                        await updateField('transformations', list);
                        render();
                    }
                }),
                // Delete
                async (idx) => {
                    const list = transformations.filter((_, j) => j !== idx);
                    expandedTransformations.delete(transformations[idx].id);
                    await updateField('transformations', list);
                    render();
                },
                // Toggle active
                async (idx) => {
                    const list = [...transformations];
                    list[idx] = { ...list[idx], active: !list[idx].active };
                    await updateField('transformations', list);
                    render();
                },
                render
            ));
        });
    }

    mainSection.appendChild(transformationsList);
    container.appendChild(mainSection);

    return container;
}
