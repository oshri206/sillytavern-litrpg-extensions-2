/**
 * Location Tracker
 * Manages regions, zones, settlements, and travel
 */

// Region types with their characteristics
export const REGION_TYPES = {
    plains: {
        name: 'Plains',
        travelSpeed: 1.0,
        visibility: 'excellent',
        forageBonus: 0,
        shelterChance: 0.1
    },
    forest: {
        name: 'Forest',
        travelSpeed: 0.7,
        visibility: 'limited',
        forageBonus: 20,
        shelterChance: 0.6
    },
    mountains: {
        name: 'Mountains',
        travelSpeed: 0.4,
        visibility: 'variable',
        forageBonus: -10,
        shelterChance: 0.4
    },
    desert: {
        name: 'Desert',
        travelSpeed: 0.6,
        visibility: 'excellent',
        forageBonus: -30,
        shelterChance: 0.1
    },
    swamp: {
        name: 'Swamp',
        travelSpeed: 0.3,
        visibility: 'poor',
        forageBonus: 10,
        shelterChance: 0.2
    },
    tundra: {
        name: 'Tundra',
        travelSpeed: 0.5,
        visibility: 'excellent',
        forageBonus: -20,
        shelterChance: 0.2
    },
    jungle: {
        name: 'Jungle',
        travelSpeed: 0.4,
        visibility: 'very_limited',
        forageBonus: 30,
        shelterChance: 0.7
    },
    coastal: {
        name: 'Coastal',
        travelSpeed: 0.9,
        visibility: 'good',
        forageBonus: 15,
        shelterChance: 0.3
    },
    underground: {
        name: 'Underground',
        travelSpeed: 0.5,
        visibility: 'none',
        forageBonus: -20,
        shelterChance: 0.8
    },
    magical: {
        name: 'Magical Zone',
        travelSpeed: 0.8,
        visibility: 'distorted',
        forageBonus: 0,
        shelterChance: 0.3
    }
};

// Settlement sizes and their services
export const SETTLEMENT_SIZES = {
    hamlet: {
        name: 'Hamlet',
        population: '20-100',
        services: ['basic_supplies', 'rest'],
        guards: 0,
        lawEnforcement: 'minimal'
    },
    village: {
        name: 'Village',
        population: '100-500',
        services: ['basic_supplies', 'rest', 'temple', 'blacksmith'],
        guards: 2,
        lawEnforcement: 'light'
    },
    town: {
        name: 'Town',
        population: '500-5000',
        services: ['supplies', 'rest', 'temple', 'blacksmith', 'stables', 'tavern', 'market'],
        guards: 10,
        lawEnforcement: 'moderate'
    },
    city: {
        name: 'City',
        population: '5000-25000',
        services: ['all_supplies', 'inn', 'temples', 'smiths', 'stables', 'taverns', 'markets', 'guild_halls', 'magic_shop'],
        guards: 50,
        lawEnforcement: 'strong'
    },
    metropolis: {
        name: 'Metropolis',
        population: '25000+',
        services: ['all'],
        guards: 200,
        lawEnforcement: 'very_strong'
    },
    outpost: {
        name: 'Outpost',
        population: '10-50',
        services: ['basic_supplies'],
        guards: 5,
        lawEnforcement: 'military'
    },
    fortress: {
        name: 'Fortress',
        population: '100-1000',
        services: ['military_supplies', 'rest', 'blacksmith'],
        guards: 100,
        lawEnforcement: 'military'
    },
    dungeon: {
        name: 'Dungeon',
        population: 'varies',
        services: [],
        guards: 0,
        lawEnforcement: 'none'
    }
};

// Zone danger levels
export const DANGER_LEVELS = {
    safe: { name: 'Safe', color: '#4CAF50', encounterMod: -50, lootMod: -30 },
    low: { name: 'Low Risk', color: '#8BC34A', encounterMod: -20, lootMod: 0 },
    moderate: { name: 'Moderate', color: '#FFC107', encounterMod: 0, lootMod: 10 },
    high: { name: 'High Risk', color: '#FF9800', encounterMod: 20, lootMod: 25 },
    extreme: { name: 'Extreme', color: '#F44336', encounterMod: 50, lootMod: 50 },
    deadly: { name: 'Deadly', color: '#9C27B0', encounterMod: 100, lootMod: 100 }
};

