/**
 * Valdris Master Tracker - Equipment Tab
 * Visual equipment slot grid with stats summary
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
 * Equipment slot definitions
 */
const EQUIPMENT_SLOTS = {
    head: { label: 'Head', icon: '', row: 1, col: 2 },
    chest: { label: 'Chest', icon: '', row: 2, col: 2 },
    hands: { label: 'Hands', icon: '', row: 2, col: 1 },
    legs: { label: 'Legs', icon: '', row: 3, col: 2 },
    feet: { label: 'Feet', icon: '', row: 4, col: 2 },
    back: { label: 'Back', icon: '', row: 1, col: 3 },
    mainHand: { label: 'Main Hand', icon: '', row: 3, col: 1 },
    offHand: { label: 'Off Hand', icon: '', row: 3, col: 3 },
    ring1: { label: 'Ring 1', icon: '', row: 4, col: 1 },
    ring2: { label: 'Ring 2', icon: '', row: 4, col: 3 },
    amulet: { label: 'Amulet', icon: '', row: 2, col: 3 },
    accessory1: { label: 'Accessory 1', icon: '', row: 5, col: 1 },
    accessory2: { label: 'Accessory 2', icon: '', row: 5, col: 2 },
    accessory3: { label: 'Accessory 3', icon: '', row: 5, col: 3 }
};

/**
 * Rarity colors
 */
const RARITY_CLASSES = {
    common: 'vmt_rarity_common',
    uncommon: 'vmt_rarity_uncommon',
    rare: 'vmt_rarity_rare',
    epic: 'vmt_rarity_epic',
    legendary: 'vmt_rarity_legendary'
};

/**
 * Create an equipment slot
 */
function createEquipmentSlot(slotKey, item, onView, onUnequip, onEquipFromInventory) {
    const slotInfo = EQUIPMENT_SLOTS[slotKey];
    const isEmpty = !item;
    const rarityClass = item?.rarity ? RARITY_CLASSES[item.rarity] : '';

    return h('div', {
        class: `vmt_equip_slot ${isEmpty ? 'vmt_slot_empty' : 'vmt_slot_filled'} ${rarityClass}`,
        'data-slot': slotKey,
        onclick: isEmpty ? () => onEquipFromInventory(slotKey) : () => onView(slotKey, item)
    },
        h('div', { class: 'vmt_slot_icon' }, isEmpty ? slotInfo.icon : (item.icon || slotInfo.icon)),
        isEmpty
            ? h('div', { class: 'vmt_slot_label' }, slotInfo.label)
            : h('div', { class: 'vmt_slot_item_info' },
                h('span', { class: 'vmt_slot_item_name' }, item.name),
                item.stats ? h('span', { class: 'vmt_slot_item_stats' }, formatStats(item.stats)) : null
            ),
        !isEmpty ? h('button', {
            class: 'vmt_btn_unequip_small',
            onclick: (e) => { e.stopPropagation(); onUnequip(slotKey); },
            title: 'Unequip'
        }, '') : null
    );
}

/**
 * Format stats for display
 */
function formatStats(stats) {
    if (!stats || typeof stats !== 'object') return '';
    const parts = [];
    for (const [key, value] of Object.entries(stats)) {
        if (value && value !== 0) {
            const sign = value > 0 ? '+' : '';
            parts.push(`${sign}${value} ${key}`);
        }
    }
    return parts.join(', ');
}

/**
 * Calculate total stats from all equipment
 */
function calculateTotalStats(equipment) {
    const totals = {};

    for (const item of Object.values(equipment)) {
        if (item && item.stats) {
            for (const [stat, value] of Object.entries(item.stats)) {
                totals[stat] = (totals[stat] || 0) + (value || 0);
            }
        }
    }

    return totals;
}

/**
 * Create the stats summary section
 */
function createStatsSummary(equipment) {
    const totals = calculateTotalStats(equipment);
    const hasStats = Object.keys(totals).length > 0;

    if (!hasStats) {
        return h('div', { class: 'vmt_equip_stats_summary' },
            h('div', { class: 'vmt_summary_empty' }, 'No equipment bonuses')
        );
    }

    return h('div', { class: 'vmt_equip_stats_summary' },
        h('div', { class: 'vmt_summary_title' }, 'Equipment Bonuses'),
        h('div', { class: 'vmt_summary_stats' },
            Object.entries(totals).map(([stat, value]) => {
                const sign = value > 0 ? '+' : '';
                const valueClass = value > 0 ? 'vmt_stat_positive' : value < 0 ? 'vmt_stat_negative' : '';
                return h('div', { class: 'vmt_summary_stat_item' },
                    h('span', { class: 'vmt_summary_stat_name' }, stat),
                    h('span', { class: `vmt_summary_stat_value ${valueClass}` }, `${sign}${value}`)
                );
            })
        )
    );
}

/**
 * Get equippable items from inventory for a slot
 */
function getEquippableItems(inventory, slotKey) {
    return inventory.filter(item => item.equippable && item.slot === slotKey);
}

/**
 * Render the Equipment tab content
 */
