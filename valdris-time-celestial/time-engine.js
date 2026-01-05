/**
 * VTC Time Engine - Intelligent scene-based time tracking
 *
 * This module handles:
 * - Parsing AI responses for temporal indicators
 * - Estimating scene duration based on context
 * - Advancing time with cascading updates
 * - Valdris calendar system
 */

import { ValdrisEventBus, getDomainState, setDomainState } from '../valdris-core/index.js';

const LOG_PREFIX = '[VTC:TimeEngine]';
const DOMAIN = 'time';
const EXTENSION_ID = 'vtc';

// ============================================================================
// Valdris Calendar System
// ============================================================================

/**
 * Valdris uses a 12-month calendar with varying month lengths
 * Year system: AV (After Valdris) - the world's founding
 */
const MONTHS = [
    { name: 'Frostmorn', days: 30, season: 'winter' },
    { name: 'Deepsnow', days: 28, season: 'winter' },
    { name: 'Thawbreak', days: 31, season: 'spring' },
    { name: 'Rainbloom', days: 30, season: 'spring' },
    { name: 'Sunrise', days: 31, season: 'spring' },
    { name: 'Highsun', days: 30, season: 'summer' },
    { name: 'Goldpeak', days: 31, season: 'summer' },
    { name: 'Harvest', days: 31, season: 'autumn' },
    { name: 'Leaffall', days: 30, season: 'autumn' },
    { name: 'Dimlight', days: 30, season: 'autumn' },
    { name: 'Darkeve', days: 30, season: 'winter' },
    { name: 'Stillnight', days: 29, season: 'winter' }
];

const DAYS_OF_WEEK = [
    'Firstday',
    'Seconday',
    'Thirdsday',
    'Fourthday',
    'Fifthday',
    'Sixthday',
    'Restday'
];

// ============================================================================
// Duration Estimation Patterns
// ============================================================================

/**
 * Patterns for parsing AI responses to estimate time passage
 * Priority: explicit > scene-based > default
 */