// Create empty location state
export function createEmptyLocationState() {
    return {
        // Current position
        currentRegion: '',
        currentZone: '',
        currentSettlement: null,
        coordinates: { x: 0, y: 0 },

        // Known regions
        regions: [],

        // Known settlements
        settlements: [],

        // Points of interest
        pointsOfInterest: [],

        // Travel state
        traveling: false,
        travelDestination: null,
        travelProgress: 0,
        travelMethod: 'foot',

        // History
        locationHistory: [],
        discoveredLocations: []
    };
}

// Calculate travel time between locations
export function calculateTravelTime(from, to, method, regionType) {
    const baseSpeed = {
        foot: 24,       // 24 miles per day
        horse: 48,      // 48 miles per day
        cart: 16,       // 16 miles per day
        carriage: 32,   // 32 miles per day
        ship: 72,       // 72 miles per day
        flying: 96,     // 96 miles per day
        teleport: 0     // instant
    };

    if (method === 'teleport') return 0;

    const region = REGION_TYPES[regionType] || REGION_TYPES.plains;
    const speed = (baseSpeed[method] || baseSpeed.foot) * region.travelSpeed;

    // Calculate distance (placeholder - could be enhanced with actual coordinates)
    const distance = Math.sqrt(
        Math.pow((to.x || 0) - (from.x || 0), 2) +
        Math.pow((to.y || 0) - (from.y || 0), 2)
    );

    return Math.ceil(distance / speed);
}

// Get region description for AI context
export function buildLocationContext(locationState, worldState) {
    const parts = [];

    // Current location
    if (locationState.currentSettlement) {
        const settlement = locationState.currentSettlement;
        parts.push(`Currently in ${settlement.name} (${SETTLEMENT_SIZES[settlement.size]?.name || settlement.size})`);
        if (settlement.faction) parts.push(`Controlled by: ${settlement.faction}`);
    } else if (locationState.currentZone) {
        parts.push(`Currently in ${locationState.currentZone}`);
    }

    if (locationState.currentRegion) {
        parts.push(`Region: ${locationState.currentRegion}`);
    }

    // Danger level
    if (worldState?.dangerLevel) {
        const danger = DANGER_LEVELS[worldState.dangerLevel];
        if (danger) parts.push(`Danger: ${danger.name}`);
    }

    // Active hazards
    if (worldState?.hazards?.length > 0) {
        parts.push(`Hazards: ${worldState.hazards.map(h => h.name).join(', ')}`);
    }

    // Travel status
    if (locationState.traveling) {
        parts.push(`Traveling to ${locationState.travelDestination?.name || 'unknown'} (${locationState.travelProgress}% complete)`);
    }

    return parts.join('\n');
}

// Parse AI response for location changes
export function parseLocationFromResponse(text) {
    const locationPatterns = {
        arrival: /(?:arrive[ds]?|reach(?:es|ed)?|enter(?:s|ed)?|come[s]? to)\s+(?:the\s+)?([A-Z][a-zA-Z\s]+?)(?:\.|,|!|\s+and)/gi,
        departure: /(?:leave[s]?|depart[s]?|exit[s]?)\s+(?:the\s+)?([A-Z][a-zA-Z\s]+?)(?:\.|,|!|\s+and)/gi,
        travel: /(?:travel(?:s|ing)?|journey(?:s|ing)?|head(?:s|ing)?)\s+(?:to(?:ward)?|through)\s+(?:the\s+)?([A-Z][a-zA-Z\s]+?)(?:\.|,|!|\s+and)/gi,
        region: /(?:in|within|across)\s+the\s+([A-Z][a-zA-Z\s]+?)\s+(?:region|lands|territory|kingdom)/gi
    };

    const detected = {
        arrivals: [],
        departures: [],
        travelTo: [],
        regions: []
    };

    let match;

    for (const pattern of Object.values(locationPatterns)) {
        pattern.lastIndex = 0;
        while ((match = pattern.exec(text)) !== null) {
            const location = match[1].trim();
            if (pattern === locationPatterns.arrival) {
                detected.arrivals.push(location);
            } else if (pattern === locationPatterns.departure) {
                detected.departures.push(location);
            } else if (pattern === locationPatterns.travel) {
                detected.travelTo.push(location);
            } else if (pattern === locationPatterns.region) {
                detected.regions.push(location);
            }
        }
    }

    return detected;
}

// Validate location transition
export function validateTransition(currentLocation, newLocation, method) {
    // Could add distance validation, faction restrictions, etc.
    if (method === 'teleport') {
        return { valid: true };
    }

    // Placeholder for more complex validation
    return { valid: true, warnings: [] };
}
