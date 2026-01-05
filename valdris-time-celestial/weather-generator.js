/**
 * VTC Weather Generator
 *
 * Generates realistic weather patterns based on:
 * - Current season
 * - Region type
 * - Previous weather (continuity)
 * - Random variation
 * - Special events
 */

import { ValdrisEventBus, getDomainState, setDomainState } from '../valdris-core/index.js';

const LOG_PREFIX = '[VTC:Weather]';
const DOMAIN = 'time';
const EXTENSION_ID = 'vtc';

// ============================================================================
// Weather Definitions
// ============================================================================

/**
 * Weather condition types
 */
const WEATHER_CONDITIONS = {
    clear: {
        name: 'Clear',
        icon: '☀️',
        visibility: 'excellent',
        travelModifier: 1.0,
        combatModifier: 1.0,
        description: 'Clear skies with good visibility'
    },
    partly_cloudy: {
        name: 'Partly Cloudy',
        icon: '⛅',
        visibility: 'good',
        travelModifier: 1.0,
        combatModifier: 1.0,
        description: 'Scattered clouds, pleasant conditions'
    },
    cloudy: {
        name: 'Cloudy',
        icon: '☁️',
        visibility: 'good',
        travelModifier: 1.0,
        combatModifier: 1.0,
        description: 'Overcast skies'
    },
    foggy: {
        name: 'Foggy',
        icon: '🌫️',
        visibility: 'poor',
        travelModifier: 0.7,
        combatModifier: 0.9,
        description: 'Thick fog reduces visibility significantly'
    },
    misty: {
        name: 'Misty',
        icon: '🌁',
        visibility: 'moderate',
        travelModifier: 0.9,
        combatModifier: 0.95,
        description: 'Light mist hangs in the air'
    },
    light_rain: {
        name: 'Light Rain',
        icon: '🌦️',
        visibility: 'moderate',
        travelModifier: 0.9,
        combatModifier: 0.95,
        description: 'Light drizzle, slightly damp conditions'
    },
    rain: {
        name: 'Rain',
        icon: '🌧️',
        visibility: 'moderate',
        travelModifier: 0.8,
        combatModifier: 0.9,
        description: 'Steady rain, wet conditions'
    },
    heavy_rain: {
        name: 'Heavy Rain',
        icon: '⛈️',
        visibility: 'poor',
        travelModifier: 0.6,
        combatModifier: 0.8,
        description: 'Torrential downpour, difficult conditions'
    },
    thunderstorm: {
        name: 'Thunderstorm',
        icon: '⛈️',
        visibility: 'poor',
        travelModifier: 0.5,
        combatModifier: 0.7,
        description: 'Thunder, lightning, and heavy rain'
    },
    light_snow: {
        name: 'Light Snow',
        icon: '🌨️',
        visibility: 'moderate',
        travelModifier: 0.8,
        combatModifier: 0.9,
        description: 'Light snowfall, cold conditions'
    },
    snow: {
        name: 'Snow',
        icon: '❄️',
        visibility: 'moderate',
        travelModifier: 0.6,
        combatModifier: 0.8,
        description: 'Steady snowfall, accumulating'
    },
    heavy_snow: {
        name: 'Heavy Snow',
        icon: '🌨️',
        visibility: 'poor',
        travelModifier: 0.4,
        combatModifier: 0.7,
        description: 'Blizzard conditions, dangerous'
    },
    blizzard: {
        name: 'Blizzard',
        icon: '❄️',
        visibility: 'very_poor',
        travelModifier: 0.2,
        combatModifier: 0.6,
        description: 'Severe blizzard, travel extremely dangerous'
    },
    hail: {
        name: 'Hail',
        icon: '🌨️',
        visibility: 'moderate',
        travelModifier: 0.5,
        combatModifier: 0.7,
        description: 'Hailstones falling, seek shelter'
    },
    windy: {
        name: 'Windy',
        icon: '💨',
        visibility: 'good',
        travelModifier: 0.9,
        combatModifier: 0.9,
        description: 'Strong winds, ranged attacks affected'
    },
    dust_storm: {
        name: 'Dust Storm',
        icon: '🌪️',
        visibility: 'very_poor',
        travelModifier: 0.3,
        combatModifier: 0.6,
        description: 'Choking dust, near-zero visibility'
    }
};

