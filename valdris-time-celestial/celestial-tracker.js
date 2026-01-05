/**
 * VTC Celestial Tracker
 *
 * Tracks moon phases, celestial events, festivals, and holidays.
 * Provides visual representation and gameplay effects.
 */

import { ValdrisEventBus, getDomainState, setDomainState } from '../valdris-core/index.js';

const LOG_PREFIX = '[VTC:Celestial]';
const DOMAIN = 'time';
const EXTENSION_ID = 'vtc';

// ============================================================================
// Moon Definitions
// ============================================================================

/**
 * Lunara - The Silver Moon
 * Primary moon of Valdris, governs tides and undead activity
 */
export const LUNARA = {
    name: 'Lunara',
    title: 'The Silver Moon',
    cycle: 28, // days
    color: '#c0c0c0',
    phases: {
        new: { name: 'New Moon', icon: '🌑', lightLevel: 0 },
        waxing_crescent: { name: 'Waxing Crescent', icon: '🌒', lightLevel: 1 },
        first_quarter: { name: 'First Quarter', icon: '🌓', lightLevel: 2 },
        waxing_gibbous: { name: 'Waxing Gibbous', icon: '🌔', lightLevel: 3 },
        full: { name: 'Full Moon', icon: '🌕', lightLevel: 4 },
        waning_gibbous: { name: 'Waning Gibbous', icon: '🌖', lightLevel: 3 },
        last_quarter: { name: 'Last Quarter', icon: '🌗', lightLevel: 2 },
        waning_crescent: { name: 'Waning Crescent', icon: '🌘', lightLevel: 1 }
    },
    effects: {
        new: [
            { type: 'undead', modifier: -10, description: 'Undead -10% activity' },
            { type: 'stealth', modifier: 2, description: 'Stealth +2 in darkness' },
            { type: 'darkvision', modifier: -10, description: 'Darkvision range -10ft' }
        ],
        full: [
            { type: 'undead', modifier: 20, description: 'Undead +20% activity' },
            { type: 'lycanthrope', modifier: 100, description: 'Lycanthrope transformation forced' },
            { type: 'tides', modifier: 2, description: 'High tides' },
            { type: 'moonlight', modifier: 4, description: 'Bright moonlight (dim light outdoors)' }
        ],
        waxing_gibbous: [
            { type: 'undead', modifier: 10, description: 'Undead +10% activity' }
        ],
        waning_gibbous: [
            { type: 'undead', modifier: 10, description: 'Undead +10% activity' }
        ]
    }
};

/**
 * The Veil - The Shadow Moon
 * Mysterious second moon, associated with shadow magic and spirits
 */
export const VEIL = {
    name: 'The Veil',
    title: 'The Shadow Moon',
    cycle: 35, // days
    color: '#4a3a6a',
    phases: {
        new: { name: 'Hidden', icon: '⚫', lightLevel: 0, visible: false },
        waxing_crescent: { name: 'Emerging', icon: '🌘', lightLevel: 0.5, visible: true },
        first_quarter: { name: 'Half Revealed', icon: '🌗', lightLevel: 1, visible: true },
        waxing_gibbous: { name: 'Nearly Full', icon: '🌖', lightLevel: 1.5, visible: true },
        full: { name: 'Unveiled', icon: '🌕', lightLevel: 2, visible: true },
        waning_gibbous: { name: 'Fading', icon: '🌔', lightLevel: 1.5, visible: true },
        last_quarter: { name: 'Half Hidden', icon: '🌓', lightLevel: 1, visible: true },
        waning_crescent: { name: 'Retreating', icon: '🌒', lightLevel: 0.5, visible: true }
    },
    effects: {
        new: [
            { type: 'shadow_magic', modifier: -20, description: 'Shadow magic weakened' },
            { type: 'spirits', modifier: -50, description: 'Spirits dormant' }
        ],
        full: [
            { type: 'shadow_magic', modifier: 30, description: 'Shadow magic enhanced' },
            { type: 'spirits', modifier: 50, description: 'Spirit activity high' },
            { type: 'veil_thin', modifier: 1, description: 'Veil between worlds thin' }
        ]
    }
};

// ============================================================================
// Celestial Events
// ============================================================================

/**
 * Special celestial events that occur based on moon alignments
 */
