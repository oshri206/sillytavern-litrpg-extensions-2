/**
 * LoreExtractor - Automatic Lore Extraction Extension for SillyTavern
 *
 * Automatically extracts new lore (NPCs, locations, items, events, factions,
 * relationships, abilities) from roleplay messages and creates persistent
 * lorebook entries without manual intervention.
 */

// ============================================================================
// SillyTavern Module References (populated by init)
// ============================================================================

let extension_settings = {};
let getContext = null;
let saveSettingsDebounced = () => {};
let eventSource = null;
let event_types = {};
let generateQuietPrompt = null;

// ============================================================================
// Constants
// ============================================================================

const EXTENSION_NAME = 'lore-extractor';
const LOG_PREFIX = '[LoreExtractor]';
const META_KEY = 'lore_extractor_data';

// Categories for lore extraction
const LORE_CATEGORIES = {
    npc: { label: 'NPCs', icon: '👤', color: '#4a9eff' },
    location: { label: 'Locations', icon: '📍', color: '#4aff7f' },
    item: { label: 'Items', icon: '⚔️', color: '#ffaa4a' },
    event: { label: 'Events', icon: '📅', color: '#ff4a9e' },
    faction: { label: 'Factions', icon: '🏛️', color: '#9e4aff' },
    relationship: { label: 'Relationships', icon: '💫', color: '#ff4a4a' },
    ability: { label: 'Abilities', icon: '✨', color: '#4affff' },
    lore: { label: 'General Lore', icon: '📜', color: '#ffd74a' }
};

// Default settings
const DEFAULT_SETTINGS = {
    enabled: true,
    autoMode: true,
    messageInterval: 5,
    minConfidence: 0.7,
    showNotifications: true,
    injectIntoContext: true,
    categories: {
        npc: true,
        location: true,
        item: true,
        event: true,
        faction: true,
        relationship: true,
        ability: true,
        lore: true
    }
};

// Default state structure
const DEFAULT_STATE = {
    entries: [],
    messagesSinceLastExtraction: 0,
    lastExtractionTime: null,
    extractionHistory: []
};

// ============================================================================
// State Management
// ============================================================================

let state = { ...DEFAULT_STATE };

/**
 * Load state from chat metadata
 */
function loadState() {
    const context = getContext?.();
    if (!context?.chat_metadata) return;

    const saved = context.chat_metadata[META_KEY];
    if (saved) {
        state = { ...DEFAULT_STATE, ...saved };
    } else {
        state = { ...DEFAULT_STATE };
    }
    console.log(`${LOG_PREFIX} State loaded:`, state.entries.length, 'entries');
}

/**
 * Save state to chat metadata
 */
function saveState() {
    const context = getContext?.();
    if (!context?.chat_metadata) return;

    context.chat_metadata[META_KEY] = state;
    saveSettingsDebounced?.();
}

/**
 * Get current extension settings
 */
function getSettings() {
    if (!extension_settings[EXTENSION_NAME]) {
        extension_settings[EXTENSION_NAME] = { ...DEFAULT_SETTINGS };
    }
    return extension_settings[EXTENSION_NAME];
}

/**
 * Update settings
 */
function updateSettings(updates) {
    const settings = getSettings();
    Object.assign(settings, updates);
    saveSettingsDebounced?.();
    renderUI();
}

// ============================================================================
// Lore Entry Management
// ============================================================================

/**
 * Add a new lore entry
 */
