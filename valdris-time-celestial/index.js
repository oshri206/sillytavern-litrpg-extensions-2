/**
 * Valdris Time & Celestial (VTC)
 *
 * Time tracking, weather generation, moon phases, and calendar system.
 * Intelligently parses AI responses to advance time based on scene context.
 */

// Import SillyTavern modules
import { getContext, extension_settings, saveSettingsDebounced } from '../../../extensions.js';
import { eventSource, event_types } from '../../../../script.js';

// Import Valdris Core
import {
    ValdrisEventBus,
    registerDomain,
    getDomainState,
    setDomainState,
    subscribe
} from '../valdris-core/index.js';

// Import VTC modules
import {
    createDefaultTimeState,
    estimateSceneDuration,
    calculateSkipToMinutes,
    advanceTime,
    setTime,
    formatTime,
    getTimeOfDay,
    formatFullDate,
    formatShortDate,
    getMonthData,
    MONTHS,
    DAYS_OF_WEEK
} from './time-engine.js';

import {
    generateWeather,
    updateWeather,
    setWeather,
    getAllWeatherConditions
} from './weather-generator.js';

import {
    getMoonPhaseData,
    checkCelestialEvents,
    getUpcomingFestivals,
    getCurrentFestival,
    getMoonVisual,
    getMoonlightLevel,
    getAllCelestialEffects,
    updateCelestialState,
    LUNARA,
    VEIL
} from './celestial-tracker.js';

// ============================================================================
// Constants
// ============================================================================

const EXTENSION_NAME = 'valdris-time-celestial';
const EXTENSION_ID = 'vtc';
const DOMAIN = 'time';
const LOG_PREFIX = '[VTC]';

// Default extension settings
const DEFAULT_SETTINGS = {
    enabled: true,
    showHeader: true,
    headerPosition: 'top', // top, bottom
    autoAdvance: true,
    parseAIResponses: true,
    confirmLargeJumps: true,
    largeJumpThreshold: 240, // minutes
    showWeather: true,
    showMoons: true,
    showUpcomingEvents: true,
    regionType: 'default',
    use24Hour: false
};

// ============================================================================
// UI State
// ============================================================================

const UI = {
    mounted: false,
    header: null,
    panel: null,
    panelVisible: false
};

// Cleanup tracking
const _cleanupFns = [];

// ============================================================================
// Settings Management
// ============================================================================

function getSettings() {
    if (!extension_settings[EXTENSION_NAME]) {
        extension_settings[EXTENSION_NAME] = { ...DEFAULT_SETTINGS };
    }
    return extension_settings[EXTENSION_NAME];
}

function updateSettings(updates) {
    const settings = getSettings();
    Object.assign(settings, updates);
    saveSettingsDebounced();
}

// ============================================================================
// State Initialization
// ============================================================================

/**
 * Initialize or load time state
 */
async function initializeTimeState() {
    let state = getDomainState(DOMAIN);

    if (!state) {
        console.log(`${LOG_PREFIX} Creating new time state`);
        state = createDefaultTimeState();

        // Generate initial weather
        const settings = getSettings();
        state.weather = generateWeather(state, settings.regionType);

        // Save
        await setDomainState(DOMAIN, state, EXTENSION_ID);
    }

    return state;
}

// ============================================================================
// AI Response Parsing
// ============================================================================

/**
 * Handle AI response and potentially advance time
 */