export const CELESTIAL_EVENTS = {
    convergence: {
        name: 'Convergence Night',
        description: 'Both moons are full simultaneously',
        condition: (lunara, veil) => lunara.phase === 'full' && veil.phase === 'full',
        effects: [
            { type: 'magic', modifier: 2, description: 'All magical effects doubled' },
            { type: 'undead', modifier: 50, description: 'Undead surge' },
            { type: 'spirits', modifier: 100, description: 'Spirits roam freely' }
        ],
        rarity: 'very_rare',
        icon: '✨'
    },
    veils_eclipse: {
        name: "Veil's Eclipse",
        description: 'The Veil passes before Lunara',
        condition: (lunara, veil) => lunara.phase === 'full' && veil.dayInCycle === Math.floor(VEIL.cycle / 2),
        effects: [
            { type: 'shadow_magic', modifier: 50, description: 'Shadow magic peaks' },
            { type: 'undead', modifier: 30, description: 'Undead empowered' },
            { type: 'light_magic', modifier: -30, description: 'Light magic weakened' }
        ],
        rarity: 'rare',
        icon: '🌑'
    },
    void_night: {
        name: 'Void Night',
        description: 'Both moons are new - darkest night',
        condition: (lunara, veil) => lunara.phase === 'new' && veil.phase === 'new',
        effects: [
            { type: 'darkness', modifier: 3, description: 'Near total darkness' },
            { type: 'aberrations', modifier: 50, description: 'Aberrations stir' },
            { type: 'divination', modifier: -50, description: 'Divination blocked' }
        ],
        rarity: 'rare',
        icon: '⬛'
    },
    silver_tide: {
        name: 'Silver Tide',
        description: 'Lunara at perigee during full moon',
        condition: (lunara) => lunara.phase === 'full' && lunara.dayInCycle % 7 === 0,
        effects: [
            { type: 'tides', modifier: 4, description: 'Extreme tides' },
            { type: 'water_magic', modifier: 20, description: 'Water magic enhanced' },
            { type: 'coastal', modifier: -20, description: 'Coastal travel dangerous' }
        ],
        rarity: 'uncommon',
        icon: '🌊'
    },
    starfall: {
        name: 'Starfall',
        description: 'Meteor shower visible',
        condition: (lunara, veil, date) => date.month === 8 && date.day >= 10 && date.day <= 15,
        effects: [
            { type: 'star_metal', modifier: 100, description: 'Star metal may fall' },
            { type: 'wishes', modifier: 1, description: 'Wishes more potent' }
        ],
        rarity: 'annual',
        icon: '⭐'
    }
};

// ============================================================================
// Festivals and Holidays
// ============================================================================

/**
 * Major festivals and holidays of Valdris
 */
export const FESTIVALS = [
    {
        name: 'Frostmeet',
        month: 1,
        day: 1,
        duration: 3,
        description: 'New Year celebration, honoring the dead of winter',
        effects: ['Shops closed first day', 'Feasting and gift-giving', 'Bonfires common'],
        traditions: ['Telling tales of ancestors', 'Burning effigies of the past year']
    },
    {
        name: 'Thaw Festival',
        month: 3,
        day: 15,
        duration: 1,
        description: 'Celebration of spring arrival',
        effects: ['Markets busy', 'Flower decorations everywhere'],
        traditions: ['Planting ceremonies', 'Spring cleaning rituals']
    },
    {
        name: 'Solstice of Light',
        month: 6,
        day: 21,
        duration: 1,
        description: 'Longest day, celebration of Solarus',
        effects: ['Temples of Solarus crowded', 'Healing magic enhanced'],
        traditions: ['Dawn vigils', 'Blessing of crops']
    },
    {
        name: 'Midsummer Eve',
        month: 7,
        day: 15,
        duration: 2,
        description: 'Festival of fey and magic',
        effects: ['Fey crossings more common', 'Wild magic surges possible'],
        traditions: ['Dancing around bonfires', 'Leaving offerings for fey']
    },
    {
        name: 'Harvest Moon Festival',
        month: 8,
        day: 20,
        duration: 3,
        description: 'Celebration of the harvest',
        effects: ['Food prices drop', 'Alcohol flows freely', 'Guards more lenient'],
        traditions: ['Harvest competitions', 'Feast of plenty']
    },
    {
        name: 'Veilnight',
        month: 10,
        day: 31,
        duration: 1,
        description: 'Night when the veil between worlds is thinnest',
        effects: ['Undead more active', 'Spirits can communicate', 'Necromancy enhanced'],
        traditions: ['Wearing masks', 'Leaving food for spirits', 'Staying indoors']
    },
    {
        name: 'Darkest Eve',
        month: 12,
        day: 21,
        duration: 1,
        description: 'Shortest day, honoring Nyx',
        effects: ['Temples of Nyx crowded', 'Shadow magic enhanced'],
        traditions: ['Candlelight vigils', 'Meditation on endings']
    },
    {
        name: "Year's End",
        month: 12,
        day: 29,
        duration: 2,
        description: 'Final days of the year',
        effects: ['Reflection and preparation', 'Debts traditionally settled'],
        traditions: ['Burning regrets', 'Making resolutions']
    }
];

