/**
 * Environment Manager
 * Handles environmental hazards, local laws, and zone effects
 */

// Environmental hazard types
export const HAZARD_TYPES = {
    natural: {
        sandstorm: { name: 'Sandstorm', severity: 'high', effects: ['visibility_none', 'movement_slow', 'damage_wind'] },
        blizzard: { name: 'Blizzard', severity: 'high', effects: ['visibility_poor', 'movement_slow', 'cold_damage'] },
        flood: { name: 'Flood', severity: 'moderate', effects: ['movement_blocked', 'water_hazard'] },
        earthquake: { name: 'Earthquake', severity: 'extreme', effects: ['structure_damage', 'terrain_change'] },
        wildfire: { name: 'Wildfire', severity: 'extreme', effects: ['fire_damage', 'smoke_inhalation', 'path_blocked'] },
        avalanche: { name: 'Avalanche', severity: 'deadly', effects: ['burial', 'path_blocked', 'cold_damage'] },
        volcanic: { name: 'Volcanic Activity', severity: 'extreme', effects: ['fire_damage', 'toxic_air', 'lava_flow'] },
        quicksand: { name: 'Quicksand', severity: 'moderate', effects: ['movement_trap', 'drowning_risk'] }
    },
    magical: {
        mana_storm: { name: 'Mana Storm', severity: 'high', effects: ['spell_disruption', 'wild_magic', 'magic_damage'] },
        dead_zone: { name: 'Dead Magic Zone', severity: 'moderate', effects: ['no_magic', 'item_suppression'] },
        wild_zone: { name: 'Wild Magic Zone', severity: 'moderate', effects: ['random_effects', 'spell_amplify'] },
        curse_field: { name: 'Curse Field', severity: 'high', effects: ['stat_drain', 'healing_reduced'] },
        time_distortion: { name: 'Time Distortion', severity: 'variable', effects: ['time_slow', 'time_fast', 'aging'] },
        planar_rift: { name: 'Planar Rift', severity: 'extreme', effects: ['summon_creatures', 'unstable_reality'] }
    },
    biological: {
        plague: { name: 'Plague', severity: 'extreme', effects: ['disease_spread', 'quarantine', 'death'] },
        miasma: { name: 'Miasma', severity: 'high', effects: ['poison_air', 'nausea', 'weakness'] },
        spore_cloud: { name: 'Spore Cloud', severity: 'moderate', effects: ['hallucinations', 'poison', 'infection'] },
        monster_territory: { name: 'Monster Territory', severity: 'high', effects: ['encounters_frequent', 'ambush_risk'] }
    },
    supernatural: {
        haunting: { name: 'Haunting', severity: 'moderate', effects: ['fear', 'possession_risk', 'illusions'] },
        corruption: { name: 'Corruption', severity: 'high', effects: ['alignment_shift', 'mutation_risk', 'madness'] },
        divine_wrath: { name: 'Divine Wrath', severity: 'extreme', effects: ['smite_risk', 'healing_blocked', 'curse'] }
    }
};

