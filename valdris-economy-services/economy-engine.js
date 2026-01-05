/**
 * Economy Engine
 * Handles currencies, pricing, and market dynamics
 */

// Currency types
export const CURRENCIES = {
    copper: { name: 'Copper', abbr: 'cp', value: 1, icon: '' },
    silver: { name: 'Silver', abbr: 'sp', value: 10, icon: '' },
    gold: { name: 'Gold', abbr: 'gp', value: 100, icon: '' },
    platinum: { name: 'Platinum', abbr: 'pp', value: 1000, icon: '' },
    gems: { name: 'Gems', abbr: 'gem', value: 500, icon: '' },
    trade_goods: { name: 'Trade Goods', abbr: 'tg', value: 50, icon: '' }
};

// Item categories with base markup
export const ITEM_CATEGORIES = {
    weapons: { name: 'Weapons', markup: 1.0, icon: '' },
    armor: { name: 'Armor', markup: 1.0, icon: '' },
    potions: { name: 'Potions', markup: 1.3, icon: '' },
    scrolls: { name: 'Scrolls', markup: 1.5, icon: '' },
    reagents: { name: 'Reagents', markup: 1.2, icon: '' },
    food: { name: 'Food', markup: 0.9, icon: '' },
    tools: { name: 'Tools', markup: 1.0, icon: '' },
    clothing: { name: 'Clothing', markup: 1.1, icon: '' },
    jewelry: { name: 'Jewelry', markup: 1.4, icon: '' },
    magic_items: { name: 'Magic Items', markup: 2.0, icon: '' },
    artifacts: { name: 'Artifacts', markup: 5.0, icon: '' },
    materials: { name: 'Raw Materials', markup: 0.8, icon: '' },
    services: { name: 'Services', markup: 1.0, icon: '' }
};

// Market conditions affecting prices
export const MARKET_CONDITIONS = {
    boom: { name: 'Economic Boom', buyMod: 0.9, sellMod: 1.1 },
    stable: { name: 'Stable', buyMod: 1.0, sellMod: 1.0 },
    recession: { name: 'Recession', buyMod: 1.1, sellMod: 0.8 },
    shortage: { name: 'Shortage', buyMod: 1.5, sellMod: 1.3 },
    surplus: { name: 'Surplus', buyMod: 0.7, sellMod: 0.6 },
    war: { name: 'Wartime', buyMod: 1.4, sellMod: 0.9 },
    festival: { name: 'Festival', buyMod: 1.2, sellMod: 1.2 },
    disaster: { name: 'Disaster', buyMod: 2.0, sellMod: 0.5 }
};

// Service types
export const SERVICE_TYPES = {
    healing: { name: 'Healing', basePrice: 50, category: 'temple' },
    resurrection: { name: 'Resurrection', basePrice: 5000, category: 'temple' },
    curse_removal: { name: 'Curse Removal', basePrice: 500, category: 'temple' },
    blessing: { name: 'Blessing', basePrice: 100, category: 'temple' },
    repair_weapon: { name: 'Weapon Repair', basePrice: 20, category: 'blacksmith' },
    repair_armor: { name: 'Armor Repair', basePrice: 50, category: 'blacksmith' },
    sharpen: { name: 'Sharpen Weapon', basePrice: 5, category: 'blacksmith' },
    forge_custom: { name: 'Custom Forging', basePrice: 200, category: 'blacksmith' },
    identify: { name: 'Identify Item', basePrice: 100, category: 'magic' },
    enchant: { name: 'Enchanting', basePrice: 500, category: 'magic' },
    teleport: { name: 'Teleportation', basePrice: 1000, category: 'magic' },
    scrying: { name: 'Scrying', basePrice: 200, category: 'magic' },
    room_common: { name: 'Common Room', basePrice: 2, category: 'inn' },
    room_private: { name: 'Private Room', basePrice: 10, category: 'inn' },
    room_luxury: { name: 'Luxury Suite', basePrice: 50, category: 'inn' },
    meal_simple: { name: 'Simple Meal', basePrice: 1, category: 'inn' },
    meal_fine: { name: 'Fine Meal', basePrice: 5, category: 'inn' },
    stabling: { name: 'Horse Stabling', basePrice: 5, category: 'stables' },
    mount_rental: { name: 'Mount Rental', basePrice: 20, category: 'stables' },
    transport: { name: 'Transport Service', basePrice: 30, category: 'stables' },
    training_basic: { name: 'Basic Training', basePrice: 100, category: 'training' },
    training_advanced: { name: 'Advanced Training', basePrice: 500, category: 'training' },
    information: { name: 'Information', basePrice: 50, category: 'informant' }
};

// Convert amount to copper (base unit)
export function toCopper(amount, currency = 'gold') {
    const curr = CURRENCIES[currency];
    return amount * (curr?.value || 100);
}

