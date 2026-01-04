/**
 * Valdris Master Tracker - State Manager
 * Central state management with SillyTavern chat metadata persistence
 */

const META_KEY = 'vmaster_tracker_v1';

// SillyTavern module references (set by init)
let _getContext = null;
let _saveSettingsDebounced = null;

function visGenId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// State change subscribers
const _subscribers = [];

// Mutex for race condition prevention
const stateMutex = {
    _locked: false,
    _queue: [],

    async acquire() {
        return new Promise((resolve) => {
            if (!this._locked) {
                this._locked = true;
                resolve();
            } else {
                this._queue.push(resolve);
            }
        });
    },

    release() {
        if (this._queue.length > 0) {
            const next = this._queue.shift();
            next();
        } else {
            this._locked = false;
        }
    },

    async withLock(fn) {
        await this.acquire();
        try {
            return await fn();
        } finally {
            this.release();
        }
    }
};

/**
 * Create a new empty state object
 */
export function createEmptyState() {
    return {
        // Character basics
        characterName: 'Adventurer',
        currentLocation: '',

        // Vitals
        hp: { current: 100, max: 100 },
        mp: { current: 50, max: 50 },
        stamina: { current: 100, max: 100 },

        // Level & XP
        level: 1,
        xp: { current: 0, needed: 100 },

        // Active title
        activeTitle: {
            name: '',
            effects: ''
        },

        // Core attributes (STR, DEX, CON, INT, WIS, CHA)
        attributes: {
            STR: { base: 10, modifier: 0 },
            DEX: { base: 10, modifier: 0 },
            CON: { base: 10, modifier: 0 },
            INT: { base: 10, modifier: 0 },
            WIS: { base: 10, modifier: 0 },
            CHA: { base: 10, modifier: 0 }
        },

        // Derived stats (calculated from attributes)
        derivedStats: {
            attackPower: 0,
            defense: 0,
            magicPower: 0,
            critChance: 5,
            evasion: 0,
            speed: 10
        },

        // Buffs and debuffs
        buffs: [],
        debuffs: [],

        // Class system
        mainClass: {
            name: 'Adventurer',
            subclass: '',
            level: 1,
            xp: { current: 0, needed: 100 },
            features: []
        },

        // Multiclass support
        secondaryClasses: [],

        // Skills system
        skills: {
            active: [],  // { id, name, description, cooldown, resourceCost, rank, damageEffect, category }
            passive: []  // { id, name, description, effect, category }
        },

        // Proficiencies (toggleable checkboxes)
        proficiencies: {
            weapons: {
                simple: false,
                martial: false,
                exotic: false,
                ranged: false,
                twoHanded: false
            },
            armor: {
                light: false,
                medium: false,
                heavy: false,
                shields: false
            },
            tools: {
                artisan: false,
                gaming: false,
                musical: false,
                thieves: false,
                herbalism: false,
                alchemist: false,
                smith: false
            },
            languages: {
                common: true,
                elvish: false,
                dwarvish: false,
                orcish: false,
                draconic: false,
                celestial: false,
                infernal: false,
                abyssal: false
            },
            vehicles: {
                land: false,
                water: false,
                air: false
            }
        },

        // Spells system
        spells: [],  // { id, name, description, school, defaultManaCost, currentManaCost, defaultDamageEffect, currentDamageEffect, castingTime, range, duration, concentration, level }

        // Spell slots per level
        spellSlots: {
            1: { used: 0, max: 0 },
            2: { used: 0, max: 0 },
            3: { used: 0, max: 0 },
            4: { used: 0, max: 0 },
            5: { used: 0, max: 0 },
            6: { used: 0, max: 0 },
            7: { used: 0, max: 0 },
            8: { used: 0, max: 0 },
            9: { used: 0, max: 0 }
        },

        // Traits system
        traits: [],  // { id, name, description, source, mechanicalEffect, category: 'innate'|'acquired'|'racial'|'background' }

        // Titles system
        titles: [],  // { id, name, description, effects, source, rarity: 'common'|'uncommon'|'rare'|'epic'|'legendary' }
        activeTitleId: null,  // ID of the currently active title

        // Modifiers system
        modifiers: {
            permanent: [],  // { id, name, effect, value, source, type: 'buff'|'debuff' }
            temporary: [],  // { id, name, effect, value, source, type: 'buff'|'debuff', duration, remaining }
            conditional: []  // { id, name, effect, value, source, type: 'buff'|'debuff', trigger }
        },

        // Resistances (percentages)
        resistances: {
            fire: 0,
            ice: 0,
            lightning: 0,
            poison: 0,
            holy: 0,
            shadow: 0,
            physical: 0,
            arcane: 0
        },

        // Status immunities
        immunities: {
            poison: false,
            paralysis: false,
            sleep: false,
            fear: false,
            charm: false,
            stun: false,
            bleed: false,
            burn: false,
            freeze: false,
            blind: false
        },

        // Equipment system
        equipment: {
            head: null,
            chest: null,
            hands: null,
            legs: null,
            feet: null,
            back: null,
            mainHand: null,
            offHand: null,
            ring1: null,
            ring2: null,
            amulet: null,
            accessory1: null,
            accessory2: null,
            accessory3: null
        },

        // Inventory system
        inventory: [],  // { id, name, quantity, weight, value, category, description, rarity, equippable, slot, stats }

        // Currencies
        currencies: {
            gold: 0,
            silver: 0,
            copper: 0,
            custom: []  // { name, amount }
        },

        // Weight capacity
        weightCapacity: { current: 0, max: 100 },

        // Inventory view preference
        inventoryView: 'grid',  // 'grid' or 'list'

        // Legacy system
        legacy: {
            bloodline: {
                name: '',
                traits: [],
                ancestors: [],  // { name, relation, notes }
                curses: [],
                blessings: []
            },
            heirs: [],  // { name, relation, age, status, notes }
            deeds: [],  // { name, description, date, impact }
            inheritance: [],  // { item, recipient, conditions }
            house: {
                name: '',
                motto: '',
                status: 'Established',  // Rising, Established, Declining, Fallen, Extinct
                allies: [],
                enemies: []
            }
        },

        // Survival meters system
        survivalMeters: {
            hunger: { current: 100, max: 100, enabled: true, criticalThreshold: 20, notes: '' },
            thirst: { current: 100, max: 100, enabled: true, criticalThreshold: 20, notes: '' },
            fatigue: { current: 0, max: 100, enabled: true, criticalThreshold: 80, notes: '' },
            sanity: { current: 100, max: 100, enabled: true, criticalThreshold: 20, notes: '' },
            warmth: { current: 100, max: 100, enabled: true, criticalThreshold: 20, notes: '' },
            custom: []  // { id, name, current, max, color, criticalThreshold, description }
        },

        // Blessings and curses
        blessings: [
            {
                id: visGenId(),
                name: '',
                source: '',
                type: 'Blessing',
                description: '',
                effects: [],
                conditions: '',
                duration: 'Permanent',
                expiresAt: null,
                active: true
            }
        ],

        // Masteries
        masteries: [
            {
                id: visGenId(),
                name: '',
                category: 'Weapon',
                rank: 'Novice',
                currentXP: 0,
                xpToNext: 100,
                description: '',
                unlockedAbilities: [],
                nextRankAbility: ''
            }
        ],

        // Karma
        karma: {
            value: 0,
            history: [],
            factionKarma: [],
            currentEffects: []
        },

        // Limitations
        limitations: [
            {
                id: visGenId(),
                name: '',
                type: 'Weakness',
                source: '',
                description: '',
                effects: [],
                breakCondition: '',
                penalty: '',
                active: true
            }
        ],

        // Collections
        collections: {
            monsters: [],
            recipes: [],
            locations: [],
            rareItems: [],
            achievements: []
        },

        // Guilds
        guilds: [
            {
                id: visGenId(),
                name: '',
                type: 'Adventurer',
                rank: '',
                rankLevel: 0,
                reputation: 0,
                benefits: [],
                duties: [],
                joinDate: '',
                notes: '',
                isPrimary: false,
                dues: ''
            }
        ],

        // Dungeons
        dungeons: [
            {
                id: visGenId(),
                name: '',
                location: '',
                type: 'Natural',
                difficulty: 'D',
                floorsTotal: 1,
                floorsCleared: 0,
                bossesDefeated: [],
                lootObtained: [],
                status: 'Undiscovered',
                notes: ''
            }
        ],

        // Talents
        talents: {
            availablePoints: 0,
            trees: []
        },

        // Loadouts
        loadouts: [],

        // Settings
        settings: {
            contextInjection: {
                enabled: false,
                position: 'authorNote',
                includeStats: true,
                includeEquipment: true,
                includeBuffsDebuffs: true,
                includeSurvival: true,
                includeResources: true,
                customHeader: '',
                customFooter: ''
            },
            autoParsing: {
                enabled: false,
                autoApply: false,
                showToasts: true,
                undoWindow: 5,
                parseCategories: {
                    damage: true,
                    healing: true,
                    mana: true,
                    xp: true,
                    gold: true,
                    items: true,
                    status: true
                },
                customPatterns: []
            },
            parseHistory: []
        },

        // UI state
        panelCollapsed: false
    };
}

