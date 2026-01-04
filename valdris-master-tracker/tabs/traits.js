/**
 * Valdris Master Tracker - Traits Tab
 * Character traits with categories: Innate, Acquired, Racial, Background
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
 * Trait categories
 */
const TRAIT_CATEGORIES = [
    { key: 'innate', label: 'Innate', description: 'Natural abilities you were born with' },
    { key: 'acquired', label: 'Acquired', description: 'Traits gained through experience or training' },
    { key: 'racial', label: 'Racial', description: 'Traits from your race or species' },
    { key: 'background', label: 'Background', description: 'Traits from your backstory or upbringing' }
];

/**
 * Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Local filter state
let traitFilter = 'All';

/**
 * Get category color class
 */
function getCategoryClass(category) {
    switch (category) {
        case 'innate': return 'vmt_trait_innate';
        case 'acquired': return 'vmt_trait_acquired';
        case 'racial': return 'vmt_trait_racial';
        case 'background': return 'vmt_trait_background';
        default: return '';
    }
}

/**
 * Create a trait item card
 */
function createTraitItem(trait, index, onEdit, onDelete) {
    const categoryInfo = TRAIT_CATEGORIES.find(c => c.key === trait.category) || { label: 'Unknown' };

    return h('div', { class: `vmt_trait_item ${getCategoryClass(trait.category)}` },
        h('div', { class: 'vmt_trait_header_row' },
            h('div', { class: 'vmt_trait_name' }, trait.name),
            h('div', { class: 'vmt_trait_actions' },
                h('button', {
                    class: 'vmt_btn_icon',
                    onclick: () => onEdit(index),
                    title: 'Edit trait'
                }, ''),
                h('button', {
                    class: 'vmt_btn_icon vmt_btn_danger',
                    onclick: () => onDelete(index),
                    title: 'Delete trait'
                }, '')
            )
        ),
        trait.description ? h('div', { class: 'vmt_trait_desc' }, trait.description) : null,
        h('div', { class: 'vmt_trait_meta' },
            h('span', { class: 'vmt_trait_badge vmt_badge_category' }, categoryInfo.label),
            trait.source ? h('span', { class: 'vmt_trait_source' }, `Source: ${trait.source}`) : null
        ),
        trait.mechanicalEffect ? h('div', { class: 'vmt_trait_effect' },
            h('span', { class: 'vmt_effect_label' }, 'Effect:'),
            h('span', { class: 'vmt_effect_text' }, trait.mechanicalEffect)
        ) : null
    );
}

/**
 * Create category filter buttons
 */
function createCategoryFilter(activeFilter, onFilterChange, traitCounts) {
    return h('div', { class: 'vmt_trait_filters' },
        h('button', {
            class: `vmt_filter_btn ${activeFilter === 'All' ? 'active' : ''}`,
            onclick: () => onFilterChange('All')
        },
            'All',
            h('span', { class: 'vmt_filter_count' }, `(${Object.values(traitCounts).reduce((a, b) => a + b, 0)})`)
        ),
        ...TRAIT_CATEGORIES.map(cat =>
            h('button', {
                class: `vmt_filter_btn vmt_filter_${cat.key} ${activeFilter === cat.key ? 'active' : ''}`,
                onclick: () => onFilterChange(cat.key)
            },
                cat.label,
                h('span', { class: 'vmt_filter_count' }, `(${traitCounts[cat.key] || 0})`)
            )
        )
    );
}

/**
 * Create traits summary section
 */
function createTraitsSummary(traits) {
    const counts = {
        innate: traits.filter(t => t.category === 'innate').length,
        acquired: traits.filter(t => t.category === 'acquired').length,
        racial: traits.filter(t => t.category === 'racial').length,
        background: traits.filter(t => t.category === 'background').length
    };

    return h('div', { class: 'vmt_traits_summary' },
        TRAIT_CATEGORIES.map(cat =>
            h('div', { class: `vmt_summary_item vmt_summary_${cat.key}` },
                h('span', { class: 'vmt_summary_value' }, String(counts[cat.key])),
                h('span', { class: 'vmt_summary_label' }, cat.label)
            )
        )
    );
}

/**
 * Render the Traits tab content
 */
export function renderTraitsTab(openModal, render) {
    const state = getState();
    const traits = state.traits || [];

    const container = h('div', { class: 'vmt_traits_tab' });

    // Traits Summary
    container.appendChild(createTraitsSummary(traits));

    // Main Traits Section
    const traitsSection = h('div', { class: 'vmt_section vmt_traits_section' },
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Character Traits'),
            h('button', {
                class: 'vmt_btn_small vmt_btn_add',
                onclick: () => openModal('add-trait', {
                    onSave: async (trait) => {
                        const newTrait = { ...trait, id: generateId() };
                        const updated = [...traits, newTrait];
                        await updateField('traits', updated);
                        render();
                    }
                })
            }, '+ Add')
        )
    );

    // Calculate counts for filter
    const traitCounts = {
        innate: traits.filter(t => t.category === 'innate').length,
        acquired: traits.filter(t => t.category === 'acquired').length,
        racial: traits.filter(t => t.category === 'racial').length,
        background: traits.filter(t => t.category === 'background').length
    };

    // Category filter
    traitsSection.appendChild(createCategoryFilter(traitFilter, (filter) => {
        traitFilter = filter;
        render();
    }, traitCounts));

    // Filter traits
    const filteredTraits = traitFilter === 'All'
        ? traits
        : traits.filter(t => t.category === traitFilter);

    // Traits list
    const traitsList = h('div', { class: 'vmt_traits_list' });

    if (filteredTraits.length === 0) {
        traitsList.appendChild(h('div', { class: 'vmt_empty' },
            traitFilter === 'All' ? 'No traits defined' : `No ${traitFilter} traits`
        ));
    } else {
        // Group traits by category if showing all
        if (traitFilter === 'All') {
            for (const cat of TRAIT_CATEGORIES) {
                const catTraits = filteredTraits.filter(t => t.category === cat.key);
                if (catTraits.length > 0) {
                    traitsList.appendChild(h('div', { class: 'vmt_trait_category_header' },
                        h('span', { class: 'vmt_category_label' }, cat.label),
                        h('span', { class: 'vmt_category_count' }, `(${catTraits.length})`)
                    ));
                    catTraits.forEach((trait) => {
                        const originalIndex = traits.indexOf(trait);
                        traitsList.appendChild(createTraitItem(
                            trait,
                            originalIndex,
                            (idx) => openModal('edit-trait', {
                                trait: traits[idx],
                                onSave: async (updated) => {
                                    const list = [...traits];
                                    list[idx] = { ...list[idx], ...updated };
                                    await updateField('traits', list);
                                    render();
                                }
                            }),
                            async (idx) => {
                                const list = traits.filter((_, j) => j !== idx);
                                await updateField('traits', list);
                                render();
                            }
                        ));
                    });
                }
            }
        } else {
            filteredTraits.forEach((trait) => {
                const originalIndex = traits.indexOf(trait);
                traitsList.appendChild(createTraitItem(
                    trait,
                    originalIndex,
                    (idx) => openModal('edit-trait', {
                        trait: traits[idx],
                        onSave: async (updated) => {
                            const list = [...traits];
                            list[idx] = { ...list[idx], ...updated };
                            await updateField('traits', list);
                            render();
                        }
                    }),
                    async (idx) => {
                        const list = traits.filter((_, j) => j !== idx);
                        await updateField('traits', list);
                        render();
                    }
                ));
            });
        }
    }

    traitsSection.appendChild(traitsList);
    container.appendChild(traitsSection);

    return container;
}
