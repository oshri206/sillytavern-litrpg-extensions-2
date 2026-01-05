/**
 * Faction Engine
 * Core faction data structures and standing calculations
 */

// Faction types
export const FACTION_TYPES = {
    kingdom: { name: 'Kingdom', icon: '', powerBase: 'territory' },
    guild: { name: 'Guild', icon: '', powerBase: 'members' },
    cult: { name: 'Cult', icon: '', powerBase: 'faith' },
    merchant: { name: 'Merchant House', icon: '', powerBase: 'wealth' },
    military: { name: 'Military Order', icon: '', powerBase: 'strength' },
    academy: { name: 'Academy', icon: '', powerBase: 'knowledge' },
    criminal: { name: 'Criminal Organization', icon: '', powerBase: 'fear' },
    noble: { name: 'Noble House', icon: '', powerBase: 'influence' },
    religious: { name: 'Religious Order', icon: '', powerBase: 'faith' },
    tribal: { name: 'Tribal Nation', icon: '', powerBase: 'tradition' },
    mage: { name: 'Mage Circle', icon: '', powerBase: 'magic' },
    monster: { name: 'Monster Faction', icon: '', powerBase: 'strength' }
};

// Standing levels
export const STANDING_LEVELS = {
    hated: { value: -1000, name: 'Hated', color: '#7B0000', benefits: [], penalties: ['attacked_on_sight', 'no_services'] },
    hostile: { value: -500, name: 'Hostile', color: '#B71C1C', benefits: [], penalties: ['no_services', 'increased_prices'] },
    unfriendly: { value: -200, name: 'Unfriendly', color: '#E65100', benefits: [], penalties: ['increased_prices'] },
    neutral: { value: 0, name: 'Neutral', color: '#9E9E9E', benefits: [], penalties: [] },
    friendly: { value: 200, name: 'Friendly', color: '#4CAF50', benefits: ['reduced_prices'], penalties: [] },
    honored: { value: 500, name: 'Honored', color: '#2E7D32', benefits: ['reduced_prices', 'special_quests'], penalties: [] },
    revered: { value: 800, name: 'Revered', color: '#1565C0', benefits: ['reduced_prices', 'special_quests', 'unique_items'], penalties: [] },
    exalted: { value: 1000, name: 'Exalted', color: '#FFD700', benefits: ['all'], penalties: [] }
};

// Relation types between factions
export const FACTION_RELATIONS = {
    allied: { name: 'Allied', modifier: 0.5, color: '#4CAF50' },
    friendly: { name: 'Friendly', modifier: 0.25, color: '#8BC34A' },
    neutral: { name: 'Neutral', modifier: 0, color: '#9E9E9E' },
    tense: { name: 'Tense', modifier: -0.1, color: '#FF9800' },
    hostile: { name: 'Hostile', modifier: -0.25, color: '#F44336' },
    war: { name: 'At War', modifier: -0.5, color: '#B71C1C' }
};

