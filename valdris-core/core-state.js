/**
 * Valdris Core - Central State Management
 *
 * This module provides centralized state management for all Valdris extensions.
 * Each extension owns one domain and can read from all domains but only write to its own.
 *
 * Domains:
 * - time:     VTC (Valdris Time & Celestial)
 * - player:   VMT (Valdris Master Tracker)
 * - world:    VWS (Valdris World State)
 * - npcs:     VNS (Valdris NPC & Social)
 * - economy:  VES (Valdris Economy & Services)
 * - factions: VFS (Valdris Factions & Politics)
 * - vex:      VVW (Valdris Vex Whispers)
 */

import { ValdrisEventBus } from './event-bus.js';

const LOG_PREFIX = '[ValdrisCore]';
const CORE_META_KEY = 'valdris_core_v1';

// SillyTavern context reference (set during init)
let _stContext = null;

// Domain registry - defines which extension owns which domain
const _domainOwners = {};

// State change subscribers
const _subscribers = [];

// Default empty state for each domain
const DEFAULT_DOMAINS = {
    time: null,
    player: null,
    world: null,
    npcs: null,
    economy: null,
    factions: null,
    vex: null
};

// Mutex for preventing race conditions
let _saveMutex = Promise.resolve();

/**
 * Initialize the core state manager with SillyTavern context
 * @param {Object} stContext - SillyTavern context from getContext()
 */
export function initCoreState(stContext) {
    _stContext = stContext;
    console.log(`${LOG_PREFIX} Core state initialized`);
}

/**
 * Get the SillyTavern context
 * @returns {Object|null}
 */
export function getSTContext() {
    if (_stContext) return _stContext;

    // Try to get from SillyTavern global
    if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
        return SillyTavern.getContext();
    }

    return null;
}

/**
 * Register a domain owner
 * Each extension should call this during initialization to claim its domain
 *
 * @param {string} domain - Domain name (time, player, world, npcs, economy, factions, vex)
 * @param {string} extensionId - Unique identifier for the extension
 * @returns {boolean} True if registration succeeded
 */
export function registerDomain(domain, extensionId) {
    if (!DEFAULT_DOMAINS.hasOwnProperty(domain)) {
        console.error(`${LOG_PREFIX} Unknown domain: ${domain}`);
        return false;
    }

    if (_domainOwners[domain] && _domainOwners[domain] !== extensionId) {
        console.warn(`${LOG_PREFIX} Domain '${domain}' already owned by '${_domainOwners[domain]}', cannot register for '${extensionId}'`);
        return false;
    }

    _domainOwners[domain] = extensionId;
    console.log(`${LOG_PREFIX} Domain '${domain}' registered to '${extensionId}'`);
    return true;
}

/**
 * Unregister a domain owner (for cleanup)
 * @param {string} domain - Domain name
 * @param {string} extensionId - Extension that's unregistering
 */
export function unregisterDomain(domain, extensionId) {
    if (_domainOwners[domain] === extensionId) {
        delete _domainOwners[domain];
        console.log(`${LOG_PREFIX} Domain '${domain}' unregistered`);
    }
}

/**
 * Check if an extension owns a domain
 * @param {string} domain - Domain name
 * @param {string} extensionId - Extension to check
 * @returns {boolean}
 */
export function isDomainOwner(domain, extensionId) {
    return _domainOwners[domain] === extensionId;
}

/**
 * Get the owner of a domain
 * @param {string} domain - Domain name
 * @returns {string|null}
 */
export function getDomainOwner(domain) {
    return _domainOwners[domain] || null;
}

/**
 * Get all registered domains and their owners
 * @returns {Object}
 */
export function getAllDomainOwners() {
    return { ..._domainOwners };
}

/**
 * Get the full state across all domains
 * @returns {Object}
 */
export function getFullState() {
    const ctx = getSTContext();
    const md = ctx?.chatMetadata;

    if (!md) {
        console.warn(`${LOG_PREFIX} No chat metadata available, returning empty state`);
        return { ...DEFAULT_DOMAINS };
    }

    if (!md[CORE_META_KEY]) {
        md[CORE_META_KEY] = { ...DEFAULT_DOMAINS };
    }

    return md[CORE_META_KEY];
}

/**
 * Get state for a specific domain (any extension can read)
 * @param {string} domain - Domain name
 * @returns {Object|null}
 */
export function getDomainState(domain) {
    const fullState = getFullState();
    return fullState[domain] !== undefined ? fullState[domain] : null;
}

/**
 * Set state for a domain (only owner can write)
 * @param {string} domain - Domain name
 * @param {Object} data - New state data for the domain
 * @param {string} extensionId - Extension attempting to write
 * @returns {Promise<boolean>} True if write succeeded
 */
export async function setDomainState(domain, data, extensionId) {
    // Check ownership
    if (_domainOwners[domain] && _domainOwners[domain] !== extensionId) {
        console.error(`${LOG_PREFIX} Extension '${extensionId}' cannot write to domain '${domain}' (owned by '${_domainOwners[domain]}')`);
        return false;
    }

    // If domain not yet registered, register it now
    if (!_domainOwners[domain]) {
        registerDomain(domain, extensionId);
    }

    // Use mutex to prevent race conditions
    _saveMutex = _saveMutex.then(async () => {
        try {
            const fullState = getFullState();
            const oldData = fullState[domain];
            fullState[domain] = data;

            await saveFullState(fullState);

            // Emit domain changed event
            ValdrisEventBus.emit('domainChanged', {
                domain,
                data,
                oldData,
                extensionId
            });

            // Notify subscribers
            notifySubscribers(fullState);

            return true;
        } catch (error) {
            console.error(`${LOG_PREFIX} Error setting domain state:`, error);
            return false;
        }
    });

    return _saveMutex;
}