const DURATION_PATTERNS = [
    // Explicit time jumps (highest priority)
    { pattern: /(\d+)\s*hours?\s*(?:later|pass|have passed)/i, type: 'hours', extract: 1, priority: 10 },
    { pattern: /(\d+)\s*minutes?\s*(?:later|pass|have passed)/i, type: 'minutes', extract: 1, priority: 10 },
    { pattern: /(\d+)\s*days?\s*(?:later|pass|have passed)/i, type: 'days', extract: 1, priority: 10 },
    { pattern: /half\s*(?:an?\s*)?hour\s*(?:later|pass)/i, type: 'fixed', minutes: 30, priority: 10 },
    { pattern: /(?:a|an|one)\s*hour\s*(?:later|pass)/i, type: 'fixed', minutes: 60, priority: 10 },
    { pattern: /(?:a|an|one)\s*day\s*(?:later|pass)/i, type: 'fixed', minutes: 1440, priority: 10 },
    { pattern: /several\s*hours?\s*(?:later|pass)/i, type: 'fixed', minutes: 180, priority: 9 },
    { pattern: /(?:a\s*)?few\s*hours?\s*(?:later|pass)/i, type: 'fixed', minutes: 120, priority: 9 },
    { pattern: /(?:a\s*)?few\s*minutes?\s*(?:later|pass)/i, type: 'fixed', minutes: 10, priority: 9 },

    // Time period jumps
    { pattern: /the\s*next\s*(morning|day)/i, type: 'skipTo', target: 'morning', priority: 8 },
    { pattern: /the\s*next\s*evening/i, type: 'skipTo', target: 'evening', priority: 8 },
    { pattern: /the\s*next\s*night/i, type: 'skipTo', target: 'night', priority: 8 },
    { pattern: /the\s*following\s*(morning|day)/i, type: 'skipTo', target: 'morning', priority: 8 },
    { pattern: /dawn\s*breaks|sunrise|morning\s*comes|wake\s*(?:up|to)/i, type: 'skipTo', target: 'morning', priority: 7 },
    { pattern: /night\s*falls|sunset|dusk\s*(?:falls|comes)|evening\s*comes/i, type: 'skipTo', target: 'evening', priority: 7 },
    { pattern: /midnight|dead\s*of\s*night/i, type: 'skipTo', target: 'midnight', priority: 7 },
    { pattern: /noon|midday|middle\s*of\s*the\s*day/i, type: 'skipTo', target: 'noon', priority: 7 },

    // Scene type detection for estimation
    { pattern: /(?:fierce|brutal|long|extended)\s*(?:combat|fight|battle)/i, type: 'scene', estimate: 15, priority: 5 },
    { pattern: /combat|fight|battle|attack|clash|skirmish/i, type: 'scene', estimate: 5, priority: 4 },
    { pattern: /long\s*rest|sleep|camp\s*for\s*the\s*night|retire\s*for\s*the\s*(?:night|evening)/i, type: 'scene', estimate: 480, priority: 6 },
    { pattern: /short\s*rest|breather|catch\s*(?:your|their)?\s*breath|take\s*a\s*break/i, type: 'scene', estimate: 60, priority: 5 },
    { pattern: /travel|journey|walk|ride|march|trek|make\s*(?:your|their)\s*way/i, type: 'scene', estimate: 120, priority: 4 },
    { pattern: /long\s*(?:conversation|discussion|talk)/i, type: 'scene', estimate: 45, priority: 5 },
    { pattern: /conversation|talk|discuss|speak|chat/i, type: 'scene', estimate: 15, priority: 4 },
    { pattern: /meal|breakfast|lunch|dinner|supper|feast|banquet/i, type: 'scene', estimate: 45, priority: 4 },
    { pattern: /quick\s*(?:meal|bite|snack)/i, type: 'scene', estimate: 15, priority: 5 },
    { pattern: /shop|browse|merchant|store|market|bazaar|trade/i, type: 'scene', estimate: 30, priority: 4 },
    { pattern: /search|examine|investigate|look\s*around|explore|scout/i, type: 'scene', estimate: 20, priority: 4 },
    { pattern: /train|practice|spar|exercise|drill/i, type: 'scene', estimate: 60, priority: 4 },
    { pattern: /study|read|research|learn/i, type: 'scene', estimate: 60, priority: 4 },
    { pattern: /craft|forge|brew|create|make/i, type: 'scene', estimate: 120, priority: 4 },
    { pattern: /meditate|pray|ritual|ceremony/i, type: 'scene', estimate: 30, priority: 4 },
    { pattern: /wait|waiting|bide\s*(?:your|their)\s*time/i, type: 'scene', estimate: 30, priority: 3 },
];

// ============================================================================
// Default Time State
// ============================================================================

/**
 * Create default time state for a new game
 * @returns {Object}
 */
export function createDefaultTimeState() {
    return {
        // Current date/time
        year: 2847,
        month: 7, // 1-indexed (Harvest)
        day: 14,
        hour: 18,
        minute: 0,

        // Derived (calculated on load)
        monthName: 'Harvest',
        season: 'autumn',
        dayOfWeek: 'Thirdsday',

        // Moon phases
        moons: {
            lunara: {
                phase: 'waxing_gibbous',
                dayInCycle: 11, // 28-day cycle
                daysUntilFull: 3,
                daysUntilNew: 17,
                effects: []
            },
            veil: {
                phase: 'new',
                dayInCycle: 0, // 35-day cycle
                visible: false,
                daysUntilFull: 17,
                daysUntilNew: 0,
                effects: []
            }
        },

        // Weather (set by weather-generator)
        weather: {
            current: 'clear',
            temperature: 'cool',
            wind: 'light breeze',
            precipitation: 'none',
            visibility: 'good',
            forecast: []
        },

        // Celestial events
        celestialEvents: [],
        celestialEffects: [],

        // Sun times (vary by season and location)
        sun: {
            sunrise: '6:30',
            sunset: '18:30',
            dayLength: 12
        },

        // Festivals and holidays
        upcomingFestivals: [],

        // Settings
        settings: {
            autoAdvance: true,
            confirmLargeJumps: true,
            largeJumpThreshold: 240, // minutes - confirm if > 4 hours
            showHeader: true,
            parseAIResponses: true
        },

        // Last update tracking
        lastUpdate: Date.now()
    };
}

// ============================================================================
// Time Parsing
// ============================================================================

/**
 * Parse AI response and estimate time elapsed
 * @param {string} responseText - AI response text
 * @returns {Object} { minutes, confidence, detectedTypes, skipTo }
 */
