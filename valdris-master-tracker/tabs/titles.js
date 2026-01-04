/**
 * Valdris Master Tracker - Titles Tab
 * Title list with active title slot and rarity system
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
 * Rarity definitions with colors
 */
const RARITIES = {
    common: { label: 'Common', class: 'vmt_rarity_common' },
    uncommon: { label: 'Uncommon', class: 'vmt_rarity_uncommon' },
    rare: { label: 'Rare', class: 'vmt_rarity_rare' },
    epic: { label: 'Epic', class: 'vmt_rarity_epic' },
    legendary: { label: 'Legendary', class: 'vmt_rarity_legendary' }
};

/**
 * Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Create the active title display slot
 */
function createActiveTitleSlot(activeTitle, onClear) {
    if (!activeTitle) {
        return h('div', { class: 'vmt_active_title_slot vmt_slot_empty' },
            h('div', { class: 'vmt_slot_icon' }, ''),
            h('div', { class: 'vmt_slot_text' },
                h('span', { class: 'vmt_slot_label' }, 'Active Title'),
                h('span', { class: 'vmt_slot_hint' }, 'Click a title to activate')
            )
        );
    }

    const rarityInfo = RARITIES[activeTitle.rarity] || RARITIES.common;

    return h('div', { class: `vmt_active_title_slot vmt_slot_filled ${rarityInfo.class}` },
        h('div', { class: 'vmt_slot_icon' }, ''),
        h('div', { class: 'vmt_slot_content' },
            h('div', { class: 'vmt_slot_title_name' }, activeTitle.name),
            h('div', { class: 'vmt_slot_title_effects' }, activeTitle.effects || 'No effects'),
            h('div', { class: 'vmt_slot_title_rarity' }, rarityInfo.label)
        ),
        h('button', {
            class: 'vmt_btn_icon vmt_btn_unequip',
            onclick: onClear,
            title: 'Remove active title'
        }, '')
    );
}

/**
 * Create a title item card
 */
function createTitleItem(title, isActive, onActivate, onEdit, onDelete) {
    const rarityInfo = RARITIES[title.rarity] || RARITIES.common;

    return h('div', { class: `vmt_title_item ${rarityInfo.class} ${isActive ? 'vmt_title_active' : ''}` },
        h('div', { class: 'vmt_title_header_row' },
            h('div', { class: 'vmt_title_name_section' },
                h('span', { class: 'vmt_title_name' }, title.name),
                isActive ? h('span', { class: 'vmt_active_badge' }, 'ACTIVE') : null
            ),
            h('div', { class: 'vmt_title_actions' },
                !isActive ? h('button', {
                    class: 'vmt_btn_icon vmt_btn_activate',
                    onclick: onActivate,
                    title: 'Activate title'
                }, '') : null,
                h('button', {
                    class: 'vmt_btn_icon',
                    onclick: onEdit,
                    title: 'Edit title'
                }, ''),
                h('button', {
                    class: 'vmt_btn_icon vmt_btn_danger',
                    onclick: onDelete,
                    title: 'Delete title'
                }, '')
            )
        ),
        title.description ? h('div', { class: 'vmt_title_desc' }, title.description) : null,
        h('div', { class: 'vmt_title_meta' },
            h('span', { class: `vmt_title_rarity_badge ${rarityInfo.class}` }, rarityInfo.label),
            title.source ? h('span', { class: 'vmt_title_source' }, `Source: ${title.source}`) : null
        ),
        title.effects ? h('div', { class: 'vmt_title_effects_box' },
            h('span', { class: 'vmt_effects_label' }, 'Effects:'),
            h('span', { class: 'vmt_effects_text' }, title.effects)
        ) : null
    );
}

// Local filter state
let rarityFilter = 'All';

/**
 * Create rarity filter buttons
 */
