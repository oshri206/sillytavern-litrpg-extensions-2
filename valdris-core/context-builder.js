/**
 * Valdris Context Builder
 * Assembles state from all domains into AI-friendly context injection
 *
 * This module creates a comprehensive context block that gets injected
 * into AI prompts, providing the LLM with full world state awareness.
 */

import { getFullState, getDomainState } from './core-state.js';

const LOG_PREFIX = '[ValdrisContext]';

// Context injection settings (can be overridden)
const DEFAULT_SETTINGS = {
    enabled: true,
    includeTime: true,
    includePlayer: true,
    includeWorld: true,
    includeNPCs: true,
    includeEconomy: true,
    includeFactions: true,
    includeVex: false,
    includeNarrativeDirectives: true,
    maxRecentEvents: 3,
    maxNearbyNPCs: 5,
    customHeader: '',
    customFooter: ''
};

/**
 * Build the complete context block for AI injection
 * This gets prepended to prompts (hidden from user)
 *
 * @param {Object} settingsOverride - Override default settings
 * @returns {string} Formatted context block
 */
export function buildFullContext(settingsOverride = {}) {
    const settings = { ...DEFAULT_SETTINGS, ...settingsOverride };

    if (!settings.enabled) {
        return '';
    }

    const state = getFullState();
    const sections = [];

    // Header
    sections.push('[VALDRIS WORLD STATE - INTEGRATE NATURALLY, NEVER RECITE VERBATIM]');
    sections.push('');

    // Custom header
    if (settings.customHeader) {
        sections.push(settings.customHeader);
        sections.push('');
    }

    // Time & Celestial (from VTC)
    if (settings.includeTime && state.time) {
        const timeSection = buildTimeContext(state.time);
        if (timeSection) sections.push(timeSection);
    }

    // Player State (from VMT)
    if (settings.includePlayer && state.player) {
        const playerSection = buildPlayerContext(state.player);
        if (playerSection) sections.push(playerSection);
    }

    // World Events (from VWS)
    if (settings.includeWorld && state.world) {
        const worldSection = buildWorldContext(state.world, settings);
        if (worldSection) sections.push(worldSection);
    }

    // Nearby NPCs (from VNS)
    if (settings.includeNPCs && state.npcs) {
        const npcSection = buildNPCContext(state.npcs, settings);
        if (npcSection) sections.push(npcSection);
    }

    // Economy (from VES)
    if (settings.includeEconomy && state.economy) {
        const economySection = buildEconomyContext(state.economy);
        if (economySection) sections.push(economySection);
    }

    // Faction Status (from VFS)
    if (settings.includeFactions && state.factions) {
        const factionSection = buildFactionContext(state.factions);
        if (factionSection) sections.push(factionSection);
    }

    // Narrative Directives
    if (settings.includeNarrativeDirectives) {
        const narrativeSection = buildNarrativeDirectives(state);
        if (narrativeSection) sections.push(narrativeSection);
    }

    // Custom footer
    if (settings.customFooter) {
        sections.push('');
        sections.push(settings.customFooter);
    }

    sections.push('[/VALDRIS WORLD STATE]');

    return sections.filter(s => s).join('\n');
}

/**
 * Build context for a specific domain only
 * @param {string} domain - Domain name
 * @returns {string}
 */
export function buildDomainContext(domain) {
    const state = getDomainState(domain);
    if (!state) return '';

    switch (domain) {
        case 'time':
            return buildTimeContext(state);
        case 'player':
            return buildPlayerContext(state);
        case 'world':
            return buildWorldContext(state, DEFAULT_SETTINGS);
        case 'npcs':
            return buildNPCContext(state, DEFAULT_SETTINGS);
        case 'economy':
            return buildEconomyContext(state);
        case 'factions':
            return buildFactionContext(state);
        case 'vex':
            return buildVexContext(state);
        default:
            return '';
    }
}

// ============================================================================
// Domain-specific context builders
// ============================================================================

/**
 * Build time and environment context
 * @param {Object} time - Time domain state
 * @returns {string}
 */