export function estimateSceneDuration(responseText) {
    if (!responseText) {
        return { minutes: 0, confidence: 'none', detectedTypes: [] };
    }

    let result = {
        minutes: 0,
        confidence: 'low',
        detectedTypes: [],
        skipTo: null
    };

    let highestPriority = 0;

    for (const p of DURATION_PATTERNS) {
        const match = responseText.match(p.pattern);
        if (!match) continue;

        // Only use higher or equal priority matches
        if (p.priority < highestPriority) continue;

        if (p.type === 'hours') {
            const hours = parseInt(match[p.extract]);
            if (!isNaN(hours)) {
                result.minutes = hours * 60;
                result.confidence = 'high';
                result.detectedTypes = [{ pattern: p.pattern.source, value: `${hours} hours` }];
                highestPriority = p.priority;
            }
        } else if (p.type === 'minutes') {
            const mins = parseInt(match[p.extract]);
            if (!isNaN(mins)) {
                result.minutes = mins;
                result.confidence = 'high';
                result.detectedTypes = [{ pattern: p.pattern.source, value: `${mins} minutes` }];
                highestPriority = p.priority;
            }
        } else if (p.type === 'days') {
            const days = parseInt(match[p.extract]);
            if (!isNaN(days)) {
                result.minutes = days * 1440;
                result.confidence = 'high';
                result.detectedTypes = [{ pattern: p.pattern.source, value: `${days} days` }];
                highestPriority = p.priority;
            }
        } else if (p.type === 'fixed') {
            result.minutes = p.minutes;
            result.confidence = 'high';
            result.detectedTypes = [{ pattern: p.pattern.source, value: `${p.minutes} minutes (fixed)` }];
            highestPriority = p.priority;
        } else if (p.type === 'skipTo') {
            result.skipTo = p.target;
            result.confidence = 'high';
            result.detectedTypes = [{ pattern: p.pattern.source, value: `skip to ${p.target}` }];
            highestPriority = p.priority;
        } else if (p.type === 'scene' && p.priority >= highestPriority) {
            // Accumulate scene types but don't override explicit time
            result.detectedTypes.push({ pattern: p.pattern.source, estimate: p.estimate });
            if (result.confidence !== 'high') {
                result.confidence = 'medium';
            }
        }
    }

    // If no explicit time found but we have scene estimates, use the longest
    if (result.confidence !== 'high' && result.detectedTypes.length > 0 && !result.skipTo) {
        const sceneEstimates = result.detectedTypes.filter(d => d.estimate);
        if (sceneEstimates.length > 0) {
            result.minutes = Math.max(...sceneEstimates.map(d => d.estimate));
        }
    }

    // Default minimum if nothing detected
    if (result.minutes === 0 && !result.skipTo && result.confidence === 'low') {
        result.minutes = 3; // Default 3 minutes for dialogue/brief scenes
    }

    return result;
}

/**
 * Calculate minutes to skip to a target time period
 * @param {Object} currentTime - Current time state
 * @param {string} target - Target period (morning, evening, night, noon, midnight)
 * @returns {number} Minutes to skip
 */
export function calculateSkipToMinutes(currentTime, target) {
    const currentHour = currentTime.hour;
    const currentMinute = currentTime.minute;
    let targetHour;

    switch (target) {
        case 'morning':
            targetHour = 7;
            break;
        case 'noon':
            targetHour = 12;
            break;
        case 'evening':
            targetHour = 18;
            break;
        case 'night':
            targetHour = 21;
            break;
        case 'midnight':
            targetHour = 0;
            break;
        default:
            return 0;
    }

    let hoursToSkip = targetHour - currentHour;
    if (hoursToSkip <= 0) {
        // Need to go to next day
        hoursToSkip += 24;
    }

    return hoursToSkip * 60 - currentMinute;
}

// ============================================================================
// Time Advancement
// ============================================================================

/**
 * Advance time by a specified number of minutes
 * @param {number} minutes - Minutes to advance
 * @param {Object} options - Options
 * @param {boolean} options.silent - Don't emit events
 * @returns {Promise<Object>} Updated time state
 */