function createRarityFilter(activeFilter, onFilterChange) {
    return h('div', { class: 'vmt_rarity_filter' },
        h('button', {
            class: `vmt_filter_btn ${activeFilter === 'All' ? 'active' : ''}`,
            onclick: () => onFilterChange('All')
        }, 'All'),
        ...Object.entries(RARITIES).map(([key, info]) =>
            h('button', {
                class: `vmt_filter_btn vmt_filter_${key} ${activeFilter === key ? 'active' : ''}`,
                onclick: () => onFilterChange(key)
            }, info.label)
        )
    );
}

/**
 * Render the Titles tab content
 */
export function renderTitlesTab(openModal, render) {
    const state = getState();
    const titles = state.titles || [];
    const activeTitleId = state.activeTitleId;
    const activeTitle = titles.find(t => t.id === activeTitleId) || null;

    const container = h('div', { class: 'vmt_titles_tab' });

    // Active Title Slot
    const slotSection = h('div', { class: 'vmt_section vmt_active_title_section' },
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Active Title')
        ),
        createActiveTitleSlot(activeTitle, async () => {
            await updateField('activeTitleId', null);
            // Also update the legacy activeTitle for overview display
            await updateField('activeTitle', { name: '', effects: '' });
            render();
        })
    );
    container.appendChild(slotSection);

    // Titles List Section
    const titlesSection = h('div', { class: 'vmt_section vmt_titles_list_section' },
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, `Titles (${titles.length})`),
            h('button', {
                class: 'vmt_btn_small vmt_btn_add',
                onclick: () => openModal('add-title', {
                    onSave: async (title) => {
                        const newTitle = { ...title, id: generateId() };
                        const updated = [...titles, newTitle];
                        await updateField('titles', updated);
                        render();
                    }
                })
            }, '+ Add')
        )
    );

    // Rarity filter
    titlesSection.appendChild(createRarityFilter(rarityFilter, (filter) => {
        rarityFilter = filter;
        render();
    }));

    // Filter titles
    const filteredTitles = rarityFilter === 'All'
        ? titles
        : titles.filter(t => t.rarity === rarityFilter);

    // Titles list
    const titlesList = h('div', { class: 'vmt_titles_list' });

    if (filteredTitles.length === 0) {
        titlesList.appendChild(h('div', { class: 'vmt_empty' },
            titles.length === 0 ? 'No titles earned yet' : `No ${RARITIES[rarityFilter]?.label || ''} titles`
        ));
    } else {
        // Sort by rarity (legendary first) then by name
        const rarityOrder = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
        const sortedTitles = [...filteredTitles].sort((a, b) => {
            const aOrder = rarityOrder.indexOf(a.rarity || 'common');
            const bOrder = rarityOrder.indexOf(b.rarity || 'common');
            if (aOrder !== bOrder) return aOrder - bOrder;
            return (a.name || '').localeCompare(b.name || '');
        });

        sortedTitles.forEach((title) => {
            const originalIndex = titles.indexOf(title);
            const isActive = title.id === activeTitleId;

            titlesList.appendChild(createTitleItem(
                title,
                isActive,
                async () => {
                    await updateField('activeTitleId', title.id);
                    // Also update legacy activeTitle for overview display
                    await updateField('activeTitle', { name: title.name, effects: title.effects || '' });
                    render();
                },
                () => openModal('edit-title', {
                    title: title,
                    onSave: async (updated) => {
                        const list = [...titles];
                        list[originalIndex] = { ...list[originalIndex], ...updated };
                        await updateField('titles', list);
                        // Update legacy activeTitle if this was the active one
                        if (title.id === activeTitleId) {
                            await updateField('activeTitle', { name: updated.name, effects: updated.effects || '' });
                        }
                        render();
                    }
                }),
                async () => {
                    const list = titles.filter((_, j) => j !== originalIndex);
                    await updateField('titles', list);
                    // Clear active title if deleted
                    if (title.id === activeTitleId) {
                        await updateField('activeTitleId', null);
                        await updateField('activeTitle', { name: '', effects: '' });
                    }
                    render();
                }
            ));
        });
    }

    titlesSection.appendChild(titlesList);
    container.appendChild(titlesSection);

    return container;
}
