/**
 * Valdris Master Tracker - Inventory Tab
 * Grid/list view with items, categories, currencies, and weight tracking
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
 * Item categories
 */
const CATEGORIES = {
    weapons: { label: 'Weapons', icon: '' },
    armor: { label: 'Armor', icon: '' },
    consumables: { label: 'Consumables', icon: '' },
    materials: { label: 'Materials', icon: '' },
    quest: { label: 'Quest Items', icon: '' },
    misc: { label: 'Misc', icon: '' }
};

/**
 * Rarity definitions
 */
const RARITIES = {
    common: { label: 'Common', class: 'vmt_rarity_common' },
    uncommon: { label: 'Uncommon', class: 'vmt_rarity_uncommon' },
    rare: { label: 'Rare', class: 'vmt_rarity_rare' },
    epic: { label: 'Epic', class: 'vmt_rarity_epic' },
    legendary: { label: 'Legendary', class: 'vmt_rarity_legendary' }
};

/**
 * Equipment slot labels
 */
const SLOT_LABELS = {
    head: 'Head', chest: 'Chest', hands: 'Hands', legs: 'Legs', feet: 'Feet',
    back: 'Back', mainHand: 'Main Hand', offHand: 'Off Hand',
    ring1: 'Ring', ring2: 'Ring', amulet: 'Amulet',
    accessory1: 'Accessory', accessory2: 'Accessory', accessory3: 'Accessory'
};

/**
 * Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Local state
let categoryFilter = 'all';
let searchQuery = '';

/**
 * Calculate total inventory weight
 */
function calculateWeight(inventory) {
    return inventory.reduce((sum, item) => {
        return sum + ((item.weight || 0) * (item.quantity || 1));
    }, 0);
}

/**
 * Create weight capacity bar
 */
function createWeightBar(current, max, onChange) {
    const percent = max > 0 ? Math.min(100, (current / max) * 100) : 0;
    const isOverweight = current > max;

    return h('div', { class: 'vmt_weight_section' },
        h('div', { class: 'vmt_weight_header' },
            h('span', { class: 'vmt_weight_label' }, 'Carrying Capacity'),
            h('div', { class: 'vmt_weight_controls' },
                h('span', { class: `vmt_weight_text ${isOverweight ? 'vmt_overweight' : ''}` },
                    `${current.toFixed(1)} / ${max} lbs`
                ),
                h('input', {
                    type: 'number',
                    class: 'vmt_weight_max_input',
                    value: max,
                    min: 1,
                    title: 'Max capacity',
                    onchange: (e) => onChange(parseInt(e.target.value, 10) || 100)
                })
            )
        ),
        h('div', { class: `vmt_weight_bar ${isOverweight ? 'vmt_overweight' : ''}` },
            h('div', { class: 'vmt_weight_fill', style: `width: ${Math.min(percent, 100)}%` })
        )
    );
}

/**
 * Create currencies section
 */
function createCurrenciesSection(currencies, onChange, openModal, render) {
    return h('div', { class: 'vmt_currencies_section' },
        h('div', { class: 'vmt_currencies_header' },
            h('span', { class: 'vmt_currencies_title' }, 'Currency'),
            h('button', {
                class: 'vmt_btn_icon',
                onclick: () => openModal('add-currency', {
                    onSave: async (currency) => {
                        const custom = [...(currencies.custom || []), currency];
                        await updateField('currencies.custom', custom);
                        render();
                    }
                }),
                title: 'Add custom currency'
            }, '+')
        ),
        h('div', { class: 'vmt_currencies_grid' },
            h('div', { class: 'vmt_currency_item vmt_currency_gold' },
                h('span', { class: 'vmt_currency_icon' }, ''),
                h('input', {
                    type: 'number',
                    class: 'vmt_currency_input',
                    value: currencies.gold || 0,
                    min: 0,
                    onchange: (e) => onChange('gold', parseInt(e.target.value, 10) || 0)
                }),
                h('span', { class: 'vmt_currency_label' }, 'Gold')
            ),
            h('div', { class: 'vmt_currency_item vmt_currency_silver' },
                h('span', { class: 'vmt_currency_icon' }, ''),
                h('input', {
                    type: 'number',
                    class: 'vmt_currency_input',
                    value: currencies.silver || 0,
                    min: 0,
                    onchange: (e) => onChange('silver', parseInt(e.target.value, 10) || 0)
                }),
                h('span', { class: 'vmt_currency_label' }, 'Silver')
            ),
            h('div', { class: 'vmt_currency_item vmt_currency_copper' },
                h('span', { class: 'vmt_currency_icon' }, ''),
                h('input', {
                    type: 'number',
                    class: 'vmt_currency_input',
                    value: currencies.copper || 0,
                    min: 0,
                    onchange: (e) => onChange('copper', parseInt(e.target.value, 10) || 0)
                }),
                h('span', { class: 'vmt_currency_label' }, 'Copper')
            ),
            ...(currencies.custom || []).map((c, i) =>
                h('div', { class: 'vmt_currency_item vmt_currency_custom' },
                    h('input', {
                        type: 'number',
                        class: 'vmt_currency_input',
                        value: c.amount || 0,
                        min: 0,
                        onchange: async (e) => {
                            const custom = [...currencies.custom];
                            custom[i] = { ...custom[i], amount: parseInt(e.target.value, 10) || 0 };
                            await updateField('currencies.custom', custom);
                            render();
                        }
                    }),
                    h('span', { class: 'vmt_currency_label' }, c.name),
                    h('button', {
                        class: 'vmt_btn_icon vmt_btn_danger vmt_btn_tiny',
                        onclick: async () => {
                            const custom = currencies.custom.filter((_, j) => j !== i);
                            await updateField('currencies.custom', custom);
                            render();
                        },
                        title: 'Remove currency'
                    }, '')
                )
            )
        )
    );
}