export async function advanceTime(minutes, options = {}) {
    if (minutes <= 0) return getDomainState(DOMAIN);

    const state = getDomainState(DOMAIN) || createDefaultTimeState();
    const oldTime = { ...state, moons: { ...state.moons } };

    // Track what changes
    let dayAdvanced = false;
    let monthAdvanced = false;
    let yearAdvanced = false;

    // Add minutes
    state.minute += minutes;

    // Handle minute overflow
    while (state.minute >= 60) {
        state.minute -= 60;
        state.hour++;
    }

    // Handle hour overflow
    while (state.hour >= 24) {
        state.hour -= 24;
        state.day++;
        dayAdvanced = true;
    }

    // Handle day overflow (month boundary)
    const monthLength = getMonthLength(state.month, state.year);
    while (state.day > monthLength) {
        state.day -= monthLength;
        state.month++;
        monthAdvanced = true;

        if (state.month > 12) {
            state.month = 1;
            state.year++;
            yearAdvanced = true;
        }
    }

    // Update derived values
    updateDerivedValues(state);

    // Update moon phases if day changed
    if (dayAdvanced) {
        updateMoonPhases(state);
    }

    // Save state
    state.lastUpdate = Date.now();
    await setDomainState(DOMAIN, state, EXTENSION_ID);

    // Emit events
    if (!options.silent) {
        ValdrisEventBus.emit('timeAdvanced', {
            oldTime,
            newTime: state,
            minutesElapsed: minutes
        });

        if (dayAdvanced) {
            ValdrisEventBus.emit('newDay', { date: state });
        }

        if (monthAdvanced) {
            ValdrisEventBus.emit('newMonth', { date: state });
        }

        if (yearAdvanced) {
            ValdrisEventBus.emit('newYear', { date: state });
        }
    }

    return state;
}

/**
 * Set time to a specific value
 * @param {Object} newTime - New time values (partial update)
 * @returns {Promise<Object>}
 */
export async function setTime(newTime) {
    const state = getDomainState(DOMAIN) || createDefaultTimeState();
    const oldTime = { ...state };

    // Apply new values
    if (newTime.year !== undefined) state.year = newTime.year;
    if (newTime.month !== undefined) state.month = newTime.month;
    if (newTime.day !== undefined) state.day = newTime.day;
    if (newTime.hour !== undefined) state.hour = newTime.hour;
    if (newTime.minute !== undefined) state.minute = newTime.minute;

    // Validate
    state.month = Math.max(1, Math.min(12, state.month));
    state.day = Math.max(1, Math.min(getMonthLength(state.month, state.year), state.day));
    state.hour = Math.max(0, Math.min(23, state.hour));
    state.minute = Math.max(0, Math.min(59, state.minute));

    // Update derived values
    updateDerivedValues(state);
    updateMoonPhases(state);

    state.lastUpdate = Date.now();
    await setDomainState(DOMAIN, state, EXTENSION_ID);

    ValdrisEventBus.emit('timeSet', { oldTime, newTime: state });

    return state;
}

// ============================================================================
// Calendar Helpers
// ============================================================================

/**
 * Get the number of days in a month
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @returns {number}
 */
export function getMonthLength(month, year) {
    const monthData = MONTHS[month - 1];
    if (!monthData) return 30;

    // Leap year logic: Stillnight (month 12) has 30 days every 4th year
    if (month === 12 && year % 4 === 0) {
        return 30;
    }

    return monthData.days;
}

/**
 * Get month data by index
 * @param {number} month - Month (1-12)
 * @returns {Object}
 */
export function getMonthData(month) {
    return MONTHS[month - 1] || MONTHS[0];
}

/**
 * Calculate day of week
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 * @param {number} day - Day
 * @returns {string}
 */
export function calculateDayOfWeek(year, month, day) {
    // Calculate total days since epoch (year 1, month 1, day 1)
    let totalDays = 0;

    // Add days from previous years
    for (let y = 1; y < year; y++) {
        totalDays += getYearLength(y);
    }

    // Add days from previous months this year
    for (let m = 1; m < month; m++) {
        totalDays += getMonthLength(m, year);
    }

    // Add current day
    totalDays += day - 1;

    // 7-day week
    const dayIndex = totalDays % 7;
    return DAYS_OF_WEEK[dayIndex];
}