async function onAIResponse(data) {
    const settings = getSettings();

    if (!settings.enabled || !settings.parseAIResponses || !settings.autoAdvance) {
        return;
    }

    const { message } = data;
    if (!message) return;

    try {
        const estimation = estimateSceneDuration(message);

        if (estimation.skipTo) {
            // Handle skip to specific time
            const state = getDomainState(DOMAIN);
            const minutes = calculateSkipToMinutes(state, estimation.skipTo);

            if (settings.confirmLargeJumps && minutes > settings.largeJumpThreshold) {
                // Would need confirmation - for now, just log
                console.log(`${LOG_PREFIX} Large time skip detected: ${minutes} minutes to ${estimation.skipTo}`);
                // In a full implementation, this would trigger a confirmation dialog
            }

            await advanceTime(minutes);
            console.log(`${LOG_PREFIX} Skipped to ${estimation.skipTo} (${minutes} minutes)`);

        } else if (estimation.minutes > 0) {
            if (settings.confirmLargeJumps && estimation.minutes > settings.largeJumpThreshold) {
                console.log(`${LOG_PREFIX} Large time advance detected: ${estimation.minutes} minutes`);
            }

            await advanceTime(estimation.minutes);
            console.log(`${LOG_PREFIX} Advanced ${estimation.minutes} minutes (${estimation.confidence} confidence)`);
        }

        // Update UI
        updateHeader();

    } catch (error) {
        console.error(`${LOG_PREFIX} Error parsing AI response:`, error);
    }
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handle new day event
 */
async function onNewDay(data) {
    const settings = getSettings();

    // Generate new weather
    await updateWeather(data.date, settings.regionType);

    // Update celestial state
    await updateCelestialState(data.date);

    // Update UI
    updateHeader();

    console.log(`${LOG_PREFIX} New day: ${formatFullDate(data.date)}`);
}

/**
 * Handle chat changed
 */
async function onChatChanged() {
    console.log(`${LOG_PREFIX} Chat changed, reinitializing`);
    await initializeTimeState();
    updateHeader();
}

// ============================================================================
// Header Bar UI
// ============================================================================

/**
 * Create the header bar element
 */
function createHeader() {
    const header = document.createElement('div');
    header.id = 'vtc-header';
    header.className = 'vtc-header';

    header.innerHTML = `
        <div class="vtc-header__content">
            <div class="vtc-header__left">
                <span class="vtc-header__location" title="Current Location">
                    <span class="vtc-header__icon">📍</span>
                    <span class="vtc-header__location-text">Unknown</span>
                </span>
                <span class="vtc-header__separator">|</span>
                <span class="vtc-header__date" title="Current Date">
                    <span class="vtc-header__icon">📅</span>
                    <span class="vtc-header__date-text">-</span>
                </span>
            </div>
            <div class="vtc-header__center">
                <span class="vtc-header__time" title="Current Time">
                    <span class="vtc-header__icon">🕐</span>
                    <span class="vtc-header__time-text">-</span>
                    <span class="vtc-header__period">(-)</span>
                </span>
            </div>
            <div class="vtc-header__right">
                <span class="vtc-header__weather" title="Current Weather">
                    <span class="vtc-header__weather-icon">-</span>
                    <span class="vtc-header__weather-text">-</span>
                </span>
                <span class="vtc-header__separator">|</span>
                <span class="vtc-header__moons" title="Moon Phases">
                    <span class="vtc-header__moon vtc-header__moon--lunara" title="Lunara">🌕</span>
                    <span class="vtc-header__moon vtc-header__moon--veil" title="The Veil">🌑</span>
                </span>
            </div>
        </div>
        <div class="vtc-header__alerts"></div>
    `;

    // Click handler to open panel
    header.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
            togglePanel();
        }
    });

    return header;
}

/**
 * Update header with current state
 */