/**
 * Create category filter
 */
function createCategoryFilter(activeFilter, onFilterChange) {
    return h('div', { class: 'vmt_inv_filter' },
        h('button', {
            class: `vmt_filter_btn ${activeFilter === 'all' ? 'active' : ''}`,
            onclick: () => onFilterChange('all')
        }, 'All'),
        ...Object.entries(CATEGORIES).map(([key, info]) =>
            h('button', {
                class: `vmt_filter_btn ${activeFilter === key ? 'active' : ''}`,
                onclick: () => onFilterChange(key)
            }, info.icon + ' ' + info.label)
        )
    );
}

/**
 * Create search bar
 */
function createSearchBar(query, onSearch) {
    return h('div', { class: 'vmt_inv_search' },
        h('input', {
            type: 'text',
            class: 'vmt_search_input',
            placeholder: 'Search items...',
            value: query,
            oninput: (e) => onSearch(e.target.value)
        }),
        query ? h('button', {
            class: 'vmt_btn_clear_search',
            onclick: () => onSearch('')
        }, '') : null
    );
}

/**
 * Create item card (grid view)
 */
function createItemCardGrid(item, index, onEdit, onDelete, onEquip) {
    const rarityClass = item.rarity ? RARITIES[item.rarity].class : '';
    const catInfo = CATEGORIES[item.category] || CATEGORIES.misc;

    return h('div', { class: `vmt_inv_item_card ${rarityClass}` },
        h('div', { class: 'vmt_item_card_header' },
            h('span', { class: 'vmt_item_icon' }, catInfo.icon),
            item.quantity > 1 ? h('span', { class: 'vmt_item_qty' }, `x${item.quantity}`) : null
        ),
        h('div', { class: 'vmt_item_card_body' },
            h('span', { class: 'vmt_item_name' }, item.name),
            item.description ? h('span', { class: 'vmt_item_desc' }, item.description) : null
        ),
        h('div', { class: 'vmt_item_card_footer' },
            item.value ? h('span', { class: 'vmt_item_value' }, `${item.value}g`) : null,
            item.weight ? h('span', { class: 'vmt_item_weight' }, `${item.weight}lb`) : null
        ),
        h('div', { class: 'vmt_item_card_actions' },
            item.equippable ? h('button', {
                class: 'vmt_btn_icon vmt_btn_equip',
                onclick: () => onEquip(index),
                title: 'Equip'
            }, '') : null,
            h('button', {
                class: 'vmt_btn_icon',
                onclick: () => onEdit(index),
                title: 'Edit'
            }, ''),
            h('button', {
                class: 'vmt_btn_icon vmt_btn_danger',
                onclick: () => onDelete(index),
                title: 'Delete'
            }, '')
        )
    );
}

/**
 * Create item row (list view)
 */
function createItemRowList(item, index, onEdit, onDelete, onEquip) {
    const rarityClass = item.rarity ? RARITIES[item.rarity].class : '';
    const catInfo = CATEGORIES[item.category] || CATEGORIES.misc;

    return h('div', { class: `vmt_inv_item_row ${rarityClass}` },
        h('span', { class: 'vmt_row_icon' }, catInfo.icon),
        h('span', { class: 'vmt_row_name' }, item.name),
        h('span', { class: 'vmt_row_qty' }, `x${item.quantity || 1}`),
        h('span', { class: 'vmt_row_value' }, item.value ? `${item.value}g` : '-'),
        h('span', { class: 'vmt_row_weight' }, item.weight ? `${item.weight}lb` : '-'),
        h('div', { class: 'vmt_row_actions' },
            item.equippable ? h('button', {
                class: 'vmt_btn_icon vmt_btn_equip',
                onclick: () => onEquip(index),
                title: `Equip to ${SLOT_LABELS[item.slot] || item.slot}`
            }, '') : null,
            h('button', {
                class: 'vmt_btn_icon',
                onclick: () => onEdit(index),
                title: 'Edit'
            }, ''),
            h('button', {
                class: 'vmt_btn_icon vmt_btn_danger',
                onclick: () => onDelete(index),
                title: 'Delete'
            }, '')
        )
    );
}