/**
 * Get total days in a year
 * @param {number} year - Year
 * @returns {number}
 */
function getYearLength(year) {
    let total = 0;
    for (let m = 1; m <= 12; m++) {
        total += getMonthLength(m, year);
    }
    return total;
}

/**
 * Update derived values in time state
 * @param {Object} state - Time state to update
 */
function updateDerivedValues(state) {
    const monthData = getMonthData(state.month);
    state.monthName = monthData.name;
    state.season = monthData.season;
    state.dayOfWeek = calculateDayOfWeek(state.year, state.month, state.day);

    // Update sun times based on season
    updateSunTimes(state);
}

/**
 * Update sunrise/sunset based on season
 * @param {Object} state - Time state
 */
function updateSunTimes(state) {
    // Simplified sun times by season
    const sunTimes = {
        winter: { sunrise: '7:30', sunset: '17:00', dayLength: 9.5 },
        spring: { sunrise: '6:00', sunset: '19:00', dayLength: 13 },
        summer: { sunrise: '5:00', sunset: '21:00', dayLength: 16 },
        autumn: { sunrise: '6:30', sunset: '18:30', dayLength: 12 }
    };

    const times = sunTimes[state.season] || sunTimes.autumn;
    state.sun = { ...times };
}

// ============================================================================
// Moon Phase System
// ============================================================================

const MOON_PHASES = [
    'new',
    'waxing_crescent',
    'first_quarter',
    'waxing_gibbous',
    'full',
    'waning_gibbous',
    'last_quarter',
    'waning_crescent'
];

const LUNARA_CYCLE = 28; // days
const VEIL_CYCLE = 35; // days

/**
 * Update moon phases based on current date
 * @param {Object} state - Time state
 */
function updateMoonPhases(state) {
    // Lunara (main moon)
    state.moons.lunara.dayInCycle = (state.moons.lunara.dayInCycle + 1) % LUNARA_CYCLE;
    const lunaraPhaseIndex = Math.floor(state.moons.lunara.dayInCycle / (LUNARA_CYCLE / 8));
    state.moons.lunara.phase = MOON_PHASES[lunaraPhaseIndex];
    state.moons.lunara.daysUntilFull = (Math.floor(LUNARA_CYCLE / 2) - state.moons.lunara.dayInCycle + LUNARA_CYCLE) % LUNARA_CYCLE;
    state.moons.lunara.daysUntilNew = (LUNARA_CYCLE - state.moons.lunara.dayInCycle) % LUNARA_CYCLE || LUNARA_CYCLE;
    state.moons.lunara.effects = getMoonEffects('lunara', state.moons.lunara.phase);

    // Veil (second moon - mysterious, less visible)
    state.moons.veil.dayInCycle = (state.moons.veil.dayInCycle + 1) % VEIL_CYCLE;
    const veilPhaseIndex = Math.floor(state.moons.veil.dayInCycle / (VEIL_CYCLE / 8));
    state.moons.veil.phase = MOON_PHASES[veilPhaseIndex];
    state.moons.veil.visible = state.moons.veil.phase !== 'new';
    state.moons.veil.daysUntilFull = (Math.floor(VEIL_CYCLE / 2) - state.moons.veil.dayInCycle + VEIL_CYCLE) % VEIL_CYCLE;
    state.moons.veil.daysUntilNew = (VEIL_CYCLE - state.moons.veil.dayInCycle) % VEIL_CYCLE || VEIL_CYCLE;
    state.moons.veil.effects = getMoonEffects('veil', state.moons.veil.phase);

    // Check for special celestial events
    updateCelestialEffects(state);

    // Emit moon phase change if relevant
    const oldLunaraPhase = state.moons.lunara._previousPhase;
    const oldVeilPhase = state.moons.veil._previousPhase;

    if (oldLunaraPhase && oldLunaraPhase !== state.moons.lunara.phase) {
        ValdrisEventBus.emit('moonPhaseChanged', {
            moon: 'lunara',
            oldPhase: oldLunaraPhase,
            newPhase: state.moons.lunara.phase
        });
    }

    if (oldVeilPhase && oldVeilPhase !== state.moons.veil.phase) {
        ValdrisEventBus.emit('moonPhaseChanged', {
            moon: 'veil',
            oldPhase: oldVeilPhase,
            newPhase: state.moons.veil.phase
        });
    }

    state.moons.lunara._previousPhase = state.moons.lunara.phase;
    state.moons.veil._previousPhase = state.moons.veil.phase;
}