/**
 * Temperature levels
 */
const TEMPERATURES = {
    freezing: { name: 'Freezing', min: -20, max: -5, effect: 'cold_damage' },
    cold: { name: 'Cold', min: -5, max: 5, effect: 'stamina_drain' },
    cool: { name: 'Cool', min: 5, max: 15, effect: null },
    mild: { name: 'Mild', min: 15, max: 22, effect: null },
    warm: { name: 'Warm', min: 22, max: 28, effect: null },
    hot: { name: 'Hot', min: 28, max: 35, effect: 'stamina_drain' },
    scorching: { name: 'Scorching', min: 35, max: 45, effect: 'heat_damage' }
};

/**
 * Wind levels
 */
const WIND_LEVELS = {
    calm: { name: 'Calm', speed: '0-5', rangedPenalty: 0 },
    light_breeze: { name: 'Light Breeze', speed: '5-15', rangedPenalty: 0 },
    moderate_wind: { name: 'Moderate Wind', speed: '15-25', rangedPenalty: -1 },
    strong_wind: { name: 'Strong Wind', speed: '25-40', rangedPenalty: -2 },
    gale: { name: 'Gale', speed: '40-60', rangedPenalty: -4 },
    storm_force: { name: 'Storm Force', speed: '60+', rangedPenalty: -6 }
};

// ============================================================================
// Season-based Weather Tables
// ============================================================================

/**
 * Weather probability tables by season
 * Values are cumulative percentages
 */
const WEATHER_TABLES = {
    winter: {
        conditions: [
            { condition: 'clear', chance: 15 },
            { condition: 'partly_cloudy', chance: 25 },
            { condition: 'cloudy', chance: 45 },
            { condition: 'foggy', chance: 50 },
            { condition: 'light_snow', chance: 65 },
            { condition: 'snow', chance: 80 },
            { condition: 'heavy_snow', chance: 90 },
            { condition: 'blizzard', chance: 95 },
            { condition: 'rain', chance: 100 }
        ],
        temperatures: [
            { temp: 'freezing', chance: 40 },
            { temp: 'cold', chance: 85 },
            { temp: 'cool', chance: 100 }
        ],
        wind: [
            { wind: 'calm', chance: 20 },
            { wind: 'light_breeze', chance: 50 },
            { wind: 'moderate_wind', chance: 75 },
            { wind: 'strong_wind', chance: 90 },
            { wind: 'gale', chance: 100 }
        ]
    },
    spring: {
        conditions: [
            { condition: 'clear', chance: 25 },
            { condition: 'partly_cloudy', chance: 45 },
            { condition: 'cloudy', chance: 60 },
            { condition: 'misty', chance: 70 },
            { condition: 'light_rain', chance: 85 },
            { condition: 'rain', chance: 95 },
            { condition: 'thunderstorm', chance: 100 }
        ],
        temperatures: [
            { temp: 'cold', chance: 10 },
            { temp: 'cool', chance: 40 },
            { temp: 'mild', chance: 80 },
            { temp: 'warm', chance: 100 }
        ],
        wind: [
            { wind: 'calm', chance: 25 },
            { wind: 'light_breeze', chance: 60 },
            { wind: 'moderate_wind', chance: 85 },
            { wind: 'strong_wind', chance: 100 }
        ]
    },
    summer: {
        conditions: [
            { condition: 'clear', chance: 45 },
            { condition: 'partly_cloudy', chance: 65 },
            { condition: 'cloudy', chance: 75 },
            { condition: 'light_rain', chance: 85 },
            { condition: 'thunderstorm', chance: 95 },
            { condition: 'heavy_rain', chance: 100 }
        ],
        temperatures: [
            { temp: 'mild', chance: 10 },
            { temp: 'warm', chance: 50 },
            { temp: 'hot', chance: 85 },
            { temp: 'scorching', chance: 100 }
        ],
        wind: [
            { wind: 'calm', chance: 35 },
            { wind: 'light_breeze', chance: 70 },
            { wind: 'moderate_wind', chance: 90 },
            { wind: 'strong_wind', chance: 100 }
        ]
    },
    autumn: {
        conditions: [
            { condition: 'clear', chance: 25 },
            { condition: 'partly_cloudy', chance: 45 },
            { condition: 'cloudy', chance: 65 },
            { condition: 'foggy', chance: 75 },
            { condition: 'misty', chance: 82 },
            { condition: 'light_rain', chance: 92 },
            { condition: 'rain', chance: 100 }
        ],
        temperatures: [
            { temp: 'cold', chance: 15 },
            { temp: 'cool', chance: 55 },
            { temp: 'mild', chance: 85 },
            { temp: 'warm', chance: 100 }
        ],
        wind: [
            { wind: 'calm', chance: 20 },
            { wind: 'light_breeze', chance: 50 },
            { wind: 'moderate_wind', chance: 80 },
            { wind: 'strong_wind', chance: 95 },
            { wind: 'gale', chance: 100 }
        ]
    }
};