// ============================================================================
// Celestial Functions
// ============================================================================

/**
 * Get current moon phase data
 * @param {string} moonName - 'lunara' or 'veil'
 * @param {Object} moonState - Moon state from time state
 * @returns {Object}
 */
export function getMoonPhaseData(moonName, moonState) {
    const moonDef = moonName === 'lunara' ? LUNARA : VEIL;
    const phase = moonState.phase;
    const phaseData = moonDef.phases[phase] || moonDef.phases.new;

    return {
        moon: moonDef.name,
        title: moonDef.title,
        phase: phase,
        phaseName: phaseData.name,
        icon: phaseData.icon,
        lightLevel: phaseData.lightLevel,
        visible: phaseData.visible !== false,
        dayInCycle: moonState.dayInCycle,
        daysUntilFull: moonState.daysUntilFull,
        daysUntilNew: moonState.daysUntilNew,
        effects: moonDef.effects[phase] || [],
        color: moonDef.color
    };
}

/**
 * Check for active celestial events
 * @param {Object} timeState - Current time state
 * @returns {Array} Active celestial events
 */
export function checkCelestialEvents(timeState) {
    const activeEvents = [];
    const lunara = timeState.moons?.lunara;
    const veil = timeState.moons?.veil;
    const date = { month: timeState.month, day: timeState.day };

    if (!lunara || !veil) return activeEvents;

    for (const [key, event] of Object.entries(CELESTIAL_EVENTS)) {
        try {
            if (event.condition(lunara, veil, date)) {
                activeEvents.push({
                    id: key,
                    name: event.name,
                    description: event.description,
                    effects: event.effects,
                    rarity: event.rarity,
                    icon: event.icon
                });
            }
        } catch (e) {
            // Condition check failed, skip
        }
    }

    return activeEvents;
}

/**
 * Get upcoming festivals
 * @param {Object} timeState - Current time state
 * @param {number} daysAhead - How many days to look ahead
 * @returns {Array}
 */
export function getUpcomingFestivals(timeState, daysAhead = 30) {
    const upcoming = [];
    const currentMonth = timeState.month;
    const currentDay = timeState.day;

    for (const festival of FESTIVALS) {
        let daysUntil;

        if (festival.month === currentMonth) {
            daysUntil = festival.day - currentDay;
        } else if (festival.month > currentMonth) {
            // Later this year
            daysUntil = getDaysUntilDate(timeState, festival.month, festival.day);
        } else {
            // Next year
            daysUntil = getDaysUntilDate(timeState, festival.month, festival.day, true);
        }

        if (daysUntil >= 0 && daysUntil <= daysAhead) {
            upcoming.push({
                ...festival,
                daysUntil,
                isToday: daysUntil === 0,
                isOngoing: daysUntil < 0 && daysUntil >= -festival.duration
            });
        }
    }

    // Sort by days until
    upcoming.sort((a, b) => a.daysUntil - b.daysUntil);

    return upcoming;
}

/**
 * Check if today is a festival
 * @param {Object} timeState - Current time state
 * @returns {Object|null}
 */
export function getCurrentFestival(timeState) {
    const currentMonth = timeState.month;
    const currentDay = timeState.day;

    for (const festival of FESTIVALS) {
        if (festival.month === currentMonth) {
            if (currentDay >= festival.day && currentDay < festival.day + festival.duration) {
                return {
                    ...festival,
                    dayOfFestival: currentDay - festival.day + 1,
                    isLastDay: currentDay === festival.day + festival.duration - 1
                };
            }
        }
    }

    return null;
}

/**
 * Calculate days until a specific date
 * @param {Object} timeState - Current time state
 * @param {number} targetMonth - Target month
 * @param {number} targetDay - Target day
 * @param {boolean} nextYear - If true, calculate for next year
 * @returns {number}
 */