function addLoreEntry(entry) {
    const id = `lore_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newEntry = {
        id,
        ...entry,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: 'auto-extracted'
    };

    state.entries.push(newEntry);
    saveState();

    console.log(`${LOG_PREFIX} Added entry:`, newEntry.name);
    return newEntry;
}

/**
 * Update an existing lore entry
 */
function updateLoreEntry(id, updates) {
    const index = state.entries.findIndex(e => e.id === id);
    if (index === -1) return null;

    state.entries[index] = {
        ...state.entries[index],
        ...updates,
        updatedAt: Date.now()
    };
    saveState();

    return state.entries[index];
}

/**
 * Find existing entry by name (case-insensitive)
 */
function findEntryByName(name) {
    const normalizedName = name.toLowerCase().trim();
    return state.entries.find(e =>
        e.name.toLowerCase().trim() === normalizedName
    );
}

/**
 * Delete a lore entry
 */
function deleteLoreEntry(id) {
    const index = state.entries.findIndex(e => e.id === id);
    if (index === -1) return false;

    state.entries.splice(index, 1);
    saveState();
    return true;
}

/**
 * Get entries by category
 */
function getEntriesByCategory(category) {
    return state.entries.filter(e => e.category === category);
}

/**
 * Get all enabled categories
 */
function getEnabledCategories() {
    const settings = getSettings();
    return Object.entries(settings.categories)
        .filter(([_, enabled]) => enabled)
        .map(([cat]) => cat);
}

// ============================================================================
// Extraction Logic
// ============================================================================

/**
 * Build the extraction prompt to send to the AI
 */
function buildExtractionPrompt(recentMessages) {
    const settings = getSettings();
    const enabledCategories = getEnabledCategories();

    const existingEntries = state.entries.map(e => e.name).join(', ') || 'None';

    return `[SYSTEM: LORE EXTRACTION REQUEST]

You are a lore extraction assistant. Analyze the following roleplay messages and extract any NEW lore information. Only extract lore that is clearly established in the text, not speculation.

ENABLED CATEGORIES: ${enabledCategories.join(', ')}

EXISTING ENTRIES (do not duplicate): ${existingEntries}

RECENT MESSAGES TO ANALYZE:
---
${recentMessages}
---

Respond ONLY with a valid JSON array. No other text before or after. Each entry must have:
- category: One of [${enabledCategories.join(', ')}]
- action: "create" for new entries, "update" if expanding existing lore
- name: The name/title of the lore element
- keys: Array of 2-5 keywords that would trigger this entry
- content: Detailed description (2-4 sentences)
- confidence: 0.0-1.0 (how certain this is real lore, not speculation)

Example response format:
[
  {
    "category": "npc",
    "action": "create",
    "name": "Eldara the Wise",
    "keys": ["Eldara", "the Wise", "old sage"],
    "content": "An ancient elven sage who lives in the Crystal Tower. She is known for her prophecies and mastery of divination magic. She wears flowing silver robes and carries a staff topped with a seeing stone.",
    "confidence": 0.9
  }
]

If no new lore is found, respond with: []

IMPORTANT:
- Only include entries with confidence >= ${settings.minConfidence}
- Do not include entries that already exist
- Focus on concrete, established facts from the roleplay
- Keep content concise but informative`;
}

/**
 * Parse AI response and extract lore entries
 */
function parseExtractionResponse(response) {
    const settings = getSettings();

    try {
        // Try to find JSON array in response
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            console.log(`${LOG_PREFIX} No JSON array found in response`);
            return [];
        }

        const parsed = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(parsed)) {
            console.log(`${LOG_PREFIX} Parsed result is not an array`);
            return [];
        }

        // Filter and validate entries
        const validEntries = parsed.filter(entry => {
            // Check required fields
            if (!entry.category || !entry.name || !entry.content || !entry.keys) {
                return false;
            }

            // Check confidence threshold
            if (typeof entry.confidence !== 'number' || entry.confidence < settings.minConfidence) {
                return false;
            }

            // Check category is enabled
            if (!settings.categories[entry.category]) {
                return false;
            }

            return true;
        });

        return validEntries;
    } catch (e) {
        console.error(`${LOG_PREFIX} Failed to parse extraction response:`, e);
        return [];
    }
}

/**
 * Get recent messages for extraction
 */
function getRecentMessages(count = 10) {
    const context = getContext?.();
    if (!context?.chat) return '';

    const messages = context.chat.slice(-count);
    return messages.map(msg => {
        const sender = msg.is_user ? 'User' : (msg.name || 'Character');
        return `[${sender}]: ${msg.mes}`;
    }).join('\n\n');
}

/**
 * Perform lore extraction
 */
async function performExtraction(manual = false) {
    const settings = getSettings();

    if (!settings.enabled && !manual) {
        return { success: false, reason: 'Extension disabled' };
    }

    const context = getContext?.();
    if (!context?.chat || context.chat.length < 3) {
        return { success: false, reason: 'Not enough messages' };
    }

    console.log(`${LOG_PREFIX} Starting extraction (manual: ${manual})`);
    showStatus('Extracting lore...');

    try {
        // Get recent messages
        const recentMessages = getRecentMessages(10);
        const prompt = buildExtractionPrompt(recentMessages);

        // Send to AI using quiet prompt
        let response;
        if (generateQuietPrompt) {
            response = await generateQuietPrompt(prompt, false, false);
        } else {
            // Fallback: try to use fetch API for generation
            response = await sendExtractionRequest(prompt);
        }

        if (!response) {
            showStatus('Extraction failed - no response');
            return { success: false, reason: 'No AI response' };
        }

        // Parse response
        const extractedEntries = parseExtractionResponse(response);

        if (extractedEntries.length === 0) {
            showStatus('No new lore found');
            console.log(`${LOG_PREFIX} No entries extracted`);
            return { success: true, entries: [], reason: 'No new lore found' };
        }

        // Process entries
        const results = {
            created: [],
            updated: [],
            skipped: []
        };

        for (const entry of extractedEntries) {
            const existing = findEntryByName(entry.name);

            if (existing) {
                if (entry.action === 'update') {
                    // Merge content
                    const updated = updateLoreEntry(existing.id, {
                        content: `${existing.content}\n\nUpdate: ${entry.content}`,
                        keys: [...new Set([...existing.keys, ...entry.keys])]
                    });
                    results.updated.push(updated);
                } else {
                    results.skipped.push(entry.name);
                }
            } else {
                const newEntry = addLoreEntry(entry);
                results.created.push(newEntry);
            }
        }

        // Update extraction tracking
        state.messagesSinceLastExtraction = 0;
        state.lastExtractionTime = Date.now();
        state.extractionHistory.push({
            timestamp: Date.now(),
            created: results.created.length,
            updated: results.updated.length
        });
        saveState();

        // Show notification
        if (settings.showNotifications && (results.created.length > 0 || results.updated.length > 0)) {
            showNotification(
                `Extracted ${results.created.length} new, ${results.updated.length} updated entries`
            );
        }

        showStatus(`Extracted ${results.created.length} new entries`);
        renderUI();

        console.log(`${LOG_PREFIX} Extraction complete:`, results);
        return { success: true, ...results };

    } catch (error) {
        console.error(`${LOG_PREFIX} Extraction error:`, error);
        showStatus('Extraction failed');
        return { success: false, reason: error.message };
    }
}

/**
 * Fallback extraction request using fetch
 */
async function sendExtractionRequest(prompt) {
    try {
        const response = await fetch('/api/backends/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: 'You are a lore extraction assistant. Respond only with valid JSON.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
    } catch (e) {
        console.error(`${LOG_PREFIX} Fallback extraction failed:`, e);
        return null;
    }
}

// ============================================================================
// Context Injection
// ============================================================================

/**
 * Build context block for lore injection
 */
function buildLoreContextBlock() {
    const settings = getSettings();
    if (!settings.injectIntoContext || state.entries.length === 0) {
        return null;
    }

    const enabledCategories = getEnabledCategories();
    const relevantEntries = state.entries.filter(e => enabledCategories.includes(e.category));

    if (relevantEntries.length === 0) return null;

    const sections = [];

    for (const category of enabledCategories) {
        const catEntries = relevantEntries.filter(e => e.category === category);
        if (catEntries.length === 0) continue;

        const catInfo = LORE_CATEGORIES[category];
        const entriesText = catEntries.map(e =>
            `- ${e.name}: ${e.content}`
        ).join('\n');

        sections.push(`[${catInfo.label}]\n${entriesText}`);
    }

    if (sections.length === 0) return null;

    return `[EXTRACTED LORE - Use this information to maintain consistency]\n${sections.join('\n\n')}`;
}

/**
 * Handle context injection before prompt generation
 */
function onPromptReady(data) {
    const settings = getSettings();

    if (!settings.enabled || !settings.injectIntoContext) {
        return;
    }

    const contextBlock = buildLoreContextBlock();
    if (!contextBlock) return;

    // Inject using extensionPrompts
    if (data.extensionPrompts) {
        data.extensionPrompts.push({
            extension: EXTENSION_NAME,
            prompt: contextBlock,
            position: 'before_system',
            depth: 0
        });
    }

    console.log(`${LOG_PREFIX} Injected ${state.entries.length} lore entries into context`);
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handle chat changed event
 */
function onChatChanged() {
    console.log(`${LOG_PREFIX} Chat changed`);
    loadState();
    renderUI();
}

/**
 * Handle message received
 */
function onMessageReceived(messageId) {
    const settings = getSettings();

    if (!settings.enabled || !settings.autoMode) return;

    const context = getContext?.();
    const message = context?.chat?.[messageId];

    // Only count AI responses
    if (!message || message.is_user) return;

    state.messagesSinceLastExtraction++;
    saveState();

    console.log(`${LOG_PREFIX} Messages since extraction: ${state.messagesSinceLastExtraction}`);

    // Check if we should extract
    if (state.messagesSinceLastExtraction >= settings.messageInterval) {
        performExtraction(false);
    }

    renderUI();
}

// ============================================================================
// UI Components
// ============================================================================

let uiMounted = false;

/**
 * Show toast notification
 */
function showNotification(message) {
    const settings = getSettings();
    if (!settings.showNotifications) return;

    // Try to use SillyTavern's toast system
    if (typeof toastr !== 'undefined') {
        toastr.info(message, 'LoreExtractor');
    } else {
        console.log(`${LOG_PREFIX} [Notification] ${message}`);
    }
}

/**
 * Show status in UI
 */
function showStatus(message) {
    const statusEl = document.getElementById('lore-extractor-status');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.classList.add('active');
        setTimeout(() => statusEl.classList.remove('active'), 3000);
    }
}

/**
 * Create the settings panel HTML
 */
function createSettingsPanel() {
    const settings = getSettings();

    const categoryToggles = Object.entries(LORE_CATEGORIES).map(([key, cat]) => `
        <label class="lore-extractor-category-toggle">
            <input type="checkbox"
                   data-category="${key}"
                   ${settings.categories[key] ? 'checked' : ''}>
            <span style="color: ${cat.color}">${cat.icon} ${cat.label}</span>
        </label>
    `).join('');

    return `
        <div id="lore-extractor-settings" class="lore-extractor-panel">
            <div class="lore-extractor-header">
                <h3>LoreExtractor</h3>
                <span id="lore-extractor-status" class="lore-extractor-status"></span>
            </div>

            <div class="lore-extractor-section">
                <label class="lore-extractor-toggle">
                    <input type="checkbox" id="lore-extractor-enabled" ${settings.enabled ? 'checked' : ''}>
                    <span>Enable LoreExtractor</span>
                </label>

                <label class="lore-extractor-toggle">
                    <input type="checkbox" id="lore-extractor-auto" ${settings.autoMode ? 'checked' : ''}>
                    <span>Auto-extraction mode</span>
                </label>

                <label class="lore-extractor-toggle">
                    <input type="checkbox" id="lore-extractor-inject" ${settings.injectIntoContext ? 'checked' : ''}>
                    <span>Inject lore into context</span>
                </label>

                <label class="lore-extractor-toggle">
                    <input type="checkbox" id="lore-extractor-notifications" ${settings.showNotifications ? 'checked' : ''}>
                    <span>Show notifications</span>
                </label>
            </div>

            <div class="lore-extractor-section">
                <label class="lore-extractor-slider-label">
                    <span>Message interval: <strong id="lore-extractor-interval-value">${settings.messageInterval}</strong></span>
                    <input type="range"
                           id="lore-extractor-interval"
                           min="1"
                           max="50"
                           value="${settings.messageInterval}">
                </label>

                <label class="lore-extractor-slider-label">
                    <span>Min confidence: <strong id="lore-extractor-confidence-value">${settings.minConfidence}</strong></span>
                    <input type="range"
                           id="lore-extractor-confidence"
                           min="0.1"
                           max="1.0"
                           step="0.1"
                           value="${settings.minConfidence}">
                </label>
            </div>

            <div class="lore-extractor-section">
                <h4>Categories</h4>
                <div class="lore-extractor-categories">
                    ${categoryToggles}
                </div>
            </div>

            <div class="lore-extractor-section">
                <button id="lore-extractor-extract-btn" class="lore-extractor-btn primary">
                    Extract Now
                </button>
                <button id="lore-extractor-view-btn" class="lore-extractor-btn">
                    View Entries (${state.entries.length})
                </button>
            </div>

            <div class="lore-extractor-info">
                <small>Messages until next extraction: ${Math.max(0, settings.messageInterval - state.messagesSinceLastExtraction)}</small>
            </div>
        </div>
    `;
}

/**
 * Create the entries viewer modal
 */
function createEntriesViewer() {
    const entriesHtml = Object.entries(LORE_CATEGORIES).map(([category, catInfo]) => {
        const entries = getEntriesByCategory(category);
        if (entries.length === 0) return '';

        const entriesListHtml = entries.map(entry => `
            <div class="lore-entry" data-id="${entry.id}">
                <div class="lore-entry-header">
                    <strong>${entry.name}</strong>
                    <button class="lore-entry-delete" data-id="${entry.id}" title="Delete">×</button>
                </div>
                <div class="lore-entry-content">${entry.content}</div>
                <div class="lore-entry-keys">
                    ${entry.keys.map(k => `<span class="lore-key">${k}</span>`).join('')}
                </div>
                <div class="lore-entry-meta">
                    Confidence: ${(entry.confidence * 100).toFixed(0)}% |
                    Created: ${new Date(entry.createdAt).toLocaleDateString()}
                </div>
            </div>
        `).join('');

        return `
            <div class="lore-category-section">
                <h4 style="color: ${catInfo.color}">${catInfo.icon} ${catInfo.label} (${entries.length})</h4>
                ${entriesListHtml}
            </div>
        `;
    }).join('');

    return `
        <div id="lore-extractor-viewer" class="lore-extractor-modal">
            <div class="lore-extractor-modal-content">
                <div class="lore-extractor-modal-header">
                    <h3>Extracted Lore Entries</h3>
                    <button id="lore-extractor-viewer-close" class="lore-extractor-modal-close">×</button>
                </div>
                <div class="lore-extractor-modal-body">
                    ${entriesHtml || '<p class="lore-extractor-empty">No entries extracted yet. Click "Extract Now" to analyze recent messages.</p>'}
                </div>
                <div class="lore-extractor-modal-footer">
                    <button id="lore-extractor-export-btn" class="lore-extractor-btn">Export JSON</button>
                    <button id="lore-extractor-clear-btn" class="lore-extractor-btn danger">Clear All</button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Mount the settings panel UI
 */
function mountUI() {
    // Find the extensions settings container
    const extensionsPanel = document.getElementById('extensions_settings');
    if (!extensionsPanel) {
        console.warn(`${LOG_PREFIX} Extensions settings panel not found, retrying...`);
        setTimeout(mountUI, 1000);
        return;
    }

    // Check if already mounted
    if (document.getElementById('lore-extractor-settings')) {
        return;
    }

    // Create container
    const container = document.createElement('div');
    container.id = 'lore-extractor-container';
    container.innerHTML = createSettingsPanel();

    extensionsPanel.appendChild(container);

    // Bind event listeners
    bindUIEvents();

    uiMounted = true;
    console.log(`${LOG_PREFIX} UI mounted`);
}

/**
 * Bind UI event listeners
 */
function bindUIEvents() {
    // Enable toggle
    document.getElementById('lore-extractor-enabled')?.addEventListener('change', (e) => {
        updateSettings({ enabled: e.target.checked });
    });

    // Auto mode toggle
    document.getElementById('lore-extractor-auto')?.addEventListener('change', (e) => {
        updateSettings({ autoMode: e.target.checked });
    });

    // Context injection toggle
    document.getElementById('lore-extractor-inject')?.addEventListener('change', (e) => {
        updateSettings({ injectIntoContext: e.target.checked });
    });

    // Notifications toggle
    document.getElementById('lore-extractor-notifications')?.addEventListener('change', (e) => {
        updateSettings({ showNotifications: e.target.checked });
    });

    // Interval slider
    document.getElementById('lore-extractor-interval')?.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        document.getElementById('lore-extractor-interval-value').textContent = value;
        updateSettings({ messageInterval: value });
    });

    // Confidence slider
    document.getElementById('lore-extractor-confidence')?.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        document.getElementById('lore-extractor-confidence-value').textContent = value.toFixed(1);
        updateSettings({ minConfidence: value });
    });

    // Category toggles
    document.querySelectorAll('.lore-extractor-category-toggle input').forEach(input => {
        input.addEventListener('change', (e) => {
            const category = e.target.dataset.category;
            const settings = getSettings();
            settings.categories[category] = e.target.checked;
            updateSettings({ categories: settings.categories });
        });
    });

    // Extract now button
    document.getElementById('lore-extractor-extract-btn')?.addEventListener('click', () => {
        performExtraction(true);
    });

    // View entries button
    document.getElementById('lore-extractor-view-btn')?.addEventListener('click', () => {
        showEntriesViewer();
    });
}