// ============================================================================
// Region Modifiers
// ============================================================================

/**
 * Region types affect weather generation
 */
const REGION_MODIFIERS = {
    coastal: {
        conditions: { foggy: 1.5, misty: 1.3, rain: 1.2 },
        temperatures: { hot: 0.8, cold: 0.8 },
        wind: { moderate_wind: 1.3, strong_wind: 1.5 }
    },
    mountain: {
        conditions: { snow: 1.5, heavy_snow: 1.5, clear: 1.2 },
        temperatures: { freezing: 1.5, cold: 1.3, hot: 0.5 },
        wind: { strong_wind: 1.5, gale: 1.5 }
    },
    desert: {
        conditions: { clear: 1.5, dust_storm: 2.0, rain: 0.3 },
        temperatures: { scorching: 1.5, hot: 1.3, freezing: 0.5 },
        wind: { calm: 0.7, strong_wind: 1.2 }
    },
    forest: {
        conditions: { foggy: 1.2, misty: 1.3, rain: 1.1 },
        temperatures: { hot: 0.9, scorching: 0.7 },
        wind: { strong_wind: 0.7, gale: 0.5 }
    },
    swamp: {
        conditions: { foggy: 2.0, misty: 1.5, rain: 1.3, clear: 0.6 },
        temperatures: { hot: 1.2 },
        wind: { calm: 1.3, strong_wind: 0.5 }
    },
    plains: {
        conditions: { clear: 1.1, thunderstorm: 1.2 },
        temperatures: {},
        wind: { strong_wind: 1.2 }
    },
    tundra: {
        conditions: { snow: 1.5, blizzard: 2.0, clear: 0.7 },
        temperatures: { freezing: 2.0, cold: 1.5, warm: 0.2, hot: 0 },
        wind: { gale: 1.5 }
    },
    default: {
        conditions: {},
        temperatures: {},
        wind: {}
    }
};

// ============================================================================
// Weather Generation
// ============================================================================

/**
 * Generate weather for a new day
 * @param {Object} timeState - Current time state
 * @param {string} regionType - Type of region (coastal, mountain, etc.)
 * @returns {Object} Weather state
 */
export function generateWeather(timeState, regionType = 'default') {
    const season = timeState.season || 'autumn';
    const table = WEATHER_TABLES[season] || WEATHER_TABLES.autumn;
    const regionMod = REGION_MODIFIERS[regionType] || REGION_MODIFIERS.default;
    const previousWeather = timeState.weather || {};

    // Generate base condition
    const condition = rollFromTable(table.conditions, 'condition', regionMod.conditions, previousWeather.current);

    // Generate temperature
    const temperature = rollFromTable(table.temperatures, 'temp', regionMod.temperatures);

    // Generate wind
    const wind = rollFromTable(table.wind, 'wind', regionMod.wind);

    // Get condition details
    const conditionData = WEATHER_CONDITIONS[condition] || WEATHER_CONDITIONS.clear;
    const tempData = TEMPERATURES[temperature] || TEMPERATURES.mild;
    const windData = WIND_LEVELS[wind] || WIND_LEVELS.light_breeze;

    // Determine precipitation
    const precipitation = getPrecipitation(condition);

    // Build weather object
    const weather = {
        current: condition,
        currentName: conditionData.name,
        icon: conditionData.icon,
        temperature: temperature,
        temperatureName: tempData.name,
        wind: wind,
        windName: windData.name,
        precipitation: precipitation,
        visibility: conditionData.visibility,
        description: conditionData.description,
        effects: getWeatherEffects(condition, temperature, wind),
        modifiers: {
            travel: conditionData.travelModifier,
            combat: conditionData.combatModifier,
            ranged: windData.rangedPenalty
        },
        forecast: generateForecast(season, regionType, 3)
    };

    return weather;
}

