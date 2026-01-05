/**
 * Valdris Core - Main Entry Point
 *
 * Central data bus for the Valdris extension suite.
 * Provides state management, cross-extension messaging, and AI context injection.
 *
 * Other Valdris extensions should import from this module:
 *
 * import {
 *     ValdrisEventBus,
 *     registerDomain,
 *     getDomainState,
 *     setDomainState,
 *     buildFullContext
 * } from '../valdris-core/index.js';
 */

// Import SillyTavern modules
import { getContext, extension_settings, saveSettingsDebounced } from '../../../extensions.js';
import { eventSource, event_types } from '../../../../script.js';

// Import core modules
import { ValdrisEventBus } from './event-bus.js';
import {
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
} from './core-state.js';
import {
    buildFullContext,
    buildDomainContext,
    getDefaultSettings as getContextSettings
} from './context-builder.js';

// ============================================================================
// Constants
// ============================================================================

const EXTENSION_NAME = 'valdris-core';
const LOG_PREFIX = '[ValdrisCore]';

// Default extension settings
const DEFAULT_SETTINGS = {
    enabled: true,
    debugMode: false,
    contextInjection: {
        enabled: true,
        position: 'before_system', // before_system, after_system, author_note
        includeTime: true,
        includePlayer: true,
        includeWorld: true,
        includeNPCs: true,
        includeEconomy: true,
        includeFactions: true,
        includeVex: false,
        includeNarrativeDirectives: true,
        customHeader: '',
        customFooter: ''
    },
    showStatusIndicator: true
};

// ============================================================================
// Extension State
// ============================================================================

const UI = {
    mounted: false,
    statusIndicator: null
};

// Cleanup tracking
const _cleanupFns = [];

// ============================================================================
// Settings Management
// ============================================================================

/**
 * Get current extension settings
 * @returns {Object}
 */
function getSettings() {
    if (!extension_settings[EXTENSION_NAME]) {
        extension_settings[EXTENSION_NAME] = { ...DEFAULT_SETTINGS };
    }
    return extension_settings[EXTENSION_NAME];
}

/**
 * Update extension settings
 * @param {Object} updates - Partial settings update
 */
function updateSettings(updates) {
    const settings = getSettings();
    Object.assign(settings, updates);
    saveSettingsDebounced();
}

/**
 * Get context injection settings merged with defaults
 * @returns {Object}
 */
function getContextInjectionSettings() {
    const settings = getSettings();
    return {
        ...getContextSettings(),
        ...settings.contextInjection
    };
}

// ============================================================================
// Context Injection
// ============================================================================

/**
 * Handle context injection before prompt is sent
 * @param {Object} data - Event data with prompt info
 */
function onPromptReady(data) {
    const settings = getSettings();

    if (!settings.enabled || !settings.contextInjection?.enabled) {
        return;
    }

    try {
        const contextBlock = buildFullContext(getContextInjectionSettings());

        if (!contextBlock) {
            return;
        }

        // Inject based on position setting
        const position = settings.contextInjection.position || 'before_system';

        switch (position) {
            case 'before_system':
                if (data.extensionPrompts) {
                    data.extensionPrompts.push({
                        extension: EXTENSION_NAME,
                        prompt: contextBlock,
                        position: 'before_system',
                        depth: 0
                    });
                }
                break;

            case 'after_system':
                if (data.extensionPrompts) {
                    data.extensionPrompts.push({
                        extension: EXTENSION_NAME,
                        prompt: contextBlock,
                        position: 'after_system',
                        depth: 0
                    });
                }
                break;

            case 'author_note':
                // Add to author's note section
                if (data.extensionPrompts) {
                    data.extensionPrompts.push({
                        extension: EXTENSION_NAME,
                        prompt: contextBlock,
                        position: 'in_chat',
                        depth: 4 // Typical author's note depth
                    });
                }
                break;
        }

        if (settings.debugMode) {
            console.log(`${LOG_PREFIX} Context injected:`, contextBlock.substring(0, 200) + '...');
        }
    } catch (error) {
        console.error(`${LOG_PREFIX} Error building context:`, error);
    }
}

