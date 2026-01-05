/**
 * Shop Manager
 * Handles shops, inventories, and services
 */

import { ITEM_CATEGORIES, SERVICE_TYPES, calculatePrice, formatCurrency } from './economy-engine.js';

// Shop types
export const SHOP_TYPES = {
    general: { name: 'General Store', categories: ['tools', 'food', 'clothing', 'materials'], icon: '' },
    blacksmith: { name: 'Blacksmith', categories: ['weapons', 'armor'], services: ['repair_weapon', 'repair_armor', 'sharpen', 'forge_custom'], icon: '' },
    alchemist: { name: 'Alchemist', categories: ['potions', 'reagents'], icon: '' },
    magic_shop: { name: 'Magic Shop', categories: ['scrolls', 'magic_items', 'reagents'], services: ['identify', 'enchant'], icon: '' },
    jeweler: { name: 'Jeweler', categories: ['jewelry', 'gems'], icon: '' },
    armorer: { name: 'Armorer', categories: ['armor'], services: ['repair_armor'], icon: '' },
    weaponsmith: { name: 'Weaponsmith', categories: ['weapons'], services: ['repair_weapon', 'sharpen'], icon: '' },
    temple: { name: 'Temple', services: ['healing', 'blessing', 'curse_removal', 'resurrection'], icon: '' },
    inn: { name: 'Inn/Tavern', categories: ['food'], services: ['room_common', 'room_private', 'room_luxury', 'meal_simple', 'meal_fine'], icon: '' },
    stables: { name: 'Stables', services: ['stabling', 'mount_rental', 'transport'], icon: '' },
    guild: { name: 'Guild Hall', services: ['training_basic', 'training_advanced', 'information'], icon: '' },
    black_market: { name: 'Black Market', categories: ['weapons', 'potions', 'magic_items'], priceModifier: 1.5, icon: '' },
    market_stall: { name: 'Market Stall', categories: ['food', 'materials', 'tools'], priceModifier: 0.9, icon: '' },
    artifact_dealer: { name: 'Artifact Dealer', categories: ['artifacts', 'magic_items'], priceModifier: 1.3, icon: '' }
};

