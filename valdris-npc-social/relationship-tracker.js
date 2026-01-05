/**
 * Relationship Tracker
 * Social network analysis and relationship evolution
 */

// Relationship change events
export const RELATIONSHIP_EVENTS = {
    // Positive events
    helped: { relationship: 10, trust: 5, description: 'Helped them' },
    saved_life: { relationship: 30, trust: 20, description: 'Saved their life' },
    gift_small: { relationship: 3, trust: 0, description: 'Small gift' },
    gift_large: { relationship: 10, trust: 5, description: 'Generous gift' },
    completed_quest: { relationship: 15, trust: 10, description: 'Completed quest for them' },
    defended_honor: { relationship: 10, trust: 5, respect: 10, description: 'Defended their honor' },
    shared_secret: { trust: 15, description: 'Shared a secret' },
    kept_promise: { trust: 10, description: 'Kept a promise' },
    good_deal: { relationship: 5, description: 'Fair business deal' },

    // Negative events
    attacked: { relationship: -30, trust: -20, fear: 20, description: 'Attacked them' },
    stole: { relationship: -20, trust: -30, description: 'Stole from them' },
    lied: { relationship: -10, trust: -20, description: 'Caught lying' },
    betrayed: { relationship: -40, trust: -50, description: 'Betrayed them' },
    threatened: { relationship: -15, fear: 30, respect: -10, description: 'Threatened them' },
    insulted: { relationship: -10, respect: -15, description: 'Insulted them' },
    broke_promise: { trust: -25, description: 'Broke a promise' },
    killed_friend: { relationship: -50, trust: -30, description: 'Killed someone they cared about' },

    // Neutral/contextual
    intimidated: { fear: 20, respect: 5, description: 'Successfully intimidated' },
    impressed: { respect: 15, description: 'Impressed them' },
    humiliated: { relationship: -5, respect: -20, description: 'Humiliated them' },
    bribed: { relationship: 5, trust: -5, description: 'Bribed them' }
};

// Relationship decay over time (when not interacting)
export const RELATIONSHIP_DECAY = {
    positive: 0.1,  // Positive relationships decay slowly
    negative: 0.05, // Negative relationships decay very slowly
    trust: 0.02,    // Trust decays slowly
    fear: 0.5,      // Fear decays fastest
    respect: 0.05   // Respect is stable
};

// Apply a relationship event
export function applyRelationshipEvent(npc, eventType, intensity = 1) {
    const event = RELATIONSHIP_EVENTS[eventType];
    if (!event) return null;

    const changes = {
        relationship: (event.relationship || 0) * intensity,
        trust: (event.trust || 0) * intensity,
        fear: (event.fear || 0) * intensity,
        respect: (event.respect || 0) * intensity
    };

    // Apply changes
    npc.relationship = clamp(npc.relationship + changes.relationship, -100, 100);
    npc.trust = clamp(npc.trust + changes.trust, -100, 100);
    npc.fear = clamp(npc.fear + changes.fear, 0, 100);
    npc.respect = clamp(npc.respect + changes.respect, 0, 100);

    return {
        event: eventType,
        description: event.description,
        changes,
        newValues: {
            relationship: npc.relationship,
            trust: npc.trust,
            fear: npc.fear,
            respect: npc.respect
        }
    };
}

// Process daily relationship decay
export function processDailyDecay(npc, daysPassed = 1) {
    const changes = {};

    // Only decay if not recently interacted
    const lastInteraction = npc.lastInteraction ? new Date(npc.lastInteraction) : null;
    const now = new Date();
    const daysSinceInteraction = lastInteraction
        ? Math.floor((now - lastInteraction) / (1000 * 60 * 60 * 24))
        : daysPassed;

    if (daysSinceInteraction < 7) return changes; // Grace period

    const decayFactor = daysPassed * (daysSinceInteraction / 30); // Increases with time

    // Decay positive relationships
    if (npc.relationship > 0) {
        const decay = RELATIONSHIP_DECAY.positive * decayFactor;
        changes.relationship = -Math.min(decay, npc.relationship);
        npc.relationship = Math.max(0, npc.relationship - decay);
    } else if (npc.relationship < 0) {
        const decay = RELATIONSHIP_DECAY.negative * decayFactor;
        changes.relationship = Math.min(decay, -npc.relationship);
        npc.relationship = Math.min(0, npc.relationship + decay);
    }

    // Decay fear
    if (npc.fear > 0) {
        const decay = RELATIONSHIP_DECAY.fear * decayFactor;
        changes.fear = -Math.min(decay, npc.fear);
        npc.fear = Math.max(0, npc.fear - decay);
    }

    return changes;
}