// Local law categories
export const LAW_CATEGORIES = {
    weapons: {
        name: 'Weapons',
        laws: {
            weapons_banned: { name: 'All Weapons Banned', penalty: 'confiscation_imprisonment' },
            weapons_peace_bound: { name: 'Weapons Must Be Peace-Bound', penalty: 'fine_confiscation' },
            concealed_banned: { name: 'Concealed Weapons Banned', penalty: 'fine' },
            no_restriction: { name: 'No Restrictions', penalty: 'none' }
        }
    },
    magic: {
        name: 'Magic',
        laws: {
            magic_banned: { name: 'All Magic Banned', penalty: 'execution_imprisonment' },
            magic_licensed: { name: 'Magic Requires License', penalty: 'imprisonment' },
            dark_magic_banned: { name: 'Dark Magic Banned', penalty: 'execution' },
            summoning_banned: { name: 'Summoning Banned', penalty: 'imprisonment' },
            no_restriction: { name: 'No Restrictions', penalty: 'none' }
        }
    },
    race: {
        name: 'Race Restrictions',
        laws: {
            humans_only: { name: 'Humans Only', penalty: 'expulsion_imprisonment' },
            no_undead: { name: 'Undead Prohibited', penalty: 'destruction' },
            no_demons: { name: 'Demons/Fiends Prohibited', penalty: 'execution' },
            registration_required: { name: 'Non-Humans Must Register', penalty: 'fine_expulsion' },
            no_restriction: { name: 'No Restrictions', penalty: 'none' }
        }
    },
    commerce: {
        name: 'Commerce',
        laws: {
            guild_monopoly: { name: 'Guild Monopoly on Trade', penalty: 'fine_confiscation' },
            no_foreign_trade: { name: 'No Foreign Trade', penalty: 'imprisonment' },
            tax_heavy: { name: 'Heavy Taxation (30%+)', penalty: 'fine' },
            tax_moderate: { name: 'Moderate Taxation (10-20%)', penalty: 'fine' },
            free_trade: { name: 'Free Trade', penalty: 'none' }
        }
    },
    curfew: {
        name: 'Curfew',
        laws: {
            strict_curfew: { name: 'Strict Curfew (Sundown)', penalty: 'imprisonment' },
            partial_curfew: { name: 'Curfew for Non-Residents', penalty: 'fine' },
            no_curfew: { name: 'No Curfew', penalty: 'none' }
        }
    }
};

// Zone effect types
export const ZONE_EFFECTS = {
    sanctuary: { name: 'Sanctuary', description: 'Violence is impossible', effect: 'no_combat' },
    consecrated: { name: 'Consecrated Ground', description: 'Undead take damage', effect: 'undead_harm' },
    desecrated: { name: 'Desecrated Ground', description: 'Healing reduced', effect: 'healing_penalty' },
    silenced: { name: 'Silenced Zone', description: 'No sound, verbal spells fail', effect: 'no_sound' },
    dimensional_anchor: { name: 'Dimensional Anchor', description: 'No teleportation', effect: 'no_teleport' },
    ley_line: { name: 'Ley Line', description: 'Magic amplified', effect: 'magic_boost' },
    null_field: { name: 'Null Magic Field', description: 'All magic suppressed', effect: 'no_magic' },
    gravity_altered: { name: 'Altered Gravity', description: 'Movement affected', effect: 'gravity_change' },
    respawn_point: { name: 'Respawn Point', description: 'Death returns here', effect: 'respawn' }
};

// Create empty environment state
export function createEmptyEnvironmentState() {
    return {
        // Current zone effects
        activeEffects: [],

        // Active hazards
        hazards: [],

        // Local laws
        laws: {
            weapons: 'no_restriction',
            magic: 'no_restriction',
            race: 'no_restriction',
            commerce: 'tax_moderate',
            curfew: 'no_curfew'
        },

        // Danger level
        dangerLevel: 'safe',

        // Special conditions
        conditions: [],

        // Faction control
        controllingFaction: null,
        factionRelation: 'neutral'
    };
}