/**
 * Get SillyTavern context with fallback support
 */
function getSTContext() {
    try {
        if (typeof SillyTavern !== 'undefined' && SillyTavern?.getContext) {
            return SillyTavern.getContext();
        }
        if (_getContext && typeof _getContext === 'function') {
            return _getContext();
        }
        return null;
    } catch (e) {
        console.error('[VMasterTracker] Error getting ST context:', e);
        return null;
    }
}

/**
 * Get chat metadata object
 */
function getChatMetadata() {
    const ctx = getSTContext();
    return ctx?.chatMetadata ?? null;
}

/**
 * Save chat metadata to SillyTavern
 */
async function saveChatMetadata() {
    const ctx = getSTContext();
    if (!ctx) {
        console.warn('[VMasterTracker] Cannot save metadata: ST context unavailable');
        return false;
    }

    try {
        if (typeof ctx.saveMetadata === 'function') {
            await ctx.saveMetadata();
            return true;
        }
        if (typeof ctx.saveMetadataDebounced === 'function') {
            await ctx.saveMetadataDebounced();
            return true;
        }
        console.warn('[VMasterTracker] No save method available on ST context');
        return false;
    } catch (e) {
        console.error('[VMasterTracker] Error saving metadata:', e);
        return false;
    }
}

/**
 * Initialize the state manager with SillyTavern references
 */
