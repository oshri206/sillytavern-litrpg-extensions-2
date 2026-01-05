/**
 * NPC Manager
 * Core NPC data structures and operations
 */

// NPC relationship standings
export const RELATIONSHIP_LEVELS = {
    nemesis: { value: -100, name: 'Nemesis', color: '#7B0000', icon: '' },
    hostile: { value: -75, name: 'Hostile', color: '#B71C1C', icon: '' },
    unfriendly: { value: -50, name: 'Unfriendly', color: '#E65100', icon: '' },
    wary: { value: -25, name: 'Wary', color: '#FF9800', icon: '' },
    neutral: { value: 0, name: 'Neutral', color: '#9E9E9E', icon: '' },
    acquaintance: { value: 25, name: 'Acquaintance', color: '#90CAF9', icon: '' },
    friendly: { value: 50, name: 'Friendly', color: '#4CAF50', icon: '' },
    trusted: { value: 75, name: 'Trusted', color: '#2E7D32', icon: '' },
    devoted: { value: 100, name: 'Devoted', color: '#FFD700', icon: '' }
};

// NPC disposition types (personality traits)
export const DISPOSITION_TYPES = {
    cooperative: { name: 'Cooperative', opposite: 'uncooperative' },
    honest: { name: 'Honest', opposite: 'deceptive' },
    brave: { name: 'Brave', opposite: 'cowardly' },
    generous: { name: 'Generous', opposite: 'greedy' },
    kind: { name: 'Kind', opposite: 'cruel' },
    loyal: { name: 'Loyal', opposite: 'treacherous' },
    patient: { name: 'Patient', opposite: 'impatient' },
    humble: { name: 'Humble', opposite: 'arrogant' },
    calm: { name: 'Calm', opposite: 'volatile' }
};

// NPC roles/archetypes
export const NPC_ROLES = {
    merchant: { name: 'Merchant', services: ['buy', 'sell', 'appraise'] },
    innkeeper: { name: 'Innkeeper', services: ['rest', 'meals', 'rumors'] },
    blacksmith: { name: 'Blacksmith', services: ['repair', 'forge', 'buy', 'sell'] },
    guard: { name: 'Guard', services: ['protection', 'information', 'arrest'] },
    noble: { name: 'Noble', services: ['patronage', 'quests', 'politics'] },
    priest: { name: 'Priest', services: ['healing', 'blessing', 'counsel'] },
    mage: { name: 'Mage', services: ['magic', 'enchant', 'identify'] },
    thief: { name: 'Thief', services: ['fence', 'information', 'contracts'] },
    guild_master: { name: 'Guild Master', services: ['membership', 'quests', 'training'] },
    informant: { name: 'Informant', services: ['information', 'rumors', 'contacts'] },
    trainer: { name: 'Trainer', services: ['training', 'sparring', 'advice'] },
    alchemist: { name: 'Alchemist', services: ['potions', 'buy', 'sell', 'identify'] },
    quest_giver: { name: 'Quest Giver', services: ['quests', 'rewards'] },
    companion: { name: 'Companion', services: ['travel', 'combat', 'support'] },
    rival: { name: 'Rival', services: [] },
    villain: { name: 'Villain', services: [] },
    commoner: { name: 'Commoner', services: ['rumors', 'directions'] }
};