// Analyze social network connections
export function analyzeNetwork(npcs) {
    const analysis = {
        factions: {},
        locations: {},
        clusters: [],
        influencers: [],
        isolated: []
    };

    // Group by faction and location
    for (const npc of npcs) {
        if (npc.faction) {
            analysis.factions[npc.faction] = analysis.factions[npc.faction] || [];
            analysis.factions[npc.faction].push(npc.id);
        }
        if (npc.location) {
            analysis.locations[npc.location] = analysis.locations[npc.location] || [];
            analysis.locations[npc.location].push(npc.id);
        }
    }

    // Find influencers (most connections)
    const connectionCounts = npcs.map(npc => ({
        npc,
        count: (npc.connections || []).length
    })).sort((a, b) => b.count - a.count);

    analysis.influencers = connectionCounts.slice(0, 5).filter(c => c.count > 0);
    analysis.isolated = connectionCounts.filter(c => c.count === 0).map(c => c.npc);

    return analysis;
}

// Get NPCs that might be affected by action against another NPC
export function getAffectedNPCs(npcs, targetId, action) {
    const affected = [];
    const target = npcs.find(n => n.id === targetId);
    if (!target) return affected;

    // Connected NPCs
    for (const npc of npcs) {
        if (npc.id === targetId) continue;

        // Direct connection
        if ((npc.connections || []).includes(targetId)) {
            affected.push({
                npc,
                reason: 'connected',
                intensity: 0.5 // 50% of the effect
            });
            continue;
        }

        // Same faction
        if (npc.faction && npc.faction === target.faction) {
            affected.push({
                npc,
                reason: 'faction',
                intensity: 0.3 // 30% of the effect
            });
        }
    }

    return affected;
}

// Generate relationship summary for context
export function generateRelationshipSummary(npcs) {
    const allies = npcs.filter(n => n.relationship >= 50 && n.alive);
    const enemies = npcs.filter(n => n.relationship <= -50 && n.alive);
    const trusted = npcs.filter(n => n.trust >= 50 && n.alive);
    const feared = npcs.filter(n => n.fear >= 50 && n.alive);

    const parts = [];

    if (allies.length > 0) {
        parts.push(`Allies: ${allies.map(n => n.name).join(', ')}`);
    }
    if (enemies.length > 0) {
        parts.push(`Enemies: ${enemies.map(n => n.name).join(', ')}`);
    }
    if (trusted.length > 0 && trusted.some(n => !allies.includes(n))) {
        const trustOnly = trusted.filter(n => !allies.includes(n));
        if (trustOnly.length > 0) {
            parts.push(`Trusted: ${trustOnly.map(n => n.name).join(', ')}`);
        }
    }
    if (feared.length > 0) {
        parts.push(`Fear you: ${feared.map(n => n.name).join(', ')}`);
    }

    return parts.join('\n');
}

// Helper
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

// Parse AI response for relationship changes
export function parseRelationshipChanges(text, knownNPCs) {
    const changes = [];

    const patterns = {
        positive: [
            /(?:thank|grateful|appreciate)s?\s+(?:you|the\s+player)/gi,
            /(?:smile|laugh|nod)s?\s+(?:warmly|approvingly|happily)/gi,
            /(?:trust|like|respect)s?\s+you\s+(?:more|now)/gi
        ],
        negative: [
            /(?:angry|furious|upset)\s+(?:with|at)\s+(?:you|the\s+player)/gi,
            /(?:distrust|hate|despise)s?\s+you/gi,
            /(?:glare|scowl|frown)s?\s+at\s+(?:you|the\s+player)/gi
        ]
    };

    // Look for NPC names in context with emotional indicators
    for (const npc of knownNPCs) {
        const namePattern = new RegExp(npc.name, 'gi');
        if (namePattern.test(text)) {
            // Check if name appears near positive/negative indicators
            for (const pattern of patterns.positive) {
                if (pattern.test(text)) {
                    changes.push({ npcId: npc.id, type: 'positive', intensity: 0.5 });
                }
            }
            for (const pattern of patterns.negative) {
                if (pattern.test(text)) {
                    changes.push({ npcId: npc.id, type: 'negative', intensity: 0.5 });
                }
            }
        }
    }

    return changes;
}
