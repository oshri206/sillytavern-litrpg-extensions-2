/**
 * Valdris Event Bus - Cross-extension communication
 *
 * This module provides a pub/sub event system for Valdris extensions
 * to communicate with each other without direct dependencies.
 *
 * Standard Events:
 * - 'timeAdvanced'      { oldTime, newTime, minutesElapsed }
 * - 'newDay'            { date }
 * - 'newMonth'          { date }
 * - 'domainChanged'     { domain, data, extensionId }
 * - 'playerMoved'       { oldLocation, newLocation }
 * - 'combatStarted'     { enemies }
 * - 'combatEnded'       { result }
 * - 'restStarted'       { type: 'short'|'long' }
 * - 'restEnded'         { hoursRested }
 * - 'questCompleted'    { questId }
 * - 'npcInteraction'    { npcId, type }
 * - 'bountyCompleted'   { bountyId }
 * - 'bountyFailed'      { bountyId }
 * - 'commissionComplete' { commission }
 * - 'levelUp'           { oldLevel, newLevel }
 * - 'classUnlocked'     { classId, className }
 * - 'nearDeath'         { hpPercent }
 * - 'weatherChanged'    { oldWeather, newWeather }
 * - 'moonPhaseChanged'  { moon, oldPhase, newPhase }
 * - 'celestialEvent'    { event }
 * - 'crimeCommitted'    { crime }
 * - 'reputationChanged' { faction, oldValue, newValue }
 */

const LOG_PREFIX = '[ValdrisEventBus]';

// Event listener registry
const _listeners = {};

// Event history for debugging (keeps last 50 events)
const _eventHistory = [];
const MAX_HISTORY = 50;

// Debug mode flag
let _debugMode = false;

/**
 * The Valdris Event Bus singleton
 */