// Create a new shop
export function createShop(overrides = {}) {
    const type = SHOP_TYPES[overrides.type] || SHOP_TYPES.general;

    return {
        id: overrides.id || `shop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: overrides.name || `${type.name}`,
        type: overrides.type || 'general',
        owner: overrides.owner || null, // NPC id
        location: overrides.location || '',

        // Inventory
        inventory: overrides.inventory || [],

        // Services offered
        services: overrides.services || type.services || [],

        // Price modifiers
        priceModifier: overrides.priceModifier || type.priceModifier || 1.0,
        buybackRate: overrides.buybackRate || 0.5, // Percentage of value when selling to shop

        // Reputation with this shop
        reputation: overrides.reputation || 0,

        // Operating hours
        openHours: overrides.openHours || { open: 8, close: 20 },

        // Specialties (categories with better prices)
        specialties: overrides.specialties || [],

        // Notes
        notes: overrides.notes || '',

        // Status
        isOpen: overrides.isOpen !== false,
        lastRestocked: overrides.lastRestocked || null
    };
}

// Create inventory item
export function createInventoryItem(overrides = {}) {
    return {
        id: overrides.id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: overrides.name || 'Item',
        category: overrides.category || 'tools',
        basePrice: overrides.basePrice || 10,
        quantity: overrides.quantity || 1,
        quality: overrides.quality || 'common', // common, uncommon, rare, epic, legendary
        description: overrides.description || '',
        properties: overrides.properties || {}
    };
}

// Calculate item price at a shop
export function getShopPrice(shop, item, isBuying, marketCondition = 'stable') {
    let price = calculatePrice(item.basePrice, {
        category: item.category,
        marketCondition,
        isBuying,
        reputation: shop.reputation
    });

    // Shop's price modifier
    price *= shop.priceModifier;

    // Specialty discount/premium
    if (shop.specialties?.includes(item.category)) {
        price *= isBuying ? 0.9 : 1.1; // 10% better prices on specialties
    }

    // Quality modifier
    const qualityMods = {
        common: 1.0,
        uncommon: 1.5,
        rare: 3.0,
        epic: 6.0,
        legendary: 15.0
    };
    price *= qualityMods[item.quality] || 1.0;

    // Selling to shop uses buyback rate
    if (!isBuying) {
        price *= shop.buybackRate;
    }

    return Math.round(Math.max(1, price));
}

// Get service price
export function getServicePrice(shop, serviceType, options = {}) {
    const service = SERVICE_TYPES[serviceType];
    if (!service) return null;

    let price = service.basePrice;

    // Shop reputation discount
    if (shop.reputation > 0) {
        price *= (1 - Math.min(0.2, shop.reputation / 500));
    }

    // Shop's price modifier
    price *= shop.priceModifier;

    // Complexity/level modifier for some services
    if (options.level) {
        price *= Math.pow(1.5, options.level - 1);
    }

    // Rush job
    if (options.rush) {
        price *= 2;
    }

    return Math.round(price);
}

// Restock shop inventory
export function restockShop(shop, options = {}) {
    const type = SHOP_TYPES[shop.type];
    if (!type) return;

    // Clear old inventory or keep some
    if (options.fullRestock) {
        shop.inventory = [];
    }

    // Generate new items based on shop type
    const categories = type.categories || [];
    const itemCount = options.itemCount || Math.floor(5 + Math.random() * 10);

    for (let i = 0; i < itemCount; i++) {
        const category = categories[Math.floor(Math.random() * categories.length)];
        if (!category) continue;

        // Random quality weighted toward common
        const qualityRoll = Math.random();
        let quality = 'common';
        if (qualityRoll > 0.95) quality = 'legendary';
        else if (qualityRoll > 0.85) quality = 'epic';
        else if (qualityRoll > 0.70) quality = 'rare';
        else if (qualityRoll > 0.50) quality = 'uncommon';

        // Base price varies by category
        const basePrices = {
            weapons: 50,
            armor: 75,
            potions: 25,
            scrolls: 50,
            reagents: 10,
            food: 2,
            tools: 15,
            clothing: 10,
            jewelry: 100,
            magic_items: 500,
            artifacts: 5000,
            materials: 5
        };

        shop.inventory.push(createInventoryItem({
            name: `${quality.charAt(0).toUpperCase() + quality.slice(1)} ${ITEM_CATEGORIES[category]?.name || category}`,
            category,
            basePrice: (basePrices[category] || 10) * (1 + Math.random()),
            quantity: Math.floor(1 + Math.random() * 5),
            quality
        }));
    }

    shop.lastRestocked = new Date().toISOString();
}

// Process a transaction
export function processTransaction(shop, item, quantity, isBuying, wallet, marketCondition) {
    const unitPrice = getShopPrice(shop, item, isBuying, marketCondition);
    const totalPrice = unitPrice * quantity;
    const totalInCopper = totalPrice; // Assuming basePrice is in copper

    // Check affordability
    const walletTotal = (wallet.copper || 0) +
        (wallet.silver || 0) * 10 +
        (wallet.gold || 0) * 100 +
        (wallet.platinum || 0) * 1000;

    if (isBuying && walletTotal < totalInCopper) {
        return { success: false, error: 'Insufficient funds' };
    }

    // Check stock
    if (isBuying) {
        const inventoryItem = shop.inventory.find(i => i.id === item.id);
        if (!inventoryItem || inventoryItem.quantity < quantity) {
            return { success: false, error: 'Not enough in stock' };
        }
    }

    // Process payment
    if (isBuying) {
        // Deduct from wallet (simplified - just deduct copper equivalent)
        let remaining = totalInCopper;
        if (wallet.copper >= remaining) {
            wallet.copper -= remaining;
        } else {
            remaining -= wallet.copper;
            wallet.copper = 0;
            if (wallet.silver * 10 >= remaining) {
                const silverNeeded = Math.ceil(remaining / 10);
                wallet.silver -= silverNeeded;
                wallet.copper += silverNeeded * 10 - remaining;
            } else {
                remaining -= wallet.silver * 10;
                wallet.silver = 0;
                const goldNeeded = Math.ceil(remaining / 100);
                wallet.gold -= goldNeeded;
                wallet.copper += goldNeeded * 100 - remaining;
            }
        }

        // Update inventory
        const inventoryItem = shop.inventory.find(i => i.id === item.id);
        inventoryItem.quantity -= quantity;
        if (inventoryItem.quantity <= 0) {
            shop.inventory = shop.inventory.filter(i => i.id !== item.id);
        }
    } else {
        // Add to wallet
        wallet.copper += totalInCopper % 10;
        wallet.silver += Math.floor(totalInCopper / 10) % 10;
        wallet.gold += Math.floor(totalInCopper / 100);

        // Add to shop inventory
        const existing = shop.inventory.find(i => i.name === item.name && i.quality === item.quality);
        if (existing) {
            existing.quantity += quantity;
        } else {
            shop.inventory.push({ ...item, quantity });
        }
    }

    return {
        success: true,
        transaction: {
            type: isBuying ? 'purchase' : 'sale',
            item: item.name,
            quantity,
            unitPrice,
            totalPrice,
            shop: shop.name,
            timestamp: new Date().toISOString()
        }
    };
}

// Build shop context for AI
export function buildShopContext(shop) {
    const parts = [];

    parts.push(`${shop.name} (${SHOP_TYPES[shop.type]?.name || shop.type})`);

    if (shop.location) {
        parts.push(`Location: ${shop.location}`);
    }

    if (shop.inventory.length > 0) {
        parts.push(`Stock: ${shop.inventory.length} items available`);
    }

    if (shop.services?.length > 0) {
        const serviceNames = shop.services.map(s => SERVICE_TYPES[s]?.name || s).slice(0, 3);
        parts.push(`Services: ${serviceNames.join(', ')}${shop.services.length > 3 ? '...' : ''}`);
    }

    if (!shop.isOpen) {
        parts.push('[CLOSED]');
    }

    return parts.join('\n');
}