function updateHeader() {
    if (!UI.header) return;

    const state = getDomainState(DOMAIN);
    if (!state) return;

    const settings = getSettings();

    // Location (from player state if available)
    const playerState = getDomainState('player');
    const locationText = UI.header.querySelector('.vtc-header__location-text');
    if (locationText) {
        locationText.textContent = playerState?.currentLocation || 'Unknown Location';
    }

    // Date
    const dateText = UI.header.querySelector('.vtc-header__date-text');
    if (dateText) {
        dateText.textContent = formatShortDate(state);
    }

    // Time
    const timeText = UI.header.querySelector('.vtc-header__time-text');
    const periodText = UI.header.querySelector('.vtc-header__period');
    if (timeText) {
        timeText.textContent = settings.use24Hour
            ? `${state.hour.toString().padStart(2, '0')}:${state.minute.toString().padStart(2, '0')}`
            : formatTime(state.hour, state.minute);
    }
    if (periodText) {
        periodText.textContent = `(${getTimeOfDay(state.hour)})`;
    }

    // Weather
    if (settings.showWeather && state.weather) {
        const weatherIcon = UI.header.querySelector('.vtc-header__weather-icon');
        const weatherText = UI.header.querySelector('.vtc-header__weather-text');
        if (weatherIcon) {
            weatherIcon.textContent = state.weather.icon || '❓';
        }
        if (weatherText) {
            const tempName = state.weather.temperatureName || state.weather.temperature || '';
            weatherText.textContent = `${state.weather.currentName || state.weather.current}, ${tempName}`;
        }
    }

    // Moons
    if (settings.showMoons && state.moons) {
        const lunaraMoon = UI.header.querySelector('.vtc-header__moon--lunara');
        const veilMoon = UI.header.querySelector('.vtc-header__moon--veil');

        if (lunaraMoon && state.moons.lunara) {
            const lunaraData = getMoonPhaseData('lunara', state.moons.lunara);
            lunaraMoon.textContent = lunaraData.icon;
            lunaraMoon.title = `Lunara: ${lunaraData.phaseName}`;
        }

        if (veilMoon && state.moons.veil) {
            const veilData = getMoonPhaseData('veil', state.moons.veil);
            veilMoon.textContent = veilData.visible ? veilData.icon : '⚫';
            veilMoon.title = `The Veil: ${veilData.phaseName}`;
        }
    }

    // Alerts
    updateAlerts(state);
}

/**
 * Update alerts section
 */
function updateAlerts(state) {
    const alertsEl = UI.header?.querySelector('.vtc-header__alerts');
    if (!alertsEl) return;

    const alerts = [];

    // Celestial events
    const celestialEvents = checkCelestialEvents(state);
    for (const event of celestialEvents) {
        alerts.push({
            type: 'celestial',
            icon: event.icon,
            text: event.name,
            class: 'vtc-alert--celestial'
        });
    }

    // Current festival
    const festival = getCurrentFestival(state);
    if (festival) {
        alerts.push({
            type: 'festival',
            icon: '🎉',
            text: `${festival.name} (Day ${festival.dayOfFestival})`,
            class: 'vtc-alert--festival'
        });
    }

    // Weather warnings
    if (state.weather?.visibility === 'poor' || state.weather?.visibility === 'very_poor') {
        alerts.push({
            type: 'weather',
            icon: '⚠️',
            text: `Low visibility: ${state.weather.currentName}`,
            class: 'vtc-alert--warning'
        });
    }

    // Player buffs/debuffs expiring soon (from player state)
    const playerState = getDomainState('player');
    if (playerState?.buffs) {
        const expiringSoon = playerState.buffs.filter(b => b.remainingMinutes && b.remainingMinutes <= 30);
        for (const buff of expiringSoon.slice(0, 2)) {
            alerts.push({
                type: 'buff',
                icon: '⏱️',
                text: `${buff.name}: ${buff.remainingMinutes}min`,
                class: 'vtc-alert--buff'
            });
        }
    }

    // Render alerts
    if (alerts.length === 0) {
        alertsEl.innerHTML = '';
        alertsEl.style.display = 'none';
    } else {
        alertsEl.style.display = 'flex';
        alertsEl.innerHTML = alerts.map(a => `
            <span class="vtc-alert ${a.class}" title="${a.text}">
                <span class="vtc-alert__icon">${a.icon}</span>
                <span class="vtc-alert__text">${a.text}</span>
            </span>
        `).join('');
    }
}

// ============================================================================
// Control Panel UI
// ============================================================================

/**
 * Create the control panel
 */