export function initStateManager(getContext, saveSettingsDebounced) {
    _getContext = getContext;
    _saveSettingsDebounced = saveSettingsDebounced;
    console.log('[VMasterTracker] State manager initialized');
}

/**
 * Get the current state from chat metadata
 */
export function getState() {
    const md = getChatMetadata();
    if (!md) return createEmptyState();
    if (!md[META_KEY]) {
        md[META_KEY] = createEmptyState();
    }
    return md[META_KEY];
}

/**
 * Set the entire state (replaces current state)
 */
export async function setState(newState) {
    return await stateMutex.withLock(async () => {
        const md = getChatMetadata();
        if (md) {
            md[META_KEY] = { ...newState };
            await saveChatMetadata();
            notifySubscribers(newState);
            return true;
        }
        return false;
    });
}

/**
 * Update specific fields in the state (merges with current state)
 */
export async function updateState(updates) {
    return await stateMutex.withLock(async () => {
        const md = getChatMetadata();
        if (md) {
            if (!md[META_KEY]) {
                md[META_KEY] = createEmptyState();
            }
            md[META_KEY] = deepMerge(md[META_KEY], updates);
            await saveChatMetadata();
            notifySubscribers(md[META_KEY]);
            return true;
        }
        return false;
    });
}

/**
 * Update a specific field using a path (e.g., 'hp.current')
 */
export async function updateField(path, value) {
    return await stateMutex.withLock(async () => {
        const md = getChatMetadata();
        if (md) {
            if (!md[META_KEY]) {
                md[META_KEY] = createEmptyState();
            }
            setNestedValue(md[META_KEY], path, value);
            await saveChatMetadata();
            notifySubscribers(md[META_KEY]);
            return true;
        }
        return false;
    });
}

/**
 * Calculate derived stats from attributes
 */
export function calculateDerivedStats(attributes) {
    const getTotal = (attr) => attr.base + attr.modifier;

    const str = getTotal(attributes.STR);
    const dex = getTotal(attributes.DEX);
    const con = getTotal(attributes.CON);
    const int = getTotal(attributes.INT);
    const wis = getTotal(attributes.WIS);

    return {
        attackPower: Math.floor(str * 1.5 + dex * 0.5),
        defense: Math.floor(con * 1.2 + str * 0.3),
        magicPower: Math.floor(int * 1.5 + wis * 0.5),
        critChance: Math.min(50, 5 + Math.floor(dex * 0.3 + wis * 0.1)),
        evasion: Math.floor(dex * 0.8 + int * 0.2),
        speed: 10 + Math.floor(dex * 0.5)
    };
}

/**
 * Recalculate and update derived stats
 */
export async function recalculateDerivedStats() {
    const state = getState();
    const derived = calculateDerivedStats(state.attributes);
    await updateField('derivedStats', derived);
    return derived;
}

/**
 * Subscribe to state changes
 */
export function subscribe(callback) {
    _subscribers.push(callback);
    return () => {
        const idx = _subscribers.indexOf(callback);
        if (idx > -1) _subscribers.splice(idx, 1);
    };
}

/**
 * Notify all subscribers of state change
 */
function notifySubscribers(state) {
    for (const cb of _subscribers) {
        try {
            cb(state);
        } catch (e) {
            console.error('[VMasterTracker] Subscriber error:', e);
        }
    }
}

/**
 * Deep merge two objects
 */
function deepMerge(target, source) {
    const output = { ...target };
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
                output[key] = deepMerge(target[key], source[key]);
            } else {
                output[key] = { ...source[key] };
            }
        } else {
            output[key] = source[key];
        }
    }
    return output;
}

/**
 * Set a nested value using dot notation path
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
}

/**
 * Get a nested value using dot notation path
 */
export function getNestedValue(obj, path) {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
        if (current === null || current === undefined) return undefined;
        current = current[key];
    }
    return current;
}

// Export the META_KEY for reference
export { META_KEY };