export const ValdrisEventBus = {
    /**
     * Subscribe to an event
     * @param {string} event - Event name to subscribe to
     * @param {Function} callback - Callback function(data)
     * @param {Object} options - Optional settings
     * @param {boolean} options.once - If true, unsubscribe after first call
     * @param {string} options.id - Identifier for this listener (for targeted removal)
     * @returns {Function} Unsubscribe function
     */
    on(event, callback, options = {}) {
        if (typeof callback !== 'function') {
            console.error(`${LOG_PREFIX} Callback must be a function`);
            return () => {};
        }

        if (!_listeners[event]) {
            _listeners[event] = [];
        }

        const listener = {
            callback,
            once: options.once || false,
            id: options.id || null,
            addedAt: Date.now()
        };

        _listeners[event].push(listener);

        if (_debugMode) {
            console.log(`${LOG_PREFIX} Subscribed to '${event}'`, options.id ? `(id: ${options.id})` : '');
        }

        // Return unsubscribe function
        return () => this.off(event, callback);
    },

    /**
     * Subscribe to an event, but only trigger once
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    once(event, callback) {
        return this.on(event, callback, { once: true });
    },

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function|string} callbackOrId - The callback function or listener ID to remove
     */
    off(event, callbackOrId) {
        if (!_listeners[event]) return;

        const initialLength = _listeners[event].length;

        if (typeof callbackOrId === 'function') {
            _listeners[event] = _listeners[event].filter(l => l.callback !== callbackOrId);
        } else if (typeof callbackOrId === 'string') {
            _listeners[event] = _listeners[event].filter(l => l.id !== callbackOrId);
        }

        if (_debugMode && _listeners[event].length !== initialLength) {
            console.log(`${LOG_PREFIX} Unsubscribed from '${event}'`);
        }

        // Clean up empty event arrays
        if (_listeners[event].length === 0) {
            delete _listeners[event];
        }
    },

    /**
     * Remove all listeners for an event, or all listeners entirely
     * @param {string} [event] - Optional event name. If omitted, clears all.
     */
    clear(event) {
        if (event) {
            delete _listeners[event];
            if (_debugMode) {
                console.log(`${LOG_PREFIX} Cleared all listeners for '${event}'`);
            }
        } else {
            for (const key in _listeners) {
                delete _listeners[key];
            }
            if (_debugMode) {
                console.log(`${LOG_PREFIX} Cleared all listeners`);
            }
        }
    },

    /**
     * Emit an event to all subscribers
     * @param {string} event - Event name
     * @param {*} data - Data to pass to subscribers
     */
    emit(event, data) {
        // Record in history
        _eventHistory.push({
            event,
            data,
            timestamp: Date.now(),
            listenerCount: _listeners[event]?.length || 0
        });

        // Trim history
        while (_eventHistory.length > MAX_HISTORY) {
            _eventHistory.shift();
        }

        if (_debugMode) {
            console.log(`${LOG_PREFIX} Emitting '${event}'`, data);
        }

        if (!_listeners[event]) return;

        // Copy listener array to avoid issues if listeners modify the array
        const listeners = [..._listeners[event]];
        const toRemove = [];

        for (const listener of listeners) {
            try {
                listener.callback(data);

                if (listener.once) {
                    toRemove.push(listener);
                }
            } catch (error) {
                console.error(`${LOG_PREFIX} Error in '${event}' listener:`, error);
            }
        }

        // Remove one-time listeners
        for (const listener of toRemove) {
            const idx = _listeners[event].indexOf(listener);
            if (idx > -1) {
                _listeners[event].splice(idx, 1);
            }
        }

        // Clean up empty arrays
        if (_listeners[event]?.length === 0) {
            delete _listeners[event];
        }
    },

    /**
     * Emit an event and wait for all async handlers to complete
     * @param {string} event - Event name
     * @param {*} data - Data to pass to subscribers
     * @returns {Promise<void>}
     */
    async emitAsync(event, data) {
        // Record in history
        _eventHistory.push({
            event,
            data,
            timestamp: Date.now(),
            listenerCount: _listeners[event]?.length || 0,
            async: true
        });

        // Trim history
        while (_eventHistory.length > MAX_HISTORY) {
            _eventHistory.shift();
        }

        if (_debugMode) {
            console.log(`${LOG_PREFIX} Emitting async '${event}'`, data);
        }

        if (!_listeners[event]) return;

        const listeners = [..._listeners[event]];
        const toRemove = [];
        const promises = [];

        for (const listener of listeners) {
            try {
                const result = listener.callback(data);
                if (result instanceof Promise) {
                    promises.push(result);
                }

                if (listener.once) {
                    toRemove.push(listener);
                }
            } catch (error) {
                console.error(`${LOG_PREFIX} Error in '${event}' listener:`, error);
            }
        }

        // Wait for all async handlers
        await Promise.all(promises);

        // Remove one-time listeners
        for (const listener of toRemove) {
            const idx = _listeners[event].indexOf(listener);
            if (idx > -1) {
                _listeners[event].splice(idx, 1);
            }
        }

        if (_listeners[event]?.length === 0) {
            delete _listeners[event];
        }
    },

    /**
     * Check if an event has any listeners
     * @param {string} event - Event name
     * @returns {boolean}
     */
    hasListeners(event) {
        return !!_listeners[event] && _listeners[event].length > 0;
    },

    /**
     * Get count of listeners for an event
     * @param {string} event - Event name
     * @returns {number}
     */
    listenerCount(event) {
        return _listeners[event]?.length || 0;
    },

    /**
     * Get all registered event names
     * @returns {string[]}
     */
    eventNames() {
        return Object.keys(_listeners);
    },

    /**
     * Enable or disable debug mode
     * @param {boolean} enabled
     */
    setDebugMode(enabled) {
        _debugMode = enabled;
        console.log(`${LOG_PREFIX} Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    },

    /**
     * Get event history for debugging
     * @returns {Array}
     */
    getHistory() {
        return [..._eventHistory];
    },

    /**
     * Clear event history
     */
    clearHistory() {
        _eventHistory.length = 0;
    }
};

// Freeze the object to prevent modifications
Object.freeze(ValdrisEventBus);

export default ValdrisEventBus;