function getDaysUntilDate(timeState, targetMonth, targetDay, nextYear = false) {
    let days = 0;

    const startMonth = timeState.month;
    const startDay = timeState.day;
    const year = timeState.year;

    // Count remaining days in current month
    const { getMonthLength } = require('./time-engine.js');

    if (startMonth === targetMonth && !nextYear) {
        return targetDay - startDay;
    }

    // Days left in current month
    days += getMonthLength(startMonth, year) - startDay;

    // Full months between
    let m = startMonth + 1;
    let y = year;

    if (nextYear && targetMonth <= startMonth) {
        // Finish current year
        while (m <= 12) {
            days += getMonthLength(m, y);
            m++;
        }
        m = 1;
        y++;
    }

    while (m < targetMonth || (nextYear && y === year)) {
        if (m > 12) {
            m = 1;
            y++;
        }
        days += getMonthLength(m, y);
        m++;
    }

    // Days into target month
    days += targetDay;

    return days;
}

/**
 * Get visual representation of moon phase
 * @param {string} phase - Phase name
 * @param {string} moonType - 'lunara' or 'veil'
 * @returns {string} ASCII/Unicode art
 */
export function getMoonVisual(phase, moonType = 'lunara') {
    const moon = moonType === 'lunara' ? LUNARA : VEIL;
    const phaseData = moon.phases[phase];
    return phaseData?.icon || '❓';
}

/**
 * Calculate combined moonlight level
 * @param {Object} timeState - Time state
 * @returns {Object}
 */
export function getMoonlightLevel(timeState) {
    const lunara = timeState.moons?.lunara;
    const veil = timeState.moons?.veil;

    if (!lunara || !veil) {
        return { level: 0, description: 'Unknown' };
    }

    const lunaraLight = LUNARA.phases[lunara.phase]?.lightLevel || 0;
    const veilLight = VEIL.phases[veil.phase]?.lightLevel || 0;

    const combined = lunaraLight + veilLight;

    let description;
    if (combined >= 5) {
        description = 'Bright as twilight';
    } else if (combined >= 4) {
        description = 'Bright moonlight';
    } else if (combined >= 3) {
        description = 'Good moonlight';
    } else if (combined >= 2) {
        description = 'Dim moonlight';
    } else if (combined >= 1) {
        description = 'Faint moonlight';
    } else {
        description = 'Moonless darkness';
    }

    return {
        level: combined,
        lunaraContribution: lunaraLight,
        veilContribution: veilLight,
        description
    };
}

/**
 * Get all active celestial effects
 * @param {Object} timeState - Time state
 * @returns {Array}
 */
export function getAllCelestialEffects(timeState) {
    const effects = [];

    // Moon effects
    const lunara = timeState.moons?.lunara;
    const veil = timeState.moons?.veil;

    if (lunara) {
        const lunaraEffects = LUNARA.effects[lunara.phase] || [];
        effects.push(...lunaraEffects.map(e => ({ ...e, source: 'Lunara' })));
    }

    if (veil) {
        const veilEffects = VEIL.effects[veil.phase] || [];
        effects.push(...veilEffects.map(e => ({ ...e, source: 'The Veil' })));
    }

    // Celestial event effects
    const events = checkCelestialEvents(timeState);
    for (const event of events) {
        effects.push(...event.effects.map(e => ({ ...e, source: event.name })));
    }

    // Festival effects
    const festival = getCurrentFestival(timeState);
    if (festival) {
        for (const effect of festival.effects) {
            effects.push({
                type: 'festival',
                description: effect,
                source: festival.name
            });
        }
    }

    return effects;
}

/**
 * Update celestial events in time state
 * @param {Object} timeState - Time state to update
 * @returns {Promise<Object>}
 */
export async function updateCelestialState(timeState) {
    const state = getDomainState(DOMAIN);
    if (!state) return null;

    // Check for celestial events
    const events = checkCelestialEvents(state);
    state.celestialEvents = events;

    // Gather all effects
    const effects = [];
    for (const event of events) {
        effects.push(...event.effects.map(e => e.description));
    }
    state.celestialEffects = effects;

    // Update festivals
    state.upcomingFestivals = getUpcomingFestivals(state, 14);

    await setDomainState(DOMAIN, state, EXTENSION_ID);

    return state;
}

// ============================================================================
// Exports
// ============================================================================

export default {
    LUNARA,
    VEIL,
    CELESTIAL_EVENTS,
    FESTIVALS,
    getMoonPhaseData,
    checkCelestialEvents,
    getUpcomingFestivals,
    getCurrentFestival,
    getMoonVisual,
    getMoonlightLevel,
    getAllCelestialEffects,
    updateCelestialState
};