function buildTimeContext(time) {
    if (!time) return '';

    const lines = ['## TIME & ENVIRONMENT'];

    // Date
    if (time.day && time.monthName && time.year) {
        lines.push(`Date: ${time.day} of ${time.monthName}, ${time.year} AV`);
    }

    // Time
    if (time.hour !== undefined && time.minute !== undefined) {
        lines.push(`Time: ${formatTime(time.hour, time.minute)} (${getTimeOfDay(time.hour)})`);
    }

    // Weather
    if (time.weather) {
        const weatherParts = [];
        if (time.weather.current) weatherParts.push(time.weather.current);
        if (time.weather.temperature) weatherParts.push(time.weather.temperature);
        if (time.weather.wind) weatherParts.push(time.weather.wind);
        if (weatherParts.length > 0) {
            lines.push(`Weather: ${weatherParts.join(', ')}`);
        }
        if (time.weather.visibility && time.weather.visibility !== 'good') {
            lines.push(`Visibility: ${time.weather.visibility}`);
        }
    }

    // Moons
    if (time.moons) {
        const moonParts = [];
        if (time.moons.lunara?.phase) {
            moonParts.push(`Lunara: ${formatMoonPhase(time.moons.lunara.phase)}`);
        }
        if (time.moons.veil?.phase) {
            moonParts.push(`Veil: ${formatMoonPhase(time.moons.veil.phase)}`);
        }
        if (moonParts.length > 0) {
            lines.push(moonParts.join(' | '));
        }
    }

    // Celestial effects
    if (time.celestialEffects?.length > 0) {
        lines.push(`Celestial Effects: ${time.celestialEffects.join(', ')}`);
    }

    // Upcoming celestial events
    if (time.celestialEvents?.length > 0) {
        const upcoming = time.celestialEvents.filter(e => e.daysUntil <= 3);
        if (upcoming.length > 0) {
            lines.push(`Upcoming: ${upcoming.map(e => `${e.name} in ${e.daysUntil}d`).join(', ')}`);
        }
    }

    // Upcoming festivals
    if (time.upcomingFestivals?.length > 0) {
        const soon = time.upcomingFestivals.filter(f => f.daysUntil <= 5);
        if (soon.length > 0) {
            lines.push(`Festivals: ${soon.map(f => `${f.name} in ${f.daysUntil}d`).join(', ')}`);
        }
    }

    return lines.join('\n');
}

/**
 * Build player state context
 * @param {Object} player - Player domain state
 * @returns {string}
 */
function buildPlayerContext(player) {
    if (!player) return '';

    const lines = ['## PLAYER STATE'];

    // Identity line
    const identityParts = [];
    if (player.characterName) identityParts.push(player.characterName);
    if (player.level) identityParts.push(`Level ${player.level}`);
    if (player.mainClass?.name) identityParts.push(player.mainClass.name);
    if (identityParts.length > 0) {
        lines.push(identityParts.join(' | '));
    }

    // Vitals
    const vitals = [];
    if (player.hp) {
        vitals.push(`HP: ${player.hp.current}/${player.hp.max}`);
    }
    if (player.mp) {
        vitals.push(`MP: ${player.mp.current}/${player.mp.max}`);
    }
    if (player.stamina) {
        vitals.push(`STA: ${player.stamina.current}/${player.stamina.max}`);
    }
    if (vitals.length > 0) {
        lines.push(vitals.join(' | '));
    }

    // Physical state descriptors for narrative guidance
    if (player.hp) {
        const hpPercent = player.hp.current / player.hp.max;
        if (hpPercent < 0.25) {
            lines.push('CRITICAL HEALTH: Describe pain, weakness, desperation, blurred vision');
        } else if (hpPercent < 0.5) {
            lines.push('WOUNDED: Describe visible injuries, labored movement, occasional wincing');
        } else if (hpPercent < 0.75) {
            lines.push('INJURED: Minor wounds, some discomfort');
        }
    }

    if (player.stamina) {
        const staPercent = player.stamina.current / player.stamina.max;
        if (staPercent < 0.25) {
            lines.push('EXHAUSTED: Describe heavy limbs, labored breath, need for rest');
        } else if (staPercent < 0.5) {
            lines.push('TIRED: Noticeable fatigue, slower reactions');
        }
    }

    if (player.mp) {
        const mpPercent = player.mp.current / player.mp.max;
        if (mpPercent < 0.25) {
            lines.push('MANA DRAINED: Magic feels distant, casting is strenuous');
        }
    }

    // Survival meters
    if (player.survivalMeters) {
        const criticalMeters = [];
        for (const [meter, data] of Object.entries(player.survivalMeters)) {
            if (data && data.current !== undefined && data.max !== undefined) {
                const percent = data.current / data.max;
                if (percent < 0.25) {
                    criticalMeters.push(`${meter}: CRITICAL`);
                }
            }
        }
        if (criticalMeters.length > 0) {
            lines.push(`Survival: ${criticalMeters.join(', ')}`);
        }
    }

    // Active buffs
    if (player.buffs?.length > 0) {
        const activeBuffs = player.buffs.filter(b => b.name);
        if (activeBuffs.length > 0) {
            const buffStr = activeBuffs.map(b => {
                if (b.remainingMinutes) {
                    return `${b.name} (${b.remainingMinutes}min)`;
                }
                return b.name;
            }).join(', ');
            lines.push(`Buffs: ${buffStr}`);
        }
    }

    // Active debuffs
    if (player.debuffs?.length > 0) {
        const activeDebuffs = player.debuffs.filter(d => d.name);
        if (activeDebuffs.length > 0) {
            const debuffStr = activeDebuffs.map(d => {
                if (d.remainingMinutes) {
                    return `${d.name} (${d.remainingMinutes}min)`;
                }
                return d.name;
            }).join(', ');
            lines.push(`Debuffs: ${debuffStr}`);
        }
    }

    // Wounds
    if (player.wounds?.length > 0) {
        const activeWounds = player.wounds.filter(w => w.daysRemaining > 0);
        if (activeWounds.length > 0) {
            lines.push(`Wounds: ${activeWounds.map(w => `${w.type} (${w.daysRemaining}d to heal)`).join(', ')}`);
        }
    }

    // Location
    if (player.currentLocation) {
        lines.push(`Location: ${player.currentLocation}`);
    }

    return lines.join('\n');
}