// Check if action is legal
export function checkLegality(action, environmentState) {
    const violations = [];

    switch (action.type) {
        case 'draw_weapon':
        case 'attack':
            if (environmentState.laws.weapons === 'weapons_banned') {
                violations.push({
                    law: 'Weapons Banned',
                    penalty: LAW_CATEGORIES.weapons.laws.weapons_banned.penalty
                });
            }
            break;

        case 'cast_spell':
            if (environmentState.laws.magic === 'magic_banned') {
                violations.push({
                    law: 'Magic Banned',
                    penalty: LAW_CATEGORIES.magic.laws.magic_banned.penalty
                });
            } else if (environmentState.laws.magic === 'magic_licensed' && !action.hasLicense) {
                violations.push({
                    law: 'Magic Requires License',
                    penalty: LAW_CATEGORIES.magic.laws.magic_licensed.penalty
                });
            }
            if (action.school === 'necromancy' && environmentState.laws.magic === 'dark_magic_banned') {
                violations.push({
                    law: 'Dark Magic Banned',
                    penalty: LAW_CATEGORIES.magic.laws.dark_magic_banned.penalty
                });
            }
            break;

        case 'summon':
            if (environmentState.laws.magic === 'summoning_banned') {
                violations.push({
                    law: 'Summoning Banned',
                    penalty: LAW_CATEGORIES.magic.laws.summoning_banned.penalty
                });
            }
            break;

        case 'trade':
            if (environmentState.laws.commerce === 'guild_monopoly' && !action.isGuildMember) {
                violations.push({
                    law: 'Guild Monopoly',
                    penalty: LAW_CATEGORIES.commerce.laws.guild_monopoly.penalty
                });
            }
            break;
    }

    // Check zone effects
    for (const effect of environmentState.activeEffects) {
        if (effect.type === 'sanctuary' && (action.type === 'attack' || action.type === 'cast_offensive')) {
            violations.push({
                effect: 'Sanctuary Zone',
                blocked: true
            });
        }
        if (effect.type === 'no_magic' && action.type.startsWith('cast')) {
            violations.push({
                effect: 'Null Magic Field',
                blocked: true
            });
        }
    }

    return {
        legal: violations.length === 0,
        violations
    };
}

// Get active hazard effects
export function getHazardEffects(hazards) {
    const effects = new Set();

    for (const hazard of hazards) {
        const category = Object.values(HAZARD_TYPES).find(cat =>
            Object.keys(cat).includes(hazard.type)
        );
        if (category && category[hazard.type]) {
            category[hazard.type].effects.forEach(e => effects.add(e));
        }
    }

    return Array.from(effects);
}

// Build environment context for AI
export function buildEnvironmentContext(environmentState) {
    const parts = [];

    // Danger level
    if (environmentState.dangerLevel && environmentState.dangerLevel !== 'safe') {
        parts.push(`Zone Danger: ${environmentState.dangerLevel.toUpperCase()}`);
    }

    // Active hazards
    if (environmentState.hazards?.length > 0) {
        const hazardNames = environmentState.hazards.map(h => {
            const category = Object.values(HAZARD_TYPES).find(cat =>
                Object.keys(cat).includes(h.type)
            );
            return category?.[h.type]?.name || h.type;
        });
        parts.push(`Active Hazards: ${hazardNames.join(', ')}`);
    }

    // Zone effects
    if (environmentState.activeEffects?.length > 0) {
        const effectNames = environmentState.activeEffects.map(e =>
            ZONE_EFFECTS[e.type]?.name || e.type
        );
        parts.push(`Zone Effects: ${effectNames.join(', ')}`);
    }

    // Notable laws
    const notableLaws = [];
    if (environmentState.laws?.weapons === 'weapons_banned') {
        notableLaws.push('Weapons BANNED');
    }
    if (environmentState.laws?.magic === 'magic_banned') {
        notableLaws.push('Magic BANNED');
    }
    if (environmentState.laws?.curfew === 'strict_curfew') {
        notableLaws.push('Curfew in effect');
    }
    if (notableLaws.length > 0) {
        parts.push(`Local Laws: ${notableLaws.join(', ')}`);
    }

    // Controlling faction
    if (environmentState.controllingFaction) {
        parts.push(`Controlled by: ${environmentState.controllingFaction} (${environmentState.factionRelation})`);
    }

    return parts.join('\n');
}

// Process daily environment changes
export function processDailyEnvironment(environmentState, timeData) {
    const changes = [];

    // Hazards might dissipate
    const remainingHazards = [];
    for (const hazard of environmentState.hazards || []) {
        if (hazard.duration !== 'permanent') {
            hazard.daysRemaining = (hazard.daysRemaining || 1) - 1;
            if (hazard.daysRemaining <= 0) {
                changes.push({ type: 'hazard_ended', hazard: hazard.type });
                continue;
            }
        }
        remainingHazards.push(hazard);
    }

    return {
        updatedHazards: remainingHazards,
        changes
    };
}