export function renderEquipmentTab(openModal, render) {
    const state = getState();
    const equipment = state.equipment || {};
    const inventory = state.inventory || [];

    const container = h('div', { class: 'vmt_equipment_tab' });

    // Stats Summary
    container.appendChild(createStatsSummary(equipment));

    // Equipment Grid Section
    const gridSection = h('div', { class: 'vmt_section vmt_equipment_grid_section' },
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Equipment')
        )
    );

    const grid = h('div', { class: 'vmt_equipment_grid' });

    // Handle viewing an equipped item
    const handleView = (slotKey, item) => {
        openModal('view-equipment', {
            slot: slotKey,
            item: item,
            onUnequip: async () => {
                // Move item back to inventory
                const updatedInventory = [...inventory, { ...item, quantity: 1 }];
                await updateField('inventory', updatedInventory);
                await updateField(`equipment.${slotKey}`, null);
                render();
            }
        });
    };

    // Handle unequipping
    const handleUnequip = async (slotKey) => {
        const item = equipment[slotKey];
        if (item) {
            // Find if item exists in inventory to stack
            const existingIdx = inventory.findIndex(i => i.id === item.id);
            let updatedInventory;
            if (existingIdx >= 0) {
                updatedInventory = [...inventory];
                updatedInventory[existingIdx] = {
                    ...updatedInventory[existingIdx],
                    quantity: (updatedInventory[existingIdx].quantity || 1) + 1
                };
            } else {
                updatedInventory = [...inventory, { ...item, quantity: 1 }];
            }
            await updateField('inventory', updatedInventory);
            await updateField(`equipment.${slotKey}`, null);
            render();
        }
    };

    // Handle equipping from inventory
    const handleEquipFromInventory = (slotKey) => {
        const equippable = getEquippableItems(inventory, slotKey);
        if (equippable.length === 0) {
            openModal('no-equippable', { slot: EQUIPMENT_SLOTS[slotKey].label });
            return;
        }
        openModal('select-equipment', {
            slot: slotKey,
            slotLabel: EQUIPMENT_SLOTS[slotKey].label,
            items: equippable,
            currentItem: equipment[slotKey],
            onSelect: async (item) => {
                // Remove from inventory (or reduce quantity)
                const itemIdx = inventory.findIndex(i => i.id === item.id);
                let updatedInventory = [...inventory];
                if (itemIdx >= 0) {
                    if ((inventory[itemIdx].quantity || 1) > 1) {
                        updatedInventory[itemIdx] = {
                            ...updatedInventory[itemIdx],
                            quantity: updatedInventory[itemIdx].quantity - 1
                        };
                    } else {
                        updatedInventory = updatedInventory.filter((_, i) => i !== itemIdx);
                    }
                }

                // If there's already something equipped, put it back in inventory
                if (equipment[slotKey]) {
                    updatedInventory.push({ ...equipment[slotKey], quantity: 1 });
                }

                await updateField('inventory', updatedInventory);
                await updateField(`equipment.${slotKey}`, item);
                render();
            }
        });
    };

    // Create slots in visual order
    for (const [slotKey, slotInfo] of Object.entries(EQUIPMENT_SLOTS)) {
        const slot = createEquipmentSlot(
            slotKey,
            equipment[slotKey],
            handleView,
            handleUnequip,
            handleEquipFromInventory
        );
        slot.style.gridRow = slotInfo.row;
        slot.style.gridColumn = slotInfo.col;
        grid.appendChild(slot);
    }

    gridSection.appendChild(grid);
    container.appendChild(gridSection);

    // Quick equip section - show equippable items from inventory
    const equippableSection = h('div', { class: 'vmt_section vmt_quick_equip_section' },
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Quick Equip'),
            h('span', { class: 'vmt_section_subtitle' }, 'Equippable items in inventory')
        )
    );

    const equippableItems = inventory.filter(i => i.equippable);

    if (equippableItems.length === 0) {
        equippableSection.appendChild(h('div', { class: 'vmt_empty' }, 'No equippable items in inventory'));
    } else {
        const equippableList = h('div', { class: 'vmt_quick_equip_list' });
        equippableItems.forEach(item => {
            const rarityClass = item.rarity ? RARITY_CLASSES[item.rarity] : '';
            const slotInfo = EQUIPMENT_SLOTS[item.slot];

            equippableList.appendChild(
                h('div', { class: `vmt_quick_equip_item ${rarityClass}` },
                    h('div', { class: 'vmt_qe_info' },
                        h('span', { class: 'vmt_qe_name' }, item.name),
                        h('span', { class: 'vmt_qe_slot' }, slotInfo?.label || item.slot)
                    ),
                    item.stats ? h('span', { class: 'vmt_qe_stats' }, formatStats(item.stats)) : null,
                    h('button', {
                        class: 'vmt_btn_small',
                        onclick: () => handleEquipFromInventory(item.slot)
                    }, 'Equip')
                )
            );
        });
        equippableSection.appendChild(equippableList);
    }

    container.appendChild(equippableSection);

    return container;
}