function createPanel() {
    const panel = document.createElement('div');
    panel.id = 'vtc-panel';
    panel.className = 'vtc-panel vtc-panel--hidden';

    panel.innerHTML = `
        <div class="vtc-panel__header">
            <h3>Time & Celestial</h3>
            <button class="vtc-panel__close">&times;</button>
        </div>
        <div class="vtc-panel__content">
            <div class="vtc-panel__tabs">
                <button class="vtc-panel__tab vtc-panel__tab--active" data-tab="time">Time</button>
                <button class="vtc-panel__tab" data-tab="weather">Weather</button>
                <button class="vtc-panel__tab" data-tab="celestial">Celestial</button>
                <button class="vtc-panel__tab" data-tab="settings">Settings</button>
            </div>
            <div class="vtc-panel__tab-content" id="vtc-tab-time"></div>
            <div class="vtc-panel__tab-content vtc-hidden" id="vtc-tab-weather"></div>
            <div class="vtc-panel__tab-content vtc-hidden" id="vtc-tab-celestial"></div>
            <div class="vtc-panel__tab-content vtc-hidden" id="vtc-tab-settings"></div>
        </div>
    `;

    // Tab switching
    panel.querySelectorAll('.vtc-panel__tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchTab(tabName);
        });
    });

    // Close button
    panel.querySelector('.vtc-panel__close').addEventListener('click', () => {
        togglePanel(false);
    });

    return panel;
}

/**
 * Switch active tab
 */
function switchTab(tabName) {
    if (!UI.panel) return;

    // Update tab buttons
    UI.panel.querySelectorAll('.vtc-panel__tab').forEach(tab => {
        tab.classList.toggle('vtc-panel__tab--active', tab.dataset.tab === tabName);
    });

    // Update tab content
    UI.panel.querySelectorAll('.vtc-panel__tab-content').forEach(content => {
        content.classList.toggle('vtc-hidden', content.id !== `vtc-tab-${tabName}`);
    });

    // Render tab content
    renderTabContent(tabName);
}

/**
 * Render content for a tab
 */
function renderTabContent(tabName) {
    const container = UI.panel?.querySelector(`#vtc-tab-${tabName}`);
    if (!container) return;

    const state = getDomainState(DOMAIN);
    if (!state) return;

    switch (tabName) {
        case 'time':
            renderTimeTab(container, state);
            break;
        case 'weather':
            renderWeatherTab(container, state);
            break;
        case 'celestial':
            renderCelestialTab(container, state);
            break;
        case 'settings':
            renderSettingsTab(container);
            break;
    }
}

/**
 * Render time tab
 */