/**
 * Build world state context
 * @param {Object} world - World domain state
 * @param {Object} settings - Context settings
 * @returns {string}
 */
function buildWorldContext(world, settings) {
    if (!world) return '';

    const lines = ['## WORLD STATE'];

    // Location
    if (world.currentRegion) {
        lines.push(`Region: ${world.currentRegion}`);
    }
    if (world.currentSettlement) {
        lines.push(`Settlement: ${world.currentSettlement}`);
    }

    // Regional mood
    if (world.regionalMood) {
        const moodLine = [`Regional Mood: ${world.regionalMood.current || world.regionalMood}`];
        if (world.regionalMood.reason) {
            moodLine.push(`(${world.regionalMood.reason})`);
        }
        lines.push(moodLine.join(' '));
    }

    // Recent events
    const maxEvents = settings.maxRecentEvents || 3;
    if (world.events?.length > 0) {
        const recentEvents = world.events
            .filter(e => !e.resolved)
            .slice(0, maxEvents);

        if (recentEvents.length > 0) {
            lines.push('Recent Events:');
            for (const event of recentEvents) {
                const daysAgo = event.daysAgo !== undefined ? ` (${event.daysAgo}d ago)` : '';
                lines.push(`- ${event.summary}${daysAgo}`);
            }
        }
    }

    // Active bounties
    if (world.bounties?.length > 0) {
        const activeBounties = world.bounties
            .filter(b => b.status === 'available' || b.status === 'claimed')
            .slice(0, 3);

        if (activeBounties.length > 0) {
            lines.push(`Active Bounties: ${activeBounties.map(b => b.name).join(', ')}`);
        }
    }

    // Nearby rivals
    if (world.rivals?.length > 0) {
        const nearbyRivals = world.rivals
            .filter(r => r.currentLocation || r.lastSeen)
            .slice(0, 2);

        if (nearbyRivals.length > 0) {
            lines.push(`Rival Parties: ${nearbyRivals.map(r => {
                const loc = r.currentLocation || r.lastSeen || 'unknown';
                return `${r.name} (${loc})`;
            }).join(', ')}`);
        }
    }

    // Disease warnings
    if (world.diseases?.length > 0) {
        const activeDisease = world.diseases.find(d =>
            d.affectedRegions?.includes(world.currentRegion)
        );
        if (activeDisease) {
            lines.push(`Disease Alert: ${activeDisease.name} (${activeDisease.severity})`);
        }
    }

    return lines.join('\n');
}

/**
 * Build NPC context
 * @param {Object} npcs - NPC domain state
 * @param {Object} settings - Context settings
 * @returns {string}
 */