// Create empty NPC
export function createNPC(overrides = {}) {
    return {
        id: overrides.id || `npc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: overrides.name || '',
        title: overrides.title || '',
        role: overrides.role || 'commoner',
        race: overrides.race || 'Human',
        gender: overrides.gender || '',
        age: overrides.age || '',
        location: overrides.location || '',
        faction: overrides.faction || '',

        // Relationship with player
        relationship: overrides.relationship || 0, // -100 to 100
        trust: overrides.trust || 0, // -100 to 100
        fear: overrides.fear || 0, // 0 to 100
        respect: overrides.respect || 0, // 0 to 100

        // Personality disposition
        disposition: overrides.disposition || {},

        // Knowledge about player
        knownFacts: overrides.knownFacts || [],
        secrets: overrides.secrets || [],

        // Social connections
        connections: overrides.connections || [], // IDs of other NPCs

        // Interaction history
        interactions: overrides.interactions || [],
        lastInteraction: overrides.lastInteraction || null,

        // Status
        alive: overrides.alive !== false,
        available: overrides.available !== false,
        notes: overrides.notes || '',
        tags: overrides.tags || [],

        // Portrait/appearance
        appearance: overrides.appearance || '',
        portrait: overrides.portrait || ''
    };
}

// Get relationship level from numeric value
export function getRelationshipLevel(value) {
    const levels = Object.entries(RELATIONSHIP_LEVELS)
        .sort((a, b) => b[1].value - a[1].value);

    for (const [key, level] of levels) {
        if (value >= level.value) {
            return { key, ...level };
        }
    }
    return { key: 'neutral', ...RELATIONSHIP_LEVELS.neutral };
}

// Calculate effective disposition (personality + relationship modifiers)
export function getEffectiveDisposition(npc) {
    const base = { ...npc.disposition };
    const relLevel = getRelationshipLevel(npc.relationship);

    // High relationship improves cooperation, trust-related traits
    if (npc.relationship > 50) {
        base.cooperative = (base.cooperative || 0) + 20;
        base.honest = (base.honest || 0) + 15;
    } else if (npc.relationship < -50) {
        base.cooperative = (base.cooperative || 0) - 30;
        base.honest = (base.honest || 0) - 20;
    }

    // Fear affects bravery and cooperation
    if (npc.fear > 50) {
        base.brave = (base.brave || 0) - 30;
        base.cooperative = (base.cooperative || 0) + 20; // More likely to comply
    }

    // Clamp all values to -100 to 100
    for (const key of Object.keys(base)) {
        base[key] = Math.max(-100, Math.min(100, base[key]));
    }

    return base;
}

// Check if NPC will help with something
export function willNPCHelp(npc, difficulty = 0, context = {}) {
    const effective = getEffectiveDisposition(npc);
    const cooperation = effective.cooperative || 0;

    let helpChance = 50 + cooperation * 0.3 + npc.relationship * 0.2;

    // Trust affects willingness for risky help
    if (difficulty > 0) {
        helpChance -= difficulty * (1 - npc.trust / 100);
    }

    // Role-based modifiers
    if (context.service && NPC_ROLES[npc.role]?.services.includes(context.service)) {
        helpChance += 30; // It's their job
    }

    // Faction alignment
    if (context.playerFaction && npc.faction === context.playerFaction) {
        helpChance += 20;
    }

    return {
        chance: Math.max(0, Math.min(100, helpChance)),
        willing: helpChance >= 50,
        enthusiasm: helpChance >= 80 ? 'eager' : helpChance >= 60 ? 'willing' : helpChance >= 40 ? 'reluctant' : 'unwilling'
    };
}

// Add interaction to NPC history
export function recordInteraction(npc, interaction) {
    const record = {
        date: interaction.date || new Date().toISOString(),
        type: interaction.type || 'conversation',
        outcome: interaction.outcome || 'neutral',
        relationshipChange: interaction.relationshipChange || 0,
        trustChange: interaction.trustChange || 0,
        notes: interaction.notes || ''
    };

    npc.interactions = npc.interactions || [];
    npc.interactions.unshift(record);

    // Keep last 20 interactions
    if (npc.interactions.length > 20) {
        npc.interactions = npc.interactions.slice(0, 20);
    }

    npc.lastInteraction = record.date;

    // Apply relationship changes
    npc.relationship = Math.max(-100, Math.min(100, npc.relationship + record.relationshipChange));
    npc.trust = Math.max(-100, Math.min(100, npc.trust + record.trustChange));

    return record;
}

// Build NPC context for AI
export function buildNPCContext(npc) {
    const parts = [];
    const relLevel = getRelationshipLevel(npc.relationship);

    parts.push(`${npc.name}${npc.title ? ` (${npc.title})` : ''}`);
    parts.push(`Role: ${NPC_ROLES[npc.role]?.name || npc.role}`);
    parts.push(`Relationship: ${relLevel.name} (${npc.relationship > 0 ? '+' : ''}${npc.relationship})`);

    if (npc.trust !== 0) {
        parts.push(`Trust: ${npc.trust > 0 ? 'Trusts you' : 'Distrusts you'} (${npc.trust})`);
    }

    if (npc.fear > 30) {
        parts.push(`Fears you (${npc.fear})`);
    }

    if (npc.faction) {
        parts.push(`Faction: ${npc.faction}`);
    }

    if (npc.location) {
        parts.push(`Location: ${npc.location}`);
    }

    // Key personality traits
    const traits = [];
    for (const [trait, value] of Object.entries(npc.disposition || {})) {
        if (Math.abs(value) >= 50) {
            const info = DISPOSITION_TYPES[trait];
            if (info) {
                traits.push(value > 0 ? info.name : info.opposite);
            }
        }
    }
    if (traits.length > 0) {
        parts.push(`Personality: ${traits.join(', ')}`);
    }

    return parts.join('\n');
}

// Build brief context for multiple NPCs
export function buildNPCsContext(npcs, maxCount = 5) {
    // Sort by most recently interacted
    const sorted = [...npcs]
        .filter(n => n.alive && n.available)
        .sort((a, b) => {
            if (!a.lastInteraction && !b.lastInteraction) return 0;
            if (!a.lastInteraction) return 1;
            if (!b.lastInteraction) return -1;
            return new Date(b.lastInteraction) - new Date(a.lastInteraction);
        })
        .slice(0, maxCount);

    if (sorted.length === 0) return '';

    const lines = sorted.map(npc => {
        const rel = getRelationshipLevel(npc.relationship);
        return `- ${npc.name}: ${rel.name}${npc.location ? ` (${npc.location})` : ''}`;
    });

    return `Recent NPCs:\n${lines.join('\n')}`;
}
