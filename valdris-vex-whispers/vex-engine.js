/**
 * Vex Engine
 * The brain behind the system companion
 */

// Vex personality and voice
export const VEX_PERSONALITY = {
    name: 'Vex',
    title: 'System Companion',
    icon: '',
    colors: {
        primary: '#00BCD4',
        glow: 'rgba(0, 188, 212, 0.3)'
    },
    voices: {
        neutral: ['...', 'Hmm...', 'I see...'],
        positive: ['Excellent!', 'Well done!', 'Impressive!'],
        warning: ['Be careful...', 'I sense danger...', 'Watch out...'],
        hint: ['Perhaps...', 'Consider this...', 'A thought...'],
        urgent: ['Alert!', 'Attention!', 'Critical!']
    }
};

// Hint categories
export const HINT_CATEGORIES = {
    combat: { name: 'Combat', icon: '', priority: 1 },
    quest: { name: 'Quest', icon: '', priority: 2 },
    social: { name: 'Social', icon: '', priority: 3 },
    exploration: { name: 'Exploration', icon: '', priority: 4 },
    economy: { name: 'Economy', icon: '', priority: 5 },
    lore: { name: 'Lore', icon: '', priority: 6 },
    warning: { name: 'Warning', icon: '', priority: 0 },
    reminder: { name: 'Reminder', icon: '', priority: 2 }
};

// Create a hint
export function createHint(overrides = {}) {
    return {
        id: overrides.id || `hint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        category: overrides.category || 'hint',
        message: overrides.message || '',
        priority: overrides.priority || 5,
        source: overrides.source || 'vex',
        timestamp: overrides.timestamp || new Date().toISOString(),
        read: overrides.read || false,
        dismissed: overrides.dismissed || false,
        expires: overrides.expires || null, // ISO date string
        context: overrides.context || {} // Additional data
    };
}

// Analyze state and generate contextual hints
export function generateHints(coreState) {
    const hints = [];

    // Check player state
    if (coreState.player) {
        const player = coreState.player;

        // Low health warning
        if (player.hp && player.hp.current <= player.hp.max * 0.25) {
            hints.push(createHint({
                category: 'warning',
                message: `Your health is critically low (${player.hp.current}/${player.hp.max}). Consider healing before combat.`,
                priority: 0
            }));
        }

        // Low resources
        if (player.mp && player.mp.current <= player.mp.max * 0.1) {
            hints.push(createHint({
                category: 'warning',
                message: 'Your mana is nearly depleted.',
                priority: 1
            }));
        }

        // Wounds reminder
        if (player.wounds && player.wounds.length > 0) {
            const serious = player.wounds.filter(w => w.severity === 'severe' || w.severity === 'critical');
            if (serious.length > 0) {
                hints.push(createHint({
                    category: 'warning',
                    message: `You have ${serious.length} serious wound${serious.length > 1 ? 's' : ''} that need attention.`,
                    priority: 1
                }));
            }
        }
    }

    // Check time state
    if (coreState.time) {
        const time = coreState.time;

        // Night travel warning
        if (time.hour >= 20 || time.hour < 6) {
            hints.push(createHint({
                category: 'warning',
                message: 'Traveling at night is more dangerous. Consider resting until dawn.',
                priority: 3
            }));
        }

        // Weather effects
        if (time.weather && ['storm', 'blizzard', 'sandstorm'].includes(time.weather.type)) {
            hints.push(createHint({
                category: 'warning',
                message: `The ${time.weather.type} may affect travel and combat.`,
                priority: 2
            }));
        }
    }

    // Check world state
    if (coreState.world) {
        const world = coreState.world;

        // Danger level
        if (world.dangerLevel === 'extreme' || world.dangerLevel === 'deadly') {
            hints.push(createHint({
                category: 'warning',
                message: `This area has ${world.dangerLevel} danger level. Proceed with extreme caution.`,
                priority: 0
            }));
        }

        // Active hazards
        if (world.hazards && world.hazards.length > 0) {
            hints.push(createHint({
                category: 'exploration',
                message: `Environmental hazards active: ${world.hazards.map(h => h.name || h.type).join(', ')}`,
                priority: 2
            }));
        }

        // Law warnings
        if (world.laws) {
            if (world.laws.weapons === 'weapons_banned') {
                hints.push(createHint({
                    category: 'social',
                    message: 'Weapons are banned in this area. Keep them sheathed to avoid trouble.',
                    priority: 2
                }));
            }
            if (world.laws.magic === 'magic_banned') {
                hints.push(createHint({
                    category: 'social',
                    message: 'Magic use is prohibited here. Casting spells may have consequences.',
                    priority: 2
                }));
            }
        }
    }

    // Check economy state
    if (coreState.economy) {
        const eco = coreState.economy;

        // Low on money
        if (eco.totalWealth < 100) { // Less than 1 gold
            hints.push(createHint({
                category: 'economy',
                message: 'Your funds are running low. Consider finding work or selling items.',
                priority: 4
            }));
        }

        // Market opportunity
        if (eco.marketCondition === 'surplus') {
            hints.push(createHint({
                category: 'economy',
                message: 'Market surplus - good time to buy supplies at reduced prices.',
                priority: 5
            }));
        }
    }

    // Check NPC state
    if (coreState.npcs) {
        const npcs = coreState.npcs;

        // Relationship opportunities
        if (npcs.allies && npcs.allies > 0) {
            hints.push(createHint({
                category: 'social',
                message: `You have ${npcs.allies} allied NPC${npcs.allies > 1 ? 's' : ''}. They may be able to help.`,
                priority: 6
            }));
        }
    }

    // Check faction state
    if (coreState.factions) {
        const factions = coreState.factions;

        if (factions.hostile && factions.hostile > 0) {
            hints.push(createHint({
                category: 'warning',
                message: `${factions.hostile} faction${factions.hostile > 1 ? 's are' : ' is'} hostile to you. Watch for their agents.`,
                priority: 2
            }));
        }
    }

    // Sort by priority
    hints.sort((a, b) => a.priority - b.priority);

    return hints;
}

// Get a random Vex voice line
export function getVoiceLine(mood = 'neutral') {
    const lines = VEX_PERSONALITY.voices[mood] || VEX_PERSONALITY.voices.neutral;
    return lines[Math.floor(Math.random() * lines.length)];
}

// Build Vex context injection for AI
export function buildVexContext(hints, settings = {}) {
    if (!settings.injectHints || hints.length === 0) return '';

    const activeHints = hints
        .filter(h => !h.dismissed && (!h.expires || new Date(h.expires) > new Date()))
        .slice(0, settings.maxHints || 3);

    if (activeHints.length === 0) return '';

    const lines = activeHints.map(h => {
        const cat = HINT_CATEGORIES[h.category];
        return `${cat?.icon || ''} ${h.message}`;
    });

    return `[System Hints]\n${lines.join('\n')}`;
}

// Create empty Vex state
export function createEmptyVexState() {
    return {
        hints: [],
        history: [], // Past whispers/hints
        dismissed: [], // IDs of dismissed hints
        settings: {
            enabled: true,
            injectHints: true,
            maxHints: 3,
            showNotifications: true,
            autoGenerate: true
        }
    };
}