// Create faction
export function createFaction(overrides = {}) {
    return {
        id: overrides.id || `faction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: overrides.name || '',
        type: overrides.type || 'guild',
        description: overrides.description || '',

        // Player standing
        standing: overrides.standing || 0,

        // Power and influence
        power: overrides.power || 50, // 0-100
        influence: overrides.influence || 50, // 0-100
        territory: overrides.territory || [],

        // Leadership
        leader: overrides.leader || null,
        notableMembers: overrides.notableMembers || [],

        // Relations with other factions
        relations: overrides.relations || {}, // factionId -> relation type

        // Headquarters/bases
        headquarters: overrides.headquarters || '',

        // Values and priorities
        values: overrides.values || [],
        enemies: overrides.enemies || [],
        allies: overrides.allies || [],

        // Status
        active: overrides.active !== false,
        notes: overrides.notes || ''
    };
}

// Get standing level from numeric value
export function getStandingLevel(value) {
    const levels = Object.entries(STANDING_LEVELS)
        .sort((a, b) => b[1].value - a[1].value);

    for (const [key, level] of levels) {
        if (value >= level.value) {
            return { key, ...level };
        }
    }
    return { key: 'hated', ...STANDING_LEVELS.hated };
}

// Calculate standing change with ripple effects
export function calculateStandingChange(factions, factionId, baseChange) {
    const changes = [{ factionId, change: baseChange, reason: 'direct' }];
    const faction = factions.find(f => f.id === factionId);
    if (!faction) return changes;

    // Ripple to allied/hostile factions
    for (const [otherId, relation] of Object.entries(faction.relations || {})) {
        const relInfo = FACTION_RELATIONS[relation];
        if (relInfo && relInfo.modifier !== 0) {
            const rippleChange = Math.round(baseChange * relInfo.modifier);
            if (rippleChange !== 0) {
                changes.push({
                    factionId: otherId,
                    change: rippleChange,
                    reason: `${relation} with ${faction.name}`
                });
            }
        }
    }

    return changes;
}

// Process political events
export function processPoliticalEvent(factions, event) {
    const results = [];

    switch (event.type) {
        case 'war_declared':
            // Both factions become hostile
            const aggressor = factions.find(f => f.id === event.aggressorId);
            const defender = factions.find(f => f.id === event.defenderId);
            if (aggressor && defender) {
                aggressor.relations[event.defenderId] = 'war';
                defender.relations[event.aggressorId] = 'war';
                results.push({ type: 'war_started', factions: [aggressor.name, defender.name] });
            }
            break;

        case 'alliance_formed':
            const faction1 = factions.find(f => f.id === event.faction1Id);
            const faction2 = factions.find(f => f.id === event.faction2Id);
            if (faction1 && faction2) {
                faction1.relations[event.faction2Id] = 'allied';
                faction2.relations[event.faction1Id] = 'allied';
                faction1.allies.push(faction2.name);
                faction2.allies.push(faction1.name);
                results.push({ type: 'alliance_formed', factions: [faction1.name, faction2.name] });
            }
            break;

        case 'power_shift':
            const targetFaction = factions.find(f => f.id === event.factionId);
            if (targetFaction) {
                targetFaction.power = Math.max(0, Math.min(100, targetFaction.power + event.change));
                results.push({ type: 'power_changed', faction: targetFaction.name, newPower: targetFaction.power });
            }
            break;
    }

    return results;
}

// Build faction context for AI
export function buildFactionContext(faction, playerStanding) {
    const parts = [];
    const level = getStandingLevel(playerStanding);

    parts.push(`${faction.name} (${FACTION_TYPES[faction.type]?.name || faction.type})`);
    parts.push(`Your Standing: ${level.name} (${playerStanding >= 0 ? '+' : ''}${playerStanding})`);

    if (faction.headquarters) {
        parts.push(`HQ: ${faction.headquarters}`);
    }

    if (faction.power >= 80) {
        parts.push('Status: Dominant power');
    } else if (faction.power <= 20) {
        parts.push('Status: Weakened');
    }

    return parts.join('\n');
}

// Build summary of all factions
export function buildFactionsContext(state) {
    const parts = [];

    // Group by standing
    const allies = state.factions.filter(f => (state.standings[f.id] || 0) >= 500);
    const enemies = state.factions.filter(f => (state.standings[f.id] || 0) <= -500);

    if (allies.length > 0) {
        parts.push(`Allied Factions: ${allies.map(f => f.name).join(', ')}`);
    }
    if (enemies.length > 0) {
        parts.push(`Enemy Factions: ${enemies.map(f => f.name).join(', ')}`);
    }

    // Active conflicts
    const atWar = [];
    for (const faction of state.factions) {
        for (const [otherId, relation] of Object.entries(faction.relations || {})) {
            if (relation === 'war') {
                const other = state.factions.find(f => f.id === otherId);
                if (other && !atWar.some(w => w.includes(faction.name) && w.includes(other.name))) {
                    atWar.push(`${faction.name} vs ${other.name}`);
                }
            }
        }
    }
    if (atWar.length > 0) {
        parts.push(`Active Conflicts: ${atWar.join('; ')}`);
    }

    return parts.join('\n');
}

// Create empty faction state
export function createEmptyFactionState() {
    return {
        factions: [],
        standings: {}, // factionId -> standing value
        memberOf: [], // faction IDs player is member of
        events: [], // political event history
        settings: {
            contextEnabled: true
        }
    };
}