/**
 * Show the entries viewer modal
 */
function showEntriesViewer() {
    // Remove existing modal
    document.getElementById('lore-extractor-viewer')?.remove();

    // Create and show modal
    const modal = document.createElement('div');
    modal.innerHTML = createEntriesViewer();
    document.body.appendChild(modal.firstElementChild);

    // Bind modal events
    document.getElementById('lore-extractor-viewer-close')?.addEventListener('click', () => {
        document.getElementById('lore-extractor-viewer')?.remove();
    });

    // Delete entry buttons
    document.querySelectorAll('.lore-entry-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            if (confirm('Delete this entry?')) {
                deleteLoreEntry(id);
                showEntriesViewer(); // Refresh
                renderUI();
            }
        });
    });

    // Export button
    document.getElementById('lore-extractor-export-btn')?.addEventListener('click', () => {
        exportEntries();
    });

    // Clear all button
    document.getElementById('lore-extractor-clear-btn')?.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete ALL extracted lore entries? This cannot be undone.')) {
            state.entries = [];
            saveState();
            showEntriesViewer();
            renderUI();
            showNotification('All entries cleared');
        }
    });

    // Close on backdrop click
    document.getElementById('lore-extractor-viewer')?.addEventListener('click', (e) => {
        if (e.target.id === 'lore-extractor-viewer') {
            e.target.remove();
        }
    });
}