// ============================================================================
// UI Components
// ============================================================================

/**
 * Create status indicator element
 * @returns {HTMLElement}
 */
function createStatusIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'valdris-core-status';
    indicator.className = 'valdris-core-status';
    indicator.innerHTML = `
        <div class="valdris-core-status__icon" title="Valdris Core Active">
            <svg viewBox="0 0 24 24" width="16" height="16">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
                <circle cx="12" cy="12" r="4" fill="currentColor"/>
            </svg>
        </div>
        <div class="valdris-core-status__domains"></div>
    `;

    // Add click handler for debug info
    indicator.addEventListener('click', () => {
        showDebugPanel();
    });

    return indicator;
}

/**
 * Update the status indicator
 */
function updateStatusIndicator() {
    if (!UI.statusIndicator) return;

    const domainsEl = UI.statusIndicator.querySelector('.valdris-core-status__domains');
    if (!domainsEl) return;

    const owners = getAllDomainOwners();
    const count = Object.keys(owners).length;

    domainsEl.textContent = count > 0 ? `${count} domains` : 'No domains';
    domainsEl.title = count > 0
        ? Object.entries(owners).map(([d, o]) => `${d}: ${o}`).join('\n')
        : 'No extensions registered';
}

/**
 * Show debug panel with state information
 */
function showDebugPanel() {
    // Remove existing panel if any
    const existing = document.getElementById('valdris-core-debug-panel');
    if (existing) {
        existing.remove();
        return;
    }

    const panel = document.createElement('div');
    panel.id = 'valdris-core-debug-panel';
    panel.className = 'valdris-core-debug-panel';

    const state = getFullState();
    const owners = getAllDomainOwners();
    const eventHistory = ValdrisEventBus.getHistory();

    panel.innerHTML = `
        <div class="valdris-core-debug-panel__header">
            <h3>Valdris Core Debug</h3>
            <button class="valdris-core-debug-panel__close">&times;</button>
        </div>
        <div class="valdris-core-debug-panel__content">
            <div class="valdris-core-debug-section">
                <h4>Domain Owners</h4>
                <pre>${JSON.stringify(owners, null, 2)}</pre>
            </div>
            <div class="valdris-core-debug-section">
                <h4>State Overview</h4>
                <pre>${JSON.stringify(
                    Object.fromEntries(
                        Object.entries(state).map(([k, v]) => [k, v ? '(has data)' : null])
                    ),
                    null, 2
                )}</pre>
            </div>
            <div class="valdris-core-debug-section">
                <h4>Recent Events (${eventHistory.length})</h4>
                <pre>${eventHistory.slice(-10).map(e =>
                    `${new Date(e.timestamp).toLocaleTimeString()} - ${e.event} (${e.listenerCount} listeners)`
                ).join('\n') || 'No events'}</pre>
            </div>
            <div class="valdris-core-debug-section">
                <h4>Context Preview</h4>
                <pre class="valdris-core-debug-context">${buildFullContext() || '(empty)'}</pre>
            </div>
        </div>
    `;

    // Close button handler
    panel.querySelector('.valdris-core-debug-panel__close').addEventListener('click', () => {
        panel.remove();
    });

    document.body.appendChild(panel);
}

/**
 * Mount UI elements
 */
function mountUI() {
    if (UI.mounted) return;

    const settings = getSettings();

    if (settings.showStatusIndicator) {
        UI.statusIndicator = createStatusIndicator();
        document.body.appendChild(UI.statusIndicator);
        updateStatusIndicator();
    }

    UI.mounted = true;
    console.log(`${LOG_PREFIX} UI mounted`);
}

/**
 * Unmount UI elements
 */