function renderTimeTab(container, state) {
    const settings = getSettings();

    container.innerHTML = `
        <div class="vtc-section">
            <div class="vtc-time-display">
                <div class="vtc-time-display__date">${formatFullDate(state)}</div>
                <div class="vtc-time-display__time">${formatTime(state.hour, state.minute)}</div>
                <div class="vtc-time-display__period">${getTimeOfDay(state.hour)}</div>
            </div>
        </div>

        <div class="vtc-section">
            <h4>Quick Advance</h4>
            <div class="vtc-time-controls">
                <button class="vtc-btn" data-advance="5">+5m</button>
                <button class="vtc-btn" data-advance="15">+15m</button>
                <button class="vtc-btn" data-advance="30">+30m</button>
                <button class="vtc-btn" data-advance="60">+1h</button>
                <button class="vtc-btn" data-advance="360">+6h</button>
                <button class="vtc-btn" data-advance="1440">+1d</button>
            </div>
        </div>

        <div class="vtc-section">
            <h4>Skip To</h4>
            <div class="vtc-time-controls">
                <button class="vtc-btn" data-skipto="morning">Dawn</button>
                <button class="vtc-btn" data-skipto="noon">Noon</button>
                <button class="vtc-btn" data-skipto="evening">Evening</button>
                <button class="vtc-btn" data-skipto="night">Night</button>
                <button class="vtc-btn" data-skipto="midnight">Midnight</button>
            </div>
        </div>

        <div class="vtc-section">
            <h4>Set Time</h4>
            <div class="vtc-time-set">
                <div class="vtc-time-set__row">
                    <label>Year:</label>
                    <input type="number" id="vtc-set-year" value="${state.year}" min="1" />
                </div>
                <div class="vtc-time-set__row">
                    <label>Month:</label>
                    <select id="vtc-set-month">
                        ${MONTHS.map((m, i) => `<option value="${i + 1}" ${state.month === i + 1 ? 'selected' : ''}>${m.name}</option>`).join('')}
                    </select>
                </div>
                <div class="vtc-time-set__row">
                    <label>Day:</label>
                    <input type="number" id="vtc-set-day" value="${state.day}" min="1" max="31" />
                </div>
                <div class="vtc-time-set__row">
                    <label>Hour:</label>
                    <input type="number" id="vtc-set-hour" value="${state.hour}" min="0" max="23" />
                </div>
                <div class="vtc-time-set__row">
                    <label>Minute:</label>
                    <input type="number" id="vtc-set-minute" value="${state.minute}" min="0" max="59" />
                </div>
                <button class="vtc-btn vtc-btn--primary" id="vtc-apply-time">Apply</button>
            </div>
        </div>

        <div class="vtc-section">
            <h4>Sun Times</h4>
            <div class="vtc-sun-times">
                <span>🌅 Sunrise: ${state.sun?.sunrise || '6:00'}</span>
                <span>🌇 Sunset: ${state.sun?.sunset || '18:00'}</span>
            </div>
        </div>
    `;

    // Add event listeners
    container.querySelectorAll('[data-advance]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const minutes = parseInt(btn.dataset.advance);
            await advanceTime(minutes);
            updateHeader();
            renderTimeTab(container, getDomainState(DOMAIN));
        });
    });

    container.querySelectorAll('[data-skipto]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const target = btn.dataset.skipto;
            const currentState = getDomainState(DOMAIN);
            const minutes = calculateSkipToMinutes(currentState, target);
            await advanceTime(minutes);
            updateHeader();
            renderTimeTab(container, getDomainState(DOMAIN));
        });
    });

    container.querySelector('#vtc-apply-time')?.addEventListener('click', async () => {
        const newTime = {
            year: parseInt(container.querySelector('#vtc-set-year').value),
            month: parseInt(container.querySelector('#vtc-set-month').value),
            day: parseInt(container.querySelector('#vtc-set-day').value),
            hour: parseInt(container.querySelector('#vtc-set-hour').value),
            minute: parseInt(container.querySelector('#vtc-set-minute').value)
        };
        await setTime(newTime);
        updateHeader();
        renderTimeTab(container, getDomainState(DOMAIN));
    });
}

/**
 * Render weather tab
 */
function renderWeatherTab(container, state) {
    const weather = state.weather || {};
    const settings = getSettings();

    container.innerHTML = `
        <div class="vtc-section">
            <div class="vtc-weather-display">
                <div class="vtc-weather-display__icon">${weather.icon || '❓'}</div>
                <div class="vtc-weather-display__info">
                    <div class="vtc-weather-display__condition">${weather.currentName || 'Unknown'}</div>
                    <div class="vtc-weather-display__temp">${weather.temperatureName || '-'}</div>
                    <div class="vtc-weather-display__wind">${weather.windName || '-'}</div>
                </div>
            </div>
            <p class="vtc-weather-display__desc">${weather.description || ''}</p>
        </div>

        <div class="vtc-section">
            <h4>Effects</h4>
            <ul class="vtc-effects-list">
                ${(weather.effects || []).map(e => `<li>${e}</li>`).join('') || '<li>None</li>'}
            </ul>
        </div>

        <div class="vtc-section">
            <h4>Modifiers</h4>
            <div class="vtc-modifiers">
                <span>Travel: ${Math.round((weather.modifiers?.travel || 1) * 100)}%</span>
                <span>Combat: ${Math.round((weather.modifiers?.combat || 1) * 100)}%</span>
                <span>Ranged: ${weather.modifiers?.ranged || 0}</span>
            </div>
        </div>

        <div class="vtc-section">
            <h4>Forecast</h4>
            <div class="vtc-forecast">
                ${(weather.forecast || []).map(f => `
                    <div class="vtc-forecast__day">
                        <div class="vtc-forecast__day-num">+${f.day}d</div>
                        <div class="vtc-forecast__icon">${f.icon}</div>
                        <div class="vtc-forecast__condition">${f.conditionName}</div>
                        <div class="vtc-forecast__temp">${f.temperatureName}</div>
                    </div>
                `).join('') || '<p>No forecast available</p>'}
            </div>
        </div>

        <div class="vtc-section">
            <h4>Region Type</h4>
            <select id="vtc-region-type" class="vtc-select">
                <option value="default" ${settings.regionType === 'default' ? 'selected' : ''}>Default</option>
                <option value="coastal" ${settings.regionType === 'coastal' ? 'selected' : ''}>Coastal</option>
                <option value="mountain" ${settings.regionType === 'mountain' ? 'selected' : ''}>Mountain</option>
                <option value="desert" ${settings.regionType === 'desert' ? 'selected' : ''}>Desert</option>
                <option value="forest" ${settings.regionType === 'forest' ? 'selected' : ''}>Forest</option>
                <option value="swamp" ${settings.regionType === 'swamp' ? 'selected' : ''}>Swamp</option>
                <option value="plains" ${settings.regionType === 'plains' ? 'selected' : ''}>Plains</option>
                <option value="tundra" ${settings.regionType === 'tundra' ? 'selected' : ''}>Tundra</option>
            </select>
            <button class="vtc-btn" id="vtc-regenerate-weather">Regenerate Weather</button>
        </div>
    `;

    // Event listeners
    container.querySelector('#vtc-region-type')?.addEventListener('change', (e) => {
        updateSettings({ regionType: e.target.value });
    });

    container.querySelector('#vtc-regenerate-weather')?.addEventListener('click', async () => {
        await updateWeather(state, settings.regionType);
        updateHeader();
        renderWeatherTab(container, getDomainState(DOMAIN));
    });
}