/**
 * Update specific fields within a domain (partial update)
 * @param {string} domain - Domain name
 * @param {Object} updates - Partial updates to merge
 * @param {string} extensionId - Extension attempting to write
 * @returns {Promise<boolean>}
 */
export async function updateDomainState(domain, updates, extensionId) {
    const currentData = getDomainState(domain) || {};
    const newData = deepMerge(currentData, updates);
    return setDomainState(domain, newData, extensionId);
}

/**
 * Update a specific field within a domain using dot notation
 * @param {string} domain - Domain name
 * @param {string} path - Dot-notation path (e.g., 'weather.current')
 * @param {*} value - New value
 * @param {string} extensionId - Extension attempting to write
 * @returns {Promise<boolean>}
 */
export async function updateDomainField(domain, path, value, extensionId) {
    const currentData = getDomainState(domain) || {};
    const newData = setNestedValue({ ...currentData }, path, value);
    return setDomainState(domain, newData, extensionId);
}

/**
 * Save the full state to SillyTavern chat metadata
 * @param {Object} state - Full state to save
 * @returns {Promise<boolean>}
 */
async function saveFullState(state) {
    const ctx = getSTContext();
    if (!ctx?.chatMetadata) {
        console.error(`${LOG_PREFIX} Cannot save: no chat metadata`);
        return false;
    }

    ctx.chatMetadata[CORE_META_KEY] = state;

    // Use SillyTavern's save function if available
    if (ctx.saveMetadata) {
        await ctx.saveMetadata();
    }

    return true;
}

/**
 * Subscribe to state changes
 * @param {Function} callback - Called with full state on any change
 * @returns {Function} Unsubscribe function
 */
export function subscribe(callback) {
    if (typeof callback !== 'function') {
        console.error(`${LOG_PREFIX} Subscribe callback must be a function`);
        return () => {};
    }

    _subscribers.push(callback);

    return () => {
        const idx = _subscribers.indexOf(callback);
        if (idx > -1) {
            _subscribers.splice(idx, 1);
        }
    };
}

/**
 * Notify all subscribers of state change
 * @param {Object} state - Current full state
 */
function notifySubscribers(state) {
    for (const callback of _subscribers) {
        try {
            callback(state);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error in subscriber:`, error);
        }
    }
}

/**
 * Clear all state (use with caution - mainly for testing/reset)
 * @returns {Promise<boolean>}
 */
export async function clearAllState() {
    const ctx = getSTContext();
    if (!ctx?.chatMetadata) return false;

    ctx.chatMetadata[CORE_META_KEY] = { ...DEFAULT_DOMAINS };

    if (ctx.saveMetadata) {
        await ctx.saveMetadata();
    }

    ValdrisEventBus.emit('stateCleared', {});
    notifySubscribers(ctx.chatMetadata[CORE_META_KEY]);

    console.log(`${LOG_PREFIX} All state cleared`);
    return true;
}

/**
 * Check if core state has been initialized for current chat
 * @returns {boolean}
 */
export function isInitialized() {
    const ctx = getSTContext();
    return !!(ctx?.chatMetadata?.[CORE_META_KEY]);
}

/**
 * Get the metadata key used for storage
 * @returns {string}
 */
export function getMetaKey() {
    return CORE_META_KEY;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Deep merge two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object to merge
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
    const output = { ...target };

    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            if (isObject(source[key]) && isObject(target[key])) {
                output[key] = deepMerge(target[key], source[key]);
            } else {
                output[key] = source[key];
            }
        }
    }

    return output;
}

/**
 * Check if value is a plain object
 * @param {*} item - Value to check
 * @returns {boolean}
 */
function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Set a nested value using dot notation path
 * @param {Object} obj - Object to modify
 * @param {string} path - Dot notation path
 * @param {*} value - Value to set
 * @returns {Object} Modified object
 */
function setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!current[key] || typeof current[key] !== 'object') {
            current[key] = {};
        }
        current = current[key];
    }

    current[keys[keys.length - 1]] = value;
    return obj;
}

/**
 * Get a nested value using dot notation path
 * @param {Object} obj - Object to read from
 * @param {string} path - Dot notation path
 * @param {*} defaultValue - Default if path doesn't exist
 * @returns {*}
 */
export function getNestedValue(obj, path, defaultValue = undefined) {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
        if (current === null || current === undefined || !current.hasOwnProperty(key)) {
            return defaultValue;
        }
        current = current[key];
    }

    return current;
}

/**
 * Generate a unique ID
 * @param {string} prefix - Optional prefix
 * @returns {string}
 */
export function generateId(prefix = '') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

// Export defaults
export default {
    initCoreState,
    getSTContext,
    registerDomain,
    unregisterDomain,
    isDomainOwner,
    getDomainOwner,
    getAllDomainOwners,
    getFullState,
    getDomainState,
    setDomainState,
    updateDomainState,
    updateDomainField,
    subscribe,
    clearAllState,
    isInitialized,
    getMetaKey,
    getNestedValue,
    generateId
};