/**
 * Roll from a weighted table with modifiers
 * @param {Array} table - Table entries
 * @param {string} key - Key to extract
 * @param {Object} modifiers - Multipliers for specific values
 * @param {string} previous - Previous value for continuity
 * @returns {string}
 */
function rollFromTable(table, key, modifiers = {}, previous = null) {
    // Apply modifiers to create adjusted table
    let adjustedTable = table.map(entry => {
        const mod = modifiers[entry[key]] || 1;
        return { ...entry, adjustedChance: entry.chance * mod };
    });

    // Normalize chances
    const maxChance = Math.max(...adjustedTable.map(e => e.adjustedChance));
    adjustedTable = adjustedTable.map(e => ({
        ...e,
        normalizedChance: (e.adjustedChance / maxChance) * 100
    }));

    // Sort by normalized chance
    adjustedTable.sort((a, b) => a.normalizedChance - b.normalizedChance);

    // Recalculate cumulative
    let cumulative = 0;
    adjustedTable = adjustedTable.map(e => {
        const prevCumulative = cumulative;
        cumulative = e.normalizedChance;
        return { ...e, min: prevCumulative, max: e.normalizedChance };
    });

    // Add continuity bonus (60% chance to stay similar if previous exists)
    if (previous && Math.random() < 0.4) {
        const similarConditions = getSimilarConditions(previous);
        if (similarConditions.length > 0) {
            const pick = similarConditions[Math.floor(Math.random() * similarConditions.length)];
            if (adjustedTable.some(e => e[key] === pick)) {
                return pick;
            }
        }
    }

    // Roll
    const roll = Math.random() * 100;
    for (const entry of adjustedTable) {
        if (roll <= entry.max) {
            return entry[key];
        }
    }

    // Fallback
    return adjustedTable[adjustedTable.length - 1][key];
}

/**
 * Get similar conditions for continuity
 * @param {string} condition - Current condition
 * @returns {Array}
 */
function getSimilarConditions(condition) {
    const groups = {
        clear: ['clear', 'partly_cloudy'],
        cloudy: ['partly_cloudy', 'cloudy', 'misty'],
        rainy: ['light_rain', 'rain', 'heavy_rain', 'thunderstorm'],
        snowy: ['light_snow', 'snow', 'heavy_snow', 'blizzard'],
        foggy: ['foggy', 'misty', 'cloudy']
    };

    for (const [, members] of Object.entries(groups)) {
        if (members.includes(condition)) {
            return members;
        }
    }

    return [condition];
}

/**
 * Determine precipitation type
 * @param {string} condition - Weather condition
 * @returns {string}
 */
function getPrecipitation(condition) {
    const precipMap = {
        light_rain: 'light',
        rain: 'moderate',
        heavy_rain: 'heavy',
        thunderstorm: 'heavy',
        light_snow: 'light',
        snow: 'moderate',
        heavy_snow: 'heavy',
        blizzard: 'severe',
        hail: 'hail'
    };

    return precipMap[condition] || 'none';
}

/**
 * Get weather effects for gameplay
 * @param {string} condition - Weather condition
 * @param {string} temperature - Temperature level
 * @param {string} wind - Wind level
 * @returns {Array}
 */
function getWeatherEffects(condition, temperature, wind) {
    const effects = [];
    const conditionData = WEATHER_CONDITIONS[condition];
    const tempData = TEMPERATURES[temperature];
    const windData = WIND_LEVELS[wind];

    // Visibility effects
    if (conditionData?.visibility === 'poor') {
        effects.push('Perception checks at disadvantage');
    } else if (conditionData?.visibility === 'very_poor') {
        effects.push('Heavily obscured beyond 30 feet');
    }

    // Temperature effects
    if (tempData?.effect === 'cold_damage') {
        effects.push('Cold damage without protection');
    } else if (tempData?.effect === 'heat_damage') {
        effects.push('Heat exhaustion risk');
    } else if (tempData?.effect === 'stamina_drain') {
        effects.push('Stamina drains faster');
    }

    // Wind effects
    if (windData?.rangedPenalty < -2) {
        effects.push(`Ranged attacks: ${windData.rangedPenalty} penalty`);
    }

    // Specific condition effects
    switch (condition) {
        case 'thunderstorm':
            effects.push('Lightning strike risk');
            effects.push('Loud thunder masks sounds');
            break;
        case 'blizzard':
            effects.push('Getting lost is likely');
            effects.push('Frostbite risk');
            break;
        case 'dust_storm':
            effects.push('Breathing difficulty');
            effects.push('Equipment damage risk');
            break;
    }

    return effects;
}