/**
 * Export entries as JSON
 */
function exportEntries() {
    const data = {
        exportedAt: new Date().toISOString(),
        entries: state.entries
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `lore-entries-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
    showNotification('Entries exported');
}

/**
 * Re-render the UI
 */
function renderUI() {
    const container = document.getElementById('lore-extractor-container');
    if (!container) {
        mountUI();
        return;
    }

    container.innerHTML = createSettingsPanel();
    bindUIEvents();
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the extension
 */
async function init() {
    console.log(`${LOG_PREFIX} Initializing LoreExtractor v1.0.0`);

    try {
        // Import SillyTavern modules
        try {
            const extModule = await import('../../../extensions.js');
            extension_settings = extModule.extension_settings;
            getContext = extModule.getContext;
            saveSettingsDebounced = extModule.saveSettingsDebounced;
        } catch (e) {
            console.error(`${LOG_PREFIX} Failed to import extensions.js`, e);
        }

        try {
            const scriptModule = await import('../../../../script.js');
            eventSource = scriptModule.eventSource;
            event_types = scriptModule.event_types;
            generateQuietPrompt = scriptModule.generateQuietPrompt;

            // Fallbacks
            if (!saveSettingsDebounced && scriptModule.saveSettingsDebounced) {
                saveSettingsDebounced = scriptModule.saveSettingsDebounced;
            }
        } catch (e) {
            console.error(`${LOG_PREFIX} Failed to import script.js`, e);
        }

        // Initialize settings
        if (!extension_settings[EXTENSION_NAME]) {
            extension_settings[EXTENSION_NAME] = { ...DEFAULT_SETTINGS };
            saveSettingsDebounced?.();
        }

        // Load state
        loadState();

        // Set up event listeners
        if (eventSource && event_types) {
            eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
            eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
            eventSource.on(event_types.GENERATE_BEFORE_COMBINE_PROMPTS, onPromptReady);
        }

        // Mount UI with delay to ensure DOM is ready
        setTimeout(mountUI, 500);

        console.log(`${LOG_PREFIX} Initialization complete`);

    } catch (error) {
        console.error(`${LOG_PREFIX} Initialization failed:`, error);
    }
}

// Initialize when script loads
init();

// ============================================================================
// Exports
// ============================================================================

export {
    performExtraction,
    addLoreEntry,
    updateLoreEntry,
    deleteLoreEntry,
    getEntriesByCategory,
    buildLoreContextBlock,
    getSettings,
    updateSettings,
    state
};

export default {
    init,
    performExtraction,
    addLoreEntry,
    getEntriesByCategory,
    buildLoreContextBlock
};