/**
 * Get effects for a moon phase
 * @param {string} moon - Moon name
 * @param {string} phase - Phase name
 * @returns {Array}
 */
function getMoonEffects(moon, phase) {
    const effects = [];

    if (moon === 'lunara') {
        switch (phase) {
            case 'full':
                effects.push('Undead +20% active');
                effects.push('Lycanthrope transformation');
                effects.push('Tides high');
                effects.push('Moonlight bright');
                break;
            case 'new':
                effects.push('Undead -10% active');
                effects.push('Dark vision impaired');
                effects.push('Stealth enhanced');
                break;
            case 'waxing_gibbous':
            case 'waning_gibbous':
                effects.push('Undead +10% active');
                break;
        }
    } else if (moon === 'veil') {
        switch (phase) {
            case 'full':
                effects.push('Shadow magic enhanced');
                effects.push('Veil between worlds thin');
                effects.push('Spirit activity high');
                break;
            case 'new':
                effects.push('Shadow magic weakened');
                effects.push('Spirits dormant');
                break;
        }
    }

    return effects;
}

/**
 * Update celestial effects based on moon alignment
 * @param {Object} state - Time state
 */
function updateCelestialEffects(state) {
    const effects = [];

    // Dual full moons (rare)
    if (state.moons.lunara.phase === 'full' && state.moons.veil.phase === 'full') {
        effects.push('Convergence Night - All magical effects doubled');
    }

    // Eclipse (Veil passes in front of Lunara)
    if (state.moons.lunara.phase === 'full' && state.moons.veil.dayInCycle === Math.floor(VEIL_CYCLE / 2)) {
        effects.push("Veil's Eclipse - Undead surge, shadow magic peaks");
    }

    // Both new (darkest night)
    if (state.moons.lunara.phase === 'new' && state.moons.veil.phase === 'new') {
        effects.push('Void Night - Near total darkness, aberrations stir');
    }

    state.celestialEffects = effects;
}

// ============================================================================
// Time Display Helpers
// ============================================================================

/**
 * Format time to 12-hour display
 * @param {number} hour - Hour (0-23)
 * @param {number} minute - Minute (0-59)
 * @returns {string}
 */
export function formatTime(hour, minute) {
    const h = hour % 12 || 12;
    const m = minute.toString().padStart(2, '0');
    const ampm = hour < 12 ? 'AM' : 'PM';
    return `${h}:${m} ${ampm}`;
}

/**
 * Format time to 24-hour display
 * @param {number} hour - Hour (0-23)
 * @param {number} minute - Minute (0-59)
 * @returns {string}
 */
export function formatTime24(hour, minute) {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

/**
 * Get time of day descriptor
 * @param {number} hour - Hour (0-23)
 * @returns {string}
 */
export function getTimeOfDay(hour) {
    if (hour >= 5 && hour < 8) return 'Early Morning';
    if (hour >= 8 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 14) return 'Midday';
    if (hour >= 14 && hour < 17) return 'Afternoon';
    if (hour >= 17 && hour < 20) return 'Evening';
    if (hour >= 20 && hour < 23) return 'Night';
    return 'Late Night';
}

/**
 * Format full date string
 * @param {Object} state - Time state
 * @returns {string}
 */
export function formatFullDate(state) {
    return `${state.dayOfWeek}, ${state.day} of ${state.monthName}, ${state.year} AV`;
}

/**
 * Format short date string
 * @param {Object} state - Time state
 * @returns {string}
 */
export function formatShortDate(state) {
    return `${state.day} ${state.monthName}, ${state.year}`;
}

// ============================================================================
// Exports
// ============================================================================

export default {
    createDefaultTimeState,
    estimateSceneDuration,
    calculateSkipToMinutes,
    advanceTime,
    setTime,
    getMonthLength,
    getMonthData,
    calculateDayOfWeek,
    formatTime,
    formatTime24,
    getTimeOfDay,
    formatFullDate,
    formatShortDate,
    MONTHS,
    DAYS_OF_WEEK,
    MOON_PHASES
};