function unmountUI() {
    if (!UI.mounted) return;

    if (UI.statusIndicator) {
        UI.statusIndicator.remove();
        UI.statusIndicator = null;
    }

    const debugPanel = document.getElementById('valdris-core-debug-panel');
    if (debugPanel) {
        debugPanel.remove();
    }

    UI.mounted = false;
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handle chat changed event
 */
function onChatChanged() {
    console.log(`${LOG_PREFIX} Chat changed, reinitializing state`);

    // Reinitialize with new context
    const ctx = getContext();
    initCoreState(ctx);

    // Emit event for other extensions
    ValdrisEventBus.emit('chatChanged', { context: ctx });

    updateStatusIndicator();
}

/**
 * Handle message received (for auto-parsing)
 * @param {number} messageId - Message index
 */
function onMessageReceived(messageId) {
    const settings = getSettings();
    if (!settings.enabled) return;

    // Get the message
    const ctx = getContext();
    const message = ctx?.chat?.[messageId];

    if (!message || message.is_user) return;

    // Emit event for extensions that want to parse AI responses
    ValdrisEventBus.emit('aiResponseReceived', {
        messageId,
        message: message.mes,
        timestamp: Date.now()
    });
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the extension
 */
async function init() {
    console.log(`${LOG_PREFIX} Initializing Valdris Core v1.0.0`);

    try {
        // Initialize settings
        if (!extension_settings[EXTENSION_NAME]) {
            extension_settings[EXTENSION_NAME] = { ...DEFAULT_SETTINGS };
            saveSettingsDebounced();
        }

        // Initialize core state with SillyTavern context
        const ctx = getContext();
        initCoreState(ctx);

        // Set up event listeners
        const chatChangedHandler = () => onChatChanged();
        const messageReceivedHandler = (messageId) => onMessageReceived(messageId);
        const promptReadyHandler = (data) => onPromptReady(data);

        eventSource.on(event_types.CHAT_CHANGED, chatChangedHandler);
        eventSource.on(event_types.MESSAGE_RECEIVED, messageReceivedHandler);
        eventSource.on(event_types.GENERATE_BEFORE_COMBINE_PROMPTS, promptReadyHandler);

        // Track for cleanup
        _cleanupFns.push(() => {
            eventSource.off(event_types.CHAT_CHANGED, chatChangedHandler);
            eventSource.off(event_types.MESSAGE_RECEIVED, messageReceivedHandler);
            eventSource.off(event_types.GENERATE_BEFORE_COMBINE_PROMPTS, promptReadyHandler);
        });

        // Subscribe to domain changes to update UI
        const unsubscribe = subscribe(() => updateStatusIndicator());
        _cleanupFns.push(unsubscribe);

        // Enable debug mode if set
        if (getSettings().debugMode) {
            ValdrisEventBus.setDebugMode(true);
        }

        // Mount UI
        mountUI();

        console.log(`${LOG_PREFIX} Initialization complete`);

    } catch (error) {
        console.error(`${LOG_PREFIX} Initialization failed:`, error);
    }
}

/**
 * Cleanup function for extension unload
 */
function cleanup() {
    console.log(`${LOG_PREFIX} Cleaning up`);

    // Run all cleanup functions
    for (const fn of _cleanupFns) {
        try {
            fn();
        } catch (e) {
            console.error(`${LOG_PREFIX} Cleanup error:`, e);
        }
    }
    _cleanupFns.length = 0;

    // Clear event bus
    ValdrisEventBus.clear();

    // Unmount UI
    unmountUI();
}

// ============================================================================
// Public API
// ============================================================================

// Re-export everything other extensions need
export {
    // Event Bus
    ValdrisEventBus,

    // State Management
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

    // Context Building
    buildFullContext,
    buildDomainContext,

    // Utilities
    getNestedValue,
    generateId,

    // Settings
    getSettings as getCoreSettings,
    updateSettings as updateCoreSettings,
    getContextInjectionSettings,

    // Lifecycle
    cleanup
};

// Initialize when script loads
init();

// Export default object for module compatibility
export default {
    init,
    cleanup,
    ValdrisEventBus,
    registerDomain,
    getDomainState,
    setDomainState,
    buildFullContext
};