/**
 * Render celestial tab
 */
function renderCelestialTab(container, state) {
    const lunaraData = state.moons?.lunara ? getMoonPhaseData('lunara', state.moons.lunara) : null;
    const veilData = state.moons?.veil ? getMoonPhaseData('veil', state.moons.veil) : null;
    const celestialEvents = checkCelestialEvents(state);
    const upcomingFestivals = getUpcomingFestivals(state, 30);
    const moonlight = getMoonlightLevel(state);
    const allEffects = getAllCelestialEffects(state);

    container.innerHTML = `
        <div class="vtc-section">
            <h4>Moons</h4>
            <div class="vtc-moons">
                ${lunaraData ? `
                    <div class="vtc-moon">
                        <div class="vtc-moon__icon vtc-moon__icon--lunara">${lunaraData.icon}</div>
                        <div class="vtc-moon__info">
                            <div class="vtc-moon__name">${lunaraData.moon}</div>
                            <div class="vtc-moon__phase">${lunaraData.phaseName}</div>
                            <div class="vtc-moon__until">Full in ${lunaraData.daysUntilFull}d | New in ${lunaraData.daysUntilNew}d</div>
                        </div>
                    </div>
                ` : ''}
                ${veilData ? `
                    <div class="vtc-moon">
                        <div class="vtc-moon__icon vtc-moon__icon--veil">${veilData.visible ? veilData.icon : '⚫'}</div>
                        <div class="vtc-moon__info">
                            <div class="vtc-moon__name">${veilData.moon}</div>
                            <div class="vtc-moon__phase">${veilData.phaseName}</div>
                            <div class="vtc-moon__until">Full in ${veilData.daysUntilFull}d | New in ${veilData.daysUntilNew}d</div>
                        </div>
                    </div>
                ` : ''}
            </div>
            <div class="vtc-moonlight">
                <span>Moonlight Level:</span>
                <span>${moonlight.description} (${moonlight.level})</span>
            </div>
        </div>

        <div class="vtc-section">
            <h4>Active Celestial Events</h4>
            ${celestialEvents.length > 0 ? `
                <ul class="vtc-events-list">
                    ${celestialEvents.map(e => `
                        <li class="vtc-event vtc-event--${e.rarity}">
                            <span class="vtc-event__icon">${e.icon}</span>
                            <span class="vtc-event__name">${e.name}</span>
                            <p class="vtc-event__desc">${e.description}</p>
                        </li>
                    `).join('')}
                </ul>
            ` : '<p class="vtc-muted">No special celestial events</p>'}
        </div>

        <div class="vtc-section">
            <h4>Active Effects</h4>
            ${allEffects.length > 0 ? `
                <ul class="vtc-effects-list">
                    ${allEffects.map(e => `<li><strong>${e.source}:</strong> ${e.description}</li>`).join('')}
                </ul>
            ` : '<p class="vtc-muted">No active celestial effects</p>'}
        </div>

        <div class="vtc-section">
            <h4>Upcoming Festivals</h4>
            ${upcomingFestivals.length > 0 ? `
                <ul class="vtc-festivals-list">
                    ${upcomingFestivals.map(f => `
                        <li class="vtc-festival ${f.isToday ? 'vtc-festival--today' : ''}">
                            <span class="vtc-festival__name">${f.name}</span>
                            <span class="vtc-festival__days">${f.isToday ? 'Today!' : `in ${f.daysUntil} days`}</span>
                            <p class="vtc-festival__desc">${f.description}</p>
                        </li>
                    `).join('')}
                </ul>
            ` : '<p class="vtc-muted">No festivals in the next 30 days</p>'}
        </div>
    `;
}