// Convert copper to readable currency string
export function formatCurrency(copperAmount) {
    if (copperAmount >= 1000) {
        const pp = Math.floor(copperAmount / 1000);
        const remainder = copperAmount % 1000;
        if (remainder === 0) return `${pp} pp`;
        return `${pp} pp ${formatCurrency(remainder)}`;
    }
    if (copperAmount >= 100) {
        const gp = Math.floor(copperAmount / 100);
        const remainder = copperAmount % 100;
        if (remainder === 0) return `${gp} gp`;
        return `${gp} gp ${formatCurrency(remainder)}`;
    }
    if (copperAmount >= 10) {
        const sp = Math.floor(copperAmount / 10);
        const remainder = copperAmount % 10;
        if (remainder === 0) return `${sp} sp`;
        return `${sp} sp ${remainder} cp`;
    }
    return `${copperAmount} cp`;
}

// Calculate price with modifiers
export function calculatePrice(basePrice, options = {}) {
    let price = basePrice;

    // Category markup
    if (options.category && ITEM_CATEGORIES[options.category]) {
        price *= ITEM_CATEGORIES[options.category].markup;
    }

    // Market condition
    if (options.marketCondition && MARKET_CONDITIONS[options.marketCondition]) {
        const condition = MARKET_CONDITIONS[options.marketCondition];
        price *= options.isBuying ? condition.buyMod : condition.sellMod;
    }

    // Reputation/relationship discount
    if (options.reputation) {
        const discountPercent = Math.min(20, options.reputation / 5); // Max 20% discount
        if (options.isBuying) {
            price *= (1 - discountPercent / 100);
        } else {
            price *= (1 + discountPercent / 100);
        }
    }

    // Haggling modifier
    if (options.haggleResult) {
        price *= (1 - options.haggleResult / 100);
    }

    // Location modifier (frontier = expensive, city = cheaper)
    if (options.locationMod) {
        price *= options.locationMod;
    }

    // Round to nearest copper
    return Math.round(Math.max(1, price));
}

// Calculate sell price (typically half of buy price)
export function calculateSellPrice(basePrice, options = {}) {
    return calculatePrice(basePrice * 0.5, { ...options, isBuying: false });
}

// Generate random price fluctuation
export function generatePriceFluctuation(basePrice, volatility = 0.1) {
    const fluctuation = (Math.random() * 2 - 1) * volatility;
    return Math.round(basePrice * (1 + fluctuation));
}

// Daily market update
export function updateMarketPrices(economy, dayData) {
    const updates = [];

    // Random chance of market condition change
    if (Math.random() < 0.1) { // 10% chance per day
        const conditions = Object.keys(MARKET_CONDITIONS);
        const oldCondition = economy.marketCondition;
        // Weighted toward stable
        if (Math.random() < 0.5) {
            economy.marketCondition = 'stable';
        } else {
            economy.marketCondition = conditions[Math.floor(Math.random() * conditions.length)];
        }
        if (economy.marketCondition !== oldCondition) {
            updates.push({
                type: 'market_change',
                from: oldCondition,
                to: economy.marketCondition
            });
        }
    }

    // Update tracked prices with slight fluctuation
    for (const [itemId, priceData] of Object.entries(economy.trackedPrices || {})) {
        const newPrice = generatePriceFluctuation(priceData.basePrice, 0.05);
        economy.trackedPrices[itemId] = {
            ...priceData,
            currentPrice: newPrice,
            lastUpdated: new Date().toISOString()
        };
    }

    return updates;
}

// Create empty economy state
export function createEmptyEconomyState() {
    return {
        // Player wealth
        wallet: {
            copper: 0,
            silver: 0,
            gold: 100,
            platinum: 0,
            gems: 0
        },

        // Market conditions
        marketCondition: 'stable',
        regionMod: 1.0,

        // Known shops
        shops: [],

        // Price tracking
        trackedPrices: {},

        // Transaction history
        transactions: [],

        // Debts and loans
        debts: [],

        // Assets/investments
        investments: []
    };
}

// Build economy context for AI
export function buildEconomyContext(economy) {
    const parts = [];

    // Player wealth
    const totalCopper = (economy.wallet?.copper || 0) +
        (economy.wallet?.silver || 0) * 10 +
        (economy.wallet?.gold || 0) * 100 +
        (economy.wallet?.platinum || 0) * 1000;

    if (totalCopper > 0) {
        parts.push(`Wealth: ${formatCurrency(totalCopper)}`);
    }

    // Market condition if notable
    if (economy.marketCondition && economy.marketCondition !== 'stable') {
        const condition = MARKET_CONDITIONS[economy.marketCondition];
        parts.push(`Market: ${condition.name}`);
    }

    // Active debts
    if (economy.debts?.length > 0) {
        const totalDebt = economy.debts.reduce((sum, d) => sum + d.amount, 0);
        parts.push(`Debts: ${formatCurrency(toCopper(totalDebt))}`);
    }

    return parts.join('\n');
}