/**
 * Generate weather forecast
 * @param {string} season - Current season
 * @param {string} regionType - Region type
 * @param {number} days - Days to forecast
 * @returns {Array}
 */
function generateForecast(season, regionType, days) {
    const forecast = [];
    const table = WEATHER_TABLES[season];
    const regionMod = REGION_MODIFIERS[regionType] || REGION_MODIFIERS.default;

    let previousCondition = null;

    for (let i = 1; i <= days; i++) {
        const condition = rollFromTable(table.conditions, 'condition', regionMod.conditions, previousCondition);
        const temp = rollFromTable(table.temperatures, 'temp', regionMod.temperatures);

        const conditionData = WEATHER_CONDITIONS[condition];
        const tempData = TEMPERATURES[temp];

        forecast.push({
            day: i,
            condition: condition,
            conditionName: conditionData?.name || condition,
            icon: conditionData?.icon || '❓',
            temperature: temp,
            temperatureName: tempData?.name || temp
        });

        previousCondition = condition;
    }

    return forecast;
}

// ============================================================================
// Weather Updates
// ============================================================================

/**
 * Update weather state (called on new day or significant time jump)
 * @param {Object} timeState - Time state
 * @param {string} regionType - Region type
 * @returns {Promise<Object>}
 */
export async function updateWeather(timeState, regionType = 'default') {
    const oldWeather = timeState.weather;
    const newWeather = generateWeather(timeState, regionType);

    // Update the time state
    const state = getDomainState('time');
    if (state) {
        state.weather = newWeather;
        await setDomainState('time', state, 'vtc');

        // Emit weather change event
        ValdrisEventBus.emit('weatherChanged', {
            oldWeather,
            newWeather
        });
    }

    return newWeather;
}

/**
 * Set weather manually
 * @param {Object} weatherOverride - Weather values to set
 * @returns {Promise<Object>}
 */
export async function setWeather(weatherOverride) {
    const state = getDomainState('time');
    if (!state) return null;

    const oldWeather = state.weather;

    // Merge with current weather
    state.weather = {
        ...state.weather,
        ...weatherOverride
    };

    // Update condition details if condition changed
    if (weatherOverride.current) {
        const conditionData = WEATHER_CONDITIONS[weatherOverride.current];
        if (conditionData) {
            state.weather.currentName = conditionData.name;
            state.weather.icon = conditionData.icon;
            state.weather.visibility = conditionData.visibility;
            state.weather.description = conditionData.description;
        }
    }

    await setDomainState('time', state, 'vtc');

    ValdrisEventBus.emit('weatherChanged', {
        oldWeather,
        newWeather: state.weather
    });

    return state.weather;
}

/**
 * Get weather condition data
 * @param {string} condition - Condition name
 * @returns {Object}
 */
export function getWeatherCondition(condition) {
    return WEATHER_CONDITIONS[condition] || null;
}

/**
 * Get all weather conditions
 * @returns {Object}
 */
export function getAllWeatherConditions() {
    return { ...WEATHER_CONDITIONS };
}

/**
 * Get temperature data
 * @param {string} temp - Temperature level
 * @returns {Object}
 */
export function getTemperature(temp) {
    return TEMPERATURES[temp] || null;
}

/**
 * Get wind data
 * @param {string} wind - Wind level
 * @returns {Object}
 */
export function getWindLevel(wind) {
    return WIND_LEVELS[wind] || null;
}

// ============================================================================
// Exports
// ============================================================================

export default {
    generateWeather,
    updateWeather,
    setWeather,
    getWeatherCondition,
    getAllWeatherConditions,
    getTemperature,
    getWindLevel,
    WEATHER_CONDITIONS,
    TEMPERATURES,
    WIND_LEVELS,
    REGION_MODIFIERS
};