function buildNPCContext(npcs, settings) {
    if (!npcs?.nearbyNPCs?.length) return '';

    const maxNPCs = settings.maxNearbyNPCs || 5;
    const nearby = npcs.nearbyNPCs.slice(0, maxNPCs);

    if (nearby.length === 0) return '';

    const lines = ['## NEARBY NPCS'];

    for (const npc of nearby) {
        const parts = [npc.name];
        if (npc.relationship) parts.push(npc.relationship);
        if (npc.notes) parts.push(npc.notes);
        lines.push(`- ${parts.join(': ')}`);
    }

    // Upcoming appointments
    if (npcs.appointments?.length > 0) {
        const upcoming = npcs.appointments.filter(a => a.importance === 'high');
        if (upcoming.length > 0) {
            lines.push('');
            lines.push(`Appointments: ${upcoming.map(a => `${a.npcName} (${a.purpose})`).join(', ')}`);
        }
    }

    // Active obligations
    if (npcs.obligations?.length > 0) {
        const debts = npcs.obligations.filter(o =>
            o.type === 'debt_owed_by_player' && o.status === 'active'
        );
        if (debts.length > 0) {
            lines.push(`Debts: ${debts.map(d => `${d.description} to ${d.npcName}`).join(', ')}`);
        }
    }

    return lines.join('\n');
}

/**
 * Build economy context
 * @param {Object} economy - Economy domain state
 * @returns {string}
 */
function buildEconomyContext(economy) {
    if (!economy) return '';

    const lines = [];

    // Price alerts (significant price changes)
    if (economy.priceAlerts?.length > 0) {
        lines.push('## ECONOMIC CONDITIONS');
        for (const alert of economy.priceAlerts.slice(0, 3)) {
            lines.push(`- ${alert.item}: ${alert.change} (${alert.reason})`);
        }
    }

    // Ready commissions
    if (economy.commissions?.length > 0) {
        const ready = economy.commissions.filter(c => c.status === 'ready');
        if (ready.length > 0) {
            if (lines.length === 0) lines.push('## ECONOMIC CONDITIONS');
            lines.push(`Ready for Pickup: ${ready.map(c => c.item || c.service).join(', ')}`);
        }
    }

    // Global trends affecting prices
    if (economy.globalTrends?.length > 0) {
        const activeTrends = economy.globalTrends.slice(0, 2);
        if (activeTrends.length > 0) {
            if (lines.length === 0) lines.push('## ECONOMIC CONDITIONS');
            for (const trend of activeTrends) {
                lines.push(`- ${trend.trend}: ${trend.effect}`);
            }
        }
    }

    return lines.join('\n');
}

/**
 * Build faction context
 * @param {Object} factions - Factions domain state
 * @returns {string}
 */
function buildFactionContext(factions) {
    if (!factions) return '';

    const lines = [];

    // High tension situations
    if (factions.tensions?.length > 0 || factions.hotspots?.length > 0) {
        lines.push('## POLITICAL TENSIONS');

        // Hotspots
        if (factions.hotspots?.length > 0) {
            const critical = factions.hotspots.filter(h =>
                h.tensionLevel === 'critical' || h.tensionLevel === 'high'
            );
            for (const hotspot of critical.slice(0, 2)) {
                lines.push(`- ${hotspot.location}: ${hotspot.description}`);
            }
        }

        // Active political events
        if (factions.politicalEvents?.length > 0) {
            const ongoing = factions.politicalEvents.filter(e => e.status === 'ongoing');
            for (const event of ongoing.slice(0, 2)) {
                lines.push(`- ${event.summary}`);
            }
        }
    }

    // Player's notable standings
    if (factions.playerStanding?.length > 0) {
        const notable = factions.playerStanding.filter(s =>
            s.standing === 'hostile' || s.standing === 'hated' ||
            s.standing === 'honored' || s.standing === 'revered'
        );
        if (notable.length > 0) {
            if (lines.length === 0) lines.push('## FACTION STATUS');
            for (const standing of notable.slice(0, 3)) {
                const titleStr = standing.title ? ` (${standing.title})` : '';
                lines.push(`- ${standing.faction}: ${standing.standing}${titleStr}`);
            }
        }
    }

    return lines.join('\n');
}

/**
 * Build Vex whispers context
 * @param {Object} vex - Vex domain state
 * @returns {string}
 */
function buildVexContext(vex) {
    if (!vex || !vex.settings?.enabled) return '';

    const lines = ['## VEX STATUS'];

    if (vex.mood) {
        lines.push(`Vex Mood: ${vex.mood}`);
    }

    if (vex.interestLevel) {
        lines.push(`Interest Level: ${vex.interestLevel}`);
    }

    return lines.join('\n');
}