/**
 * Render settings tab
 */
function renderSettingsTab(container) {
    const settings = getSettings();

    container.innerHTML = `
        <div class="vtc-section">
            <h4>Display</h4>
            <label class="vtc-checkbox">
                <input type="checkbox" id="vtc-setting-header" ${settings.showHeader ? 'checked' : ''} />
                Show header bar
            </label>
            <label class="vtc-checkbox">
                <input type="checkbox" id="vtc-setting-weather" ${settings.showWeather ? 'checked' : ''} />
                Show weather in header
            </label>
            <label class="vtc-checkbox">
                <input type="checkbox" id="vtc-setting-moons" ${settings.showMoons ? 'checked' : ''} />
                Show moons in header
            </label>
            <label class="vtc-checkbox">
                <input type="checkbox" id="vtc-setting-24h" ${settings.use24Hour ? 'checked' : ''} />
                Use 24-hour time
            </label>
        </div>

        <div class="vtc-section">
            <h4>Time Parsing</h4>
            <label class="vtc-checkbox">
                <input type="checkbox" id="vtc-setting-enabled" ${settings.enabled ? 'checked' : ''} />
                Enable VTC
            </label>
            <label class="vtc-checkbox">
                <input type="checkbox" id="vtc-setting-parse" ${settings.parseAIResponses ? 'checked' : ''} />
                Parse AI responses for time
            </label>
            <label class="vtc-checkbox">
                <input type="checkbox" id="vtc-setting-auto" ${settings.autoAdvance ? 'checked' : ''} />
                Auto-advance time
            </label>
            <label class="vtc-checkbox">
                <input type="checkbox" id="vtc-setting-confirm" ${settings.confirmLargeJumps ? 'checked' : ''} />
                Confirm large time jumps
            </label>
            <div class="vtc-setting-row">
                <label>Large jump threshold (minutes):</label>
                <input type="number" id="vtc-setting-threshold" value="${settings.largeJumpThreshold}" min="30" max="1440" />
            </div>
        </div>
    `;

    // Add event listeners
    const bindCheckbox = (id, key) => {
        container.querySelector(id)?.addEventListener('change', (e) => {
            updateSettings({ [key]: e.target.checked });
            if (key === 'showHeader') {
                UI.header?.classList.toggle('vtc-hidden', !e.target.checked);
            }
            updateHeader();
        });
    };

    bindCheckbox('#vtc-setting-header', 'showHeader');
    bindCheckbox('#vtc-setting-weather', 'showWeather');
    bindCheckbox('#vtc-setting-moons', 'showMoons');
    bindCheckbox('#vtc-setting-24h', 'use24Hour');
    bindCheckbox('#vtc-setting-enabled', 'enabled');
    bindCheckbox('#vtc-setting-parse', 'parseAIResponses');
    bindCheckbox('#vtc-setting-auto', 'autoAdvance');
    bindCheckbox('#vtc-setting-confirm', 'confirmLargeJumps');

    container.querySelector('#vtc-setting-threshold')?.addEventListener('change', (e) => {
        updateSettings({ largeJumpThreshold: parseInt(e.target.value) });
    });
}