/**
 * Render the Inventory tab content
 */
export function renderInventoryTab(openModal, render) {
    const state = getState();
    const inventory = state.inventory || [];
    const currencies = state.currencies || { gold: 0, silver: 0, copper: 0, custom: [] };
    const weightCapacity = state.weightCapacity || { current: 0, max: 100 };
    const viewMode = state.inventoryView || 'grid';

    const container = h('div', { class: 'vmt_inventory_tab' });

    // Weight bar
    const currentWeight = calculateWeight(inventory);
    container.appendChild(createWeightBar(currentWeight, weightCapacity.max, async (max) => {
        await updateField('weightCapacity.max', max);
        render();
    }));

    // Currencies
    container.appendChild(createCurrenciesSection(currencies, async (type, value) => {
        await updateField(`currencies.${type}`, value);
        render();
    }, openModal, render));

    // Inventory Section
    const invSection = h('div', { class: 'vmt_section vmt_inventory_section' },
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, `Inventory (${inventory.length})`),
            h('div', { class: 'vmt_inv_header_actions' },
                h('button', {
                    class: `vmt_btn_icon ${viewMode === 'grid' ? 'active' : ''}`,
                    onclick: async () => {
                        await updateField('inventoryView', 'grid');
                        render();
                    },
                    title: 'Grid view'
                }, ''),
                h('button', {
                    class: `vmt_btn_icon ${viewMode === 'list' ? 'active' : ''}`,
                    onclick: async () => {
                        await updateField('inventoryView', 'list');
                        render();
                    },
                    title: 'List view'
                }, ''),
                h('button', {
                    class: 'vmt_btn_small vmt_btn_add',
                    onclick: () => openModal('add-item', {
                        onSave: async (item) => {
                            const newItem = { ...item, id: generateId() };
                            const updated = [...inventory, newItem];
                            await updateField('inventory', updated);
                            render();
                        }
                    })
                }, '+ Add')
            )
        )
    );

    // Search bar
    invSection.appendChild(createSearchBar(searchQuery, (query) => {
        searchQuery = query;
        render();
    }));

    // Category filter
    invSection.appendChild(createCategoryFilter(categoryFilter, (filter) => {
        categoryFilter = filter;
        render();
    }));

    // Filter items
    let filteredItems = inventory;
    if (categoryFilter !== 'all') {
        filteredItems = filteredItems.filter(i => i.category === categoryFilter);
    }
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredItems = filteredItems.filter(i =>
            (i.name || '').toLowerCase().includes(query) ||
            (i.description || '').toLowerCase().includes(query)
        );
    }

    // Handle item actions
    const handleEdit = (index) => {
        const originalItem = inventory[index];
        openModal('edit-item', {
            item: originalItem,
            onSave: async (updated) => {
                const list = [...inventory];
                list[index] = { ...list[index], ...updated };
                await updateField('inventory', list);
                render();
            }
        });
    };

    const handleDelete = async (index) => {
        const list = inventory.filter((_, i) => i !== index);
        await updateField('inventory', list);
        render();
    };

    const handleEquip = async (index) => {
        const item = inventory[index];
        if (!item.equippable || !item.slot) return;

        const equipment = state.equipment || {};

        // If there's already something equipped, swap
        let updatedInventory = [...inventory];
        if (equipment[item.slot]) {
            updatedInventory[index] = { ...equipment[item.slot], quantity: 1 };
        } else {
            // Remove from inventory (or reduce quantity)
            if ((item.quantity || 1) > 1) {
                updatedInventory[index] = { ...item, quantity: item.quantity - 1 };
            } else {
                updatedInventory = updatedInventory.filter((_, i) => i !== index);
            }
        }

        await updateField('inventory', updatedInventory);
        await updateField(`equipment.${item.slot}`, { ...item, quantity: 1 });
        render();
    };

    // Items display
    const itemsContainer = h('div', { class: `vmt_inv_items ${viewMode === 'grid' ? 'vmt_inv_grid' : 'vmt_inv_list'}` });

    if (filteredItems.length === 0) {
        itemsContainer.appendChild(h('div', { class: 'vmt_empty' },
            inventory.length === 0 ? 'Inventory is empty' : 'No matching items'
        ));
    } else {
        filteredItems.forEach((item) => {
            const originalIndex = inventory.indexOf(item);
            if (viewMode === 'grid') {
                itemsContainer.appendChild(createItemCardGrid(item, originalIndex, handleEdit, handleDelete, handleEquip));
            } else {
                itemsContainer.appendChild(createItemRowList(item, originalIndex, handleEdit, handleDelete, handleEquip));
            }
        });
    }

    invSection.appendChild(itemsContainer);
    container.appendChild(invSection);

    return container;
}