/**
 * Build narrative directives based on current state
 * @param {Object} state - Full state
 * @returns {string}
 */
function buildNarrativeDirectives(state) {
    const directives = ['## NARRATIVE DIRECTIVES'];

    // Health-based directives
    if (state.player?.hp) {
        const hpPercent = state.player.hp.current / state.player.hp.max;
        if (hpPercent < 0.25) {
            directives.push('- Player is critically injured: every action should feel desperate');
        } else if (hpPercent < 0.5) {
            directives.push('- Player is wounded: describe physical discomfort and limitations');
        }
    }

    // Time-based directives
    if (state.time?.hour !== undefined) {
        const hour = state.time.hour;
        if (hour >= 22 || hour <= 5) {
            directives.push('- Late night/early morning: describe darkness, quiet, limited visibility');
        } else if (hour >= 5 && hour <= 7) {
            directives.push('- Dawn: describe growing light, morning sounds, dew');
        } else if (hour >= 17 && hour <= 20) {
            directives.push('- Evening: describe fading light, long shadows, activity winding down');
        }
    }

    // Weather-based directives
    if (state.time?.weather?.current) {
        const weather = state.time.weather.current.toLowerCase();
        if (weather.includes('storm') || weather.includes('rain')) {
            directives.push('- Storm/rain active: wet conditions, difficult hearing, reduced visibility');
        } else if (weather.includes('fog')) {
            directives.push('- Fog: limited visibility, muffled sounds, eerie atmosphere');
        } else if (weather.includes('snow')) {
            directives.push('- Snow: cold, difficult terrain, muted sounds');
        }
    }

    // Moon-based directives
    if (state.time?.moons?.lunara?.phase === 'full') {
        directives.push('- Full moon: enhanced undead activity, lycanthrope danger, bright night');
    }
    if (state.time?.moons?.veil?.phase === 'new' || state.time?.moons?.veil?.visible === false) {
        directives.push('- Veil hidden: shadow magic weakened, certain creatures dormant');
    }

    // Regional mood directives
    if (state.world?.regionalMood) {
        const mood = state.world.regionalMood.current || state.world.regionalMood;
        if (mood === 'tense' || mood === 'fearful') {
            directives.push('- Region is tense: NPCs are wary, conversations guarded');
        } else if (mood === 'hostile') {
            directives.push('- Region is hostile: outsiders viewed with suspicion');
        } else if (mood === 'festive') {
            directives.push('- Region is festive: celebrations, good cheer, relaxed guards');
        }
    }

    // Always include base directives
    directives.push('- NEVER state numbers directly, EMBODY the physical/emotional experience');
    directives.push('- Use world events as background flavor and NPC conversation topics');
    directives.push('- Reference nearby NPCs naturally when appropriate');

    return directives.join('\n');
}

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Format time to 12-hour format
 * @param {number} hour - Hour (0-23)
 * @param {number} minute - Minute (0-59)
 * @returns {string}
 */
function formatTime(hour, minute) {
    const h = hour % 12 || 12;
    const m = minute.toString().padStart(2, '0');
    const ampm = hour < 12 ? 'AM' : 'PM';
    return `${h}:${m} ${ampm}`;
}

/**
 * Get time of day descriptor
 * @param {number} hour - Hour (0-23)
 * @returns {string}
 */
function getTimeOfDay(hour) {
    if (hour >= 5 && hour < 8) return 'Early Morning';
    if (hour >= 8 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 14) return 'Midday';
    if (hour >= 14 && hour < 17) return 'Afternoon';
    if (hour >= 17 && hour < 20) return 'Evening';
    if (hour >= 20 && hour < 23) return 'Night';
    return 'Late Night';
}

/**
 * Format moon phase for display
 * @param {string} phase - Moon phase identifier
 * @returns {string}
 */
function formatMoonPhase(phase) {
    const phases = {
        'new': 'New',
        'waxing_crescent': 'Waxing Crescent',
        'first_quarter': 'First Quarter',
        'waxing_gibbous': 'Waxing Gibbous',
        'full': 'Full',
        'waning_gibbous': 'Waning Gibbous',
        'last_quarter': 'Last Quarter',
        'waning_crescent': 'Waning Crescent'
    };
    return phases[phase] || phase;
}

/**
 * Get context injection settings
 * @returns {Object}
 */
export function getDefaultSettings() {
    return { ...DEFAULT_SETTINGS };
}

export default {
    buildFullContext,
    buildDomainContext,
    getDefaultSettings
};