/**
 * Toggle panel visibility
 */
function togglePanel(show) {
    if (!UI.panel) return;

    if (show === undefined) {
        show = !UI.panelVisible;
    }

    UI.panelVisible = show;
    UI.panel.classList.toggle('vtc-panel--hidden', !show);

    if (show) {
        switchTab('time');
    }
}

// ============================================================================
// Mount/Unmount
// ============================================================================

function mountUI() {
    if (UI.mounted) return;

    const settings = getSettings();

    // Create and mount header
    UI.header = createHeader();
    if (!settings.showHeader) {
        UI.header.classList.add('vtc-hidden');
    }

    // Find the chat container and insert header
    const chatContainer = document.getElementById('chat');
    if (chatContainer) {
        chatContainer.parentElement.insertBefore(UI.header, chatContainer);
    } else {
        document.body.appendChild(UI.header);
    }

    // Create and mount panel
    UI.panel = createPanel();
    document.body.appendChild(UI.panel);

    // Initial update
    updateHeader();

    UI.mounted = true;
    console.log(`${LOG_PREFIX} UI mounted`);
}

function unmountUI() {
    if (!UI.mounted) return;

    UI.header?.remove();
    UI.panel?.remove();
    UI.header = null;
    UI.panel = null;
    UI.mounted = false;
}

// ============================================================================
// Initialization
// ============================================================================

async function init() {
    console.log(`${LOG_PREFIX} Initializing Valdris Time & Celestial v1.0.0`);

    try {
        // Register domain with core
        const registered = registerDomain(DOMAIN, EXTENSION_ID);
        if (!registered) {
            console.error(`${LOG_PREFIX} Failed to register domain`);
            return;
        }

        // Initialize settings
        if (!extension_settings[EXTENSION_NAME]) {
            extension_settings[EXTENSION_NAME] = { ...DEFAULT_SETTINGS };
            saveSettingsDebounced();
        }

        // Initialize time state
        await initializeTimeState();

        // Set up event listeners
        ValdrisEventBus.on('aiResponseReceived', onAIResponse, { id: EXTENSION_ID });
        ValdrisEventBus.on('newDay', onNewDay, { id: EXTENSION_ID });
        ValdrisEventBus.on('chatChanged', onChatChanged, { id: EXTENSION_ID });

        _cleanupFns.push(() => {
            ValdrisEventBus.off('aiResponseReceived', EXTENSION_ID);
            ValdrisEventBus.off('newDay', EXTENSION_ID);
            ValdrisEventBus.off('chatChanged', EXTENSION_ID);
        });

        // Subscribe to state changes
        const unsubscribe = subscribe(() => updateHeader());
        _cleanupFns.push(unsubscribe);

        // Mount UI
        mountUI();

        console.log(`${LOG_PREFIX} Initialization complete`);

    } catch (error) {
        console.error(`${LOG_PREFIX} Initialization failed:`, error);
    }
}

function cleanup() {
    console.log(`${LOG_PREFIX} Cleaning up`);

    for (const fn of _cleanupFns) {
        try { fn(); } catch (e) { console.error(e); }
    }
    _cleanupFns.length = 0;

    unmountUI();
}

// ============================================================================
// Exports
// ============================================================================

export {
    // Time functions
    advanceTime,
    setTime,
    formatTime,
    getTimeOfDay,
    formatFullDate,
    estimateSceneDuration,

    // Weather functions
    generateWeather,
    updateWeather,
    setWeather,

    // Celestial functions
    getMoonPhaseData,
    checkCelestialEvents,
    getUpcomingFestivals,
    getCurrentFestival,

    // Lifecycle
    cleanup
};

// Initialize
init();

export default {
    init,
    cleanup,
    advanceTime,
    setTime,
    generateWeather,
    getMoonPhaseData
};
