/**
 * Lore Extractor
 *
 * Automatically extracts lore from roleplay messages and creates lorebook entries.
 * Analyzes NPCs, locations, items, events, factions, relationships, abilities, and general lore.
 */

const EXTENSION_NAME = 'lore-extractor';
const LOG_PREFIX = '[LoreExtractor]';

// ============================================================================
// SillyTavern Module References
// ============================================================================

let getContext = null;
let extension_settings = {};
let saveSettingsDebounced = () => {};
let eventSource = null;
let event_types = {};
let getRequestHeaders = null;
let oai_settings = null;

// World Info functions
let createWorldInfoEntry = null;
let loadWorldInfo = null;
let saveWorldInfo = null;
let reloadEditor = null;
let METADATA_KEY = null;

// ============================================================================
// Default Settings
// ============================================================================

const DEFAULT_SETTINGS = {
    enabled: true,
    autoMode: true,
    messageInterval: 5,
    minConfidence: 0.7,
    showNotifications: true,
    categories: {
        npc: true,
        location: true,
        item: true,
        event: true,
        faction: true,
        relationship: true,
        ability: true,
        lore: true
    },
    targetLorebook: '', // Empty means use chat-bound lorebook
    lastProcessedMessageId: -1,
    extractionHistory: []
};

// ============================================================================
// State
// ============================================================================

let messageCounter = 0;
let isExtracting = false;
let UI = {
    settingsContainer: null,
    statusIndicator: null
};

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
// Extraction Prompt
// ============================================================================

function buildExtractionPrompt(messages) {
    const settings = getSettings();
    const enabledCategories = Object.entries(settings.categories)
        .filter(([_, enabled]) => enabled)
        .map(([cat, _]) => cat);

    const categoryDescriptions = {
        npc: 'NPCs (named characters with personality, role, appearance)',
        location: 'Locations (places, buildings, regions with descriptions)',
        item: 'Items (weapons, artifacts, consumables with properties)',
        event: 'Events (significant plot events, battles, discoveries)',
        faction: 'Factions (organizations, groups, guilds with goals)',
        relationship: 'Relationships (connections between characters/factions)',
        ability: 'Abilities (skills, spells, powers with effects)',
        lore: 'Lore (world history, myths, rules, cultural information)'
    };

    const categoriesList = enabledCategories
        .map(cat => `- ${categoryDescriptions[cat] || cat}`)
        .join('\n');

    const recentMessages = messages
        .map(m => `${m.is_user ? 'User' : 'Character'}: ${m.mes}`)
        .join('\n\n');

    return `<system>
You are a lore extraction assistant. Analyze the following roleplay messages and extract NEW lore elements that would be valuable to remember for future context.

CATEGORIES TO EXTRACT:
${categoriesList}

RULES:
1. Only extract CONCRETE, SPECIFIC information - no vague references
2. Each entry must have clear identifying keywords
3. Avoid duplicating information that would already be obvious
4. Focus on NEW information revealed in these messages
5. Set confidence based on how certain/explicit the information is (0.0-1.0)
6. Only include entries with confidence >= ${settings.minConfidence}

OUTPUT FORMAT:
Return ONLY a valid JSON array with no additional text. Each element should follow this structure:
[
  {
    "category": "npc|location|item|event|faction|relationship|ability|lore",
    "action": "create",
    "name": "Entry Name (for display)",
    "keys": ["keyword1", "keyword2", "keyword3"],
    "content": "Detailed description of this lore element. Include all relevant details.",
    "confidence": 0.0-1.0
  }
]

If no new lore is found, return an empty array: []
</system>

<recent_messages>
${recentMessages}
</recent_messages>

Extract lore from the above messages. Return ONLY the JSON array:`;
}

// ============================================================================
// Lorebook Entry Creation
// ============================================================================

async function getOrCreateChatLorebook() {
    const context = getContext();
    if (!context) {
        console.error(`${LOG_PREFIX} No context available`);
        return null;
    }

    const settings = getSettings();

    // If a target lorebook is specified in settings, use it
    if (settings.targetLorebook) {
        try {
            const data = await loadWorldInfo(settings.targetLorebook);
            if (data) {
                console.log(`${LOG_PREFIX} Using target lorebook: ${settings.targetLorebook}`);
                return { name: settings.targetLorebook, data };
            }
        } catch (e) {
            console.warn(`${LOG_PREFIX} Failed to load target lorebook:`, e);
        }
    }

    // Try to get chat-bound lorebook using METADATA_KEY (matching MemoryBooks pattern)
    // SillyTavern stores the lorebook name in chatMetadata[METADATA_KEY]
    const chatMetadata = context.chatMetadata;
    if (chatMetadata && METADATA_KEY && chatMetadata[METADATA_KEY]) {
        const lorebookName = chatMetadata[METADATA_KEY];
        console.log(`${LOG_PREFIX} Found chat-bound lorebook: ${lorebookName}`);
        try {
            const data = await loadWorldInfo(lorebookName);
            if (data) {
                console.log(`${LOG_PREFIX} Successfully loaded chat-bound lorebook: ${lorebookName}`);
                return { name: lorebookName, data };
            }
        } catch (e) {
            console.warn(`${LOG_PREFIX} Failed to load chat-bound lorebook:`, e);
        }
    } else {
        console.log(`${LOG_PREFIX} No chat-bound lorebook found. chatMetadata:`, chatMetadata, 'METADATA_KEY:', METADATA_KEY);
    }

    // Try character lorebook as fallback
    const charId = context.characterId;
    if (charId !== undefined && context.characters?.[charId]) {
        const charName = context.characters[charId].name;
        const charLorebook = charName ? `${charName}_lorebook` : null;
        if (charLorebook) {
            try {
                const data = await loadWorldInfo(charLorebook);
                if (data) {
                    console.log(`${LOG_PREFIX} Using character lorebook: ${charLorebook}`);
                    return { name: charLorebook, data };
                }
            } catch (e) {
                // Character lorebook doesn't exist - that's ok
            }
        }
    }

    console.warn(`${LOG_PREFIX} No suitable lorebook found. Please bind a lorebook to this chat.`);
    return null;
}

async function createLoreEntry(lorebook, extraction) {
    if (!createWorldInfoEntry || !lorebook?.name || !lorebook?.data) {
        console.error(`${LOG_PREFIX} Cannot create entry - missing requirements`);
        return null;
    }

    try {
        // Create the entry (matches MemoryBooks pattern)
        const newEntry = createWorldInfoEntry(lorebook.name, lorebook.data);

        if (!newEntry) {
            console.error(`${LOG_PREFIX} createWorldInfoEntry returned null`);
            return null;
        }

        // Populate the entry fields (matching MemoryBooks populateLorebookEntry)
        newEntry.key = extraction.keys || [];
        newEntry.keysecondary = [];
        newEntry.content = extraction.content || '';
        newEntry.comment = extraction.name || 'Extracted Lore';

        // Mode settings - use Constant (blue dot, always active)
        newEntry.constant = true;
        newEntry.vectorized = false;
        newEntry.selective = false;
        newEntry.selectiveLogic = 0;

        // Position: 0 = ↑Char (before character defs)
        newEntry.position = 0;
        newEntry.order = 100;
        newEntry.depth = null;  // Not used for constant entries

        // Recursion settings
        newEntry.preventRecursion = false;
        newEntry.delayUntilRecursion = true;

        // Other settings (matching MemoryBooks defaults)
        newEntry.addMemo = true;
        newEntry.disable = false;
        newEntry.excludeRecursion = false;
        newEntry.probability = 100;
        newEntry.useProbability = true;
        newEntry.group = '';
        newEntry.groupOverride = false;
        newEntry.groupWeight = 100;
        newEntry.scanDepth = null;
        newEntry.caseSensitive = null;
        newEntry.matchWholeWords = null;
        newEntry.useGroupScoring = null;
        newEntry.automationId = '';
        newEntry.role = null;
        newEntry.sticky = 0;
        newEntry.cooldown = 0;
        newEntry.delay = 0;

        // Add LoreExtractor metadata
        newEntry.loreExtractor = true;
        newEntry.loreExtractorCategory = extraction.category;
        newEntry.loreExtractorTimestamp = Date.now();

        // Save the lorebook (third param true = immediate save, matching MemoryBooks)
        await saveWorldInfo(lorebook.name, lorebook.data, true);

        console.log(`${LOG_PREFIX} Created entry: ${extraction.name}`);
        return newEntry;
    } catch (e) {
        console.error(`${LOG_PREFIX} Failed to create entry:`, e);
        return null;
    }
}

// ============================================================================
// AI Completion Request (matches MemoryBooks pattern)
// ============================================================================

/**
 * Send a completion request to the AI backend
 * Based on MemoryBooks' sendRawCompletionRequest implementation
 */
async function sendCompletionRequest(prompt) {
    const url = '/api/backends/chat-completions/generate';
    const headers = getRequestHeaders();

    // Get current API settings
    const api = oai_settings?.chat_completion_source || 'openai';
    const model = oai_settings?.openai_model || '';

    // Determine max tokens - use settings or default to a reasonable value
    const maxTokens = Math.max(
        Number(oai_settings?.openai_max_tokens) || 0,
        Number(oai_settings?.max_response) || 0,
        2000  // Minimum default for extraction tasks
    );

    const body = {
        messages: [
            { role: 'user', content: prompt }
        ],
        model: model,
        temperature: 0.7,
        chat_completion_source: api,
        max_tokens: maxTokens,
        stream: false,  // Important: disable streaming to get complete response
    };

    console.log(`${LOG_PREFIX} Sending request to ${url}`);
    console.log(`${LOG_PREFIX} API: ${api}, Model: ${model}, Max tokens: ${maxTokens}`);
    console.log(`${LOG_PREFIX} Request body:`, JSON.stringify(body).substring(0, 500) + '...');

    // Add timeout using AbortController (2 minutes)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.error(`${LOG_PREFIX} Request timed out after 120 seconds`);
        controller.abort();
    }, 120000);

    let res;
    try {
        console.log(`${LOG_PREFIX} Starting fetch...`);
        res = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        console.log(`${LOG_PREFIX} Fetch completed with status: ${res.status}`);
    } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
            throw new Error('AI request timed out after 120 seconds');
        }
        console.error(`${LOG_PREFIX} Fetch error:`, fetchError);
        throw fetchError;
    } finally {
        clearTimeout(timeoutId);
    }

    if (!res.ok) {
        let errorText = '';
        try {
            errorText = await res.text();
        } catch (e) {
            errorText = '(could not read error body)';
        }
        console.error(`${LOG_PREFIX} Response not OK: ${res.status} ${res.statusText}`);
        console.error(`${LOG_PREFIX} Error body: ${errorText}`);
        throw new Error(`AI request failed: ${res.status} ${res.statusText} - ${errorText}`);
    }

    console.log(`${LOG_PREFIX} Reading response body...`);
    let data;
    try {
        const responseText = await res.text();
        console.log(`${LOG_PREFIX} Raw response text (first 500 chars): ${responseText.substring(0, 500)}`);
        data = JSON.parse(responseText);
        console.log(`${LOG_PREFIX} Response parsed successfully`);
    } catch (parseError) {
        console.error(`${LOG_PREFIX} Failed to parse response:`, parseError);
        throw new Error('Failed to parse AI response as JSON');
    }

    // Extract text from various response formats (matching MemoryBooks)
    let text = '';

    if (data.choices?.[0]?.message?.content) {
        text = data.choices[0].message.content;
        console.log(`${LOG_PREFIX} Extracted from choices[0].message.content`);
    } else if (data.completion) {
        text = data.completion;
        console.log(`${LOG_PREFIX} Extracted from completion`);
    } else if (data.choices?.[0]?.text) {
        text = data.choices[0].text;
        console.log(`${LOG_PREFIX} Extracted from choices[0].text`);
    } else if (data.content && Array.isArray(data.content)) {
        // Handle Claude's structured format
        const textBlock = data.content.find(block =>
            block && typeof block === 'object' && block.type === 'text' && block.text
        );
        text = textBlock?.text || '';
        console.log(`${LOG_PREFIX} Extracted from content array`);
    } else if (typeof data.content === 'string') {
        text = data.content;
        console.log(`${LOG_PREFIX} Extracted from content string`);
    } else {
        console.warn(`${LOG_PREFIX} Unknown response format:`, JSON.stringify(data).substring(0, 500));
    }

    console.log(`${LOG_PREFIX} Response text length: ${text.length}`);
    return text;
}

// ============================================================================
// Extraction Logic
// ============================================================================

async function extractLore(forceExtract = false) {
    if (isExtracting) {
        console.log(`${LOG_PREFIX} Extraction already in progress`);
        return;
    }

    const settings = getSettings();

    if (!settings.enabled) {
        return;
    }

    const context = getContext();
    if (!context?.chat || context.chat.length === 0) {
        console.log(`${LOG_PREFIX} No chat messages to analyze`);
        return;
    }

    isExtracting = true;
    updateStatusIndicator('extracting');

    try {
        // Get recent messages (last N messages based on interval)
        const messagesToAnalyze = Math.min(settings.messageInterval * 2, 20);
        const recentMessages = context.chat.slice(-messagesToAnalyze);

        if (recentMessages.length === 0) {
            console.log(`${LOG_PREFIX} No messages to analyze`);
            return;
        }

        // Build extraction prompt
        const prompt = buildExtractionPrompt(recentMessages);

        console.log(`${LOG_PREFIX} Sending extraction request...`);

        // Send to AI using direct API call (matches MemoryBooks pattern)
        let response;
        try {
            if (!getRequestHeaders) {
                console.error(`${LOG_PREFIX} getRequestHeaders not available`);
                showNotification('Extraction failed: API not available', 'error');
                return;
            }

            response = await sendCompletionRequest(prompt);
            console.log(`${LOG_PREFIX} Raw response:`, response);
        } catch (e) {
            console.error(`${LOG_PREFIX} AI request failed:`, e);
            showNotification('Extraction failed: ' + e.message, 'error');
            return;
        }

        if (!response) {
            console.log(`${LOG_PREFIX} No response from AI`);
            showNotification('Extraction failed: Empty response from AI', 'error');
            return;
        }

        // Parse response
        let extractions;
        try {
            // Try to extract JSON from response
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                extractions = JSON.parse(jsonMatch[0]);
            } else {
                extractions = JSON.parse(response);
            }
        } catch (e) {
            console.error(`${LOG_PREFIX} Failed to parse AI response:`, e);
            console.log(`${LOG_PREFIX} Raw response:`, response);
            showNotification('Extraction failed: Invalid JSON response', 'error');
            return;
        }

        if (!Array.isArray(extractions)) {
            console.log(`${LOG_PREFIX} Response is not an array`);
            return;
        }

        // Filter by confidence
        const validExtractions = extractions.filter(e =>
            e &&
            e.confidence >= settings.minConfidence &&
            e.name &&
            e.content &&
            e.keys?.length > 0
        );

        if (validExtractions.length === 0) {
            console.log(`${LOG_PREFIX} No valid extractions found`);
            updateStatusIndicator('idle');
            return;
        }

        // Get lorebook
        const lorebook = await getOrCreateChatLorebook();
        if (!lorebook) {
            showNotification('No lorebook available. Please bind a lorebook to this chat.', 'warning');
            return;
        }

        // Create entries
        let createdCount = 0;
        for (const extraction of validExtractions) {
            const entry = await createLoreEntry(lorebook, extraction);
            if (entry) {
                createdCount++;

                // Track in history
                settings.extractionHistory.push({
                    name: extraction.name,
                    category: extraction.category,
                    timestamp: Date.now(),
                    keys: extraction.keys
                });
            }
        }

        // Keep history manageable
        if (settings.extractionHistory.length > 100) {
            settings.extractionHistory = settings.extractionHistory.slice(-100);
        }

        saveSettingsDebounced();

        // Reload editor if open
        if (reloadEditor) {
            try {
                await reloadEditor(lorebook.name);
            } catch (e) {
                // Editor might not be open
            }
        }

        // Show notification
        if (createdCount > 0 && settings.showNotifications) {
            showNotification(`Extracted ${createdCount} lore ${createdCount === 1 ? 'entry' : 'entries'}`, 'success');
        }

        console.log(`${LOG_PREFIX} Created ${createdCount} entries from ${validExtractions.length} extractions`);

    } catch (e) {
        console.error(`${LOG_PREFIX} Extraction error:`, e);
        showNotification('Extraction failed: ' + e.message, 'error');
    } finally {
        isExtracting = false;
        updateStatusIndicator('idle');
    }
}

// ============================================================================
// Event Handlers
// ============================================================================

function onMessageReceived(messageId) {
    const settings = getSettings();

    if (!settings.enabled || !settings.autoMode) {
        return;
    }

    messageCounter++;

    if (messageCounter >= settings.messageInterval) {
        messageCounter = 0;
        console.log(`${LOG_PREFIX} Triggering auto-extraction after ${settings.messageInterval} messages`);
        extractLore();
    }
}

function onChatChanged() {
    messageCounter = 0;
    updateStatusIndicator('idle');
}

// ============================================================================
// UI Components
// ============================================================================

function showNotification(message, type = 'info') {
    const settings = getSettings();
    if (!settings.showNotifications && type !== 'error') {
        return;
    }

    // Try to use SillyTavern's toast system
    if (typeof toastr !== 'undefined') {
        switch (type) {
            case 'success':
                toastr.success(message, 'Lore Extractor');
                break;
            case 'error':
                toastr.error(message, 'Lore Extractor');
                break;
            case 'warning':
                toastr.warning(message, 'Lore Extractor');
                break;
            default:
                toastr.info(message, 'Lore Extractor');
        }
    } else {
        console.log(`${LOG_PREFIX} [${type.toUpperCase()}] ${message}`);
    }
}

function updateStatusIndicator(status) {
    if (!UI.statusIndicator) return;

    UI.statusIndicator.className = `le_status le_status_${status}`;

    const statusText = {
        idle: 'Ready',
        extracting: 'Extracting...',
        disabled: 'Disabled'
    };

    UI.statusIndicator.textContent = statusText[status] || status;
}

function createSettingsHTML() {
    const settings = getSettings();

    return `
        <div class="le_settings_container">
            <div class="le_settings_header">
                <h3>Lore Extractor</h3>
                <div id="le_status" class="le_status le_status_idle">Ready</div>
            </div>

            <div class="le_settings_section">
                <div class="le_setting_row">
                    <label class="le_checkbox_label">
                        <input type="checkbox" id="le_enabled" ${settings.enabled ? 'checked' : ''}>
                        <span>Enable Lore Extractor</span>
                    </label>
                </div>

                <div class="le_setting_row">
                    <label class="le_checkbox_label">
                        <input type="checkbox" id="le_auto_mode" ${settings.autoMode ? 'checked' : ''}>
                        <span>Auto Mode (extract automatically)</span>
                    </label>
                </div>

                <div class="le_setting_row">
                    <label>Message Interval</label>
                    <div class="le_slider_container">
                        <input type="range" id="le_interval" min="1" max="50" value="${settings.messageInterval}">
                        <span id="le_interval_value">${settings.messageInterval}</span>
                    </div>
                </div>

                <div class="le_setting_row">
                    <label>Min Confidence</label>
                    <div class="le_slider_container">
                        <input type="range" id="le_confidence" min="0" max="100" value="${settings.minConfidence * 100}">
                        <span id="le_confidence_value">${(settings.minConfidence * 100).toFixed(0)}%</span>
                    </div>
                </div>

                <div class="le_setting_row">
                    <label class="le_checkbox_label">
                        <input type="checkbox" id="le_notifications" ${settings.showNotifications ? 'checked' : ''}>
                        <span>Show Notifications</span>
                    </label>
                </div>
            </div>

            <div class="le_settings_section">
                <h4>Categories</h4>
                <div class="le_categories_grid">
                    <label class="le_checkbox_label">
                        <input type="checkbox" id="le_cat_npc" ${settings.categories.npc ? 'checked' : ''}>
                        <span>NPCs</span>
                    </label>
                    <label class="le_checkbox_label">
                        <input type="checkbox" id="le_cat_location" ${settings.categories.location ? 'checked' : ''}>
                        <span>Locations</span>
                    </label>
                    <label class="le_checkbox_label">
                        <input type="checkbox" id="le_cat_item" ${settings.categories.item ? 'checked' : ''}>
                        <span>Items</span>
                    </label>
                    <label class="le_checkbox_label">
                        <input type="checkbox" id="le_cat_event" ${settings.categories.event ? 'checked' : ''}>
                        <span>Events</span>
                    </label>
                    <label class="le_checkbox_label">
                        <input type="checkbox" id="le_cat_faction" ${settings.categories.faction ? 'checked' : ''}>
                        <span>Factions</span>
                    </label>
                    <label class="le_checkbox_label">
                        <input type="checkbox" id="le_cat_relationship" ${settings.categories.relationship ? 'checked' : ''}>
                        <span>Relationships</span>
                    </label>
                    <label class="le_checkbox_label">
                        <input type="checkbox" id="le_cat_ability" ${settings.categories.ability ? 'checked' : ''}>
                        <span>Abilities</span>
                    </label>
                    <label class="le_checkbox_label">
                        <input type="checkbox" id="le_cat_lore" ${settings.categories.lore ? 'checked' : ''}>
                        <span>Lore</span>
                    </label>
                </div>
            </div>

            <div class="le_settings_section">
                <h4>Actions</h4>
                <div class="le_actions_row">
                    <button id="le_extract_now" class="le_btn le_btn_primary">
                        Extract Now
                    </button>
                    <button id="le_view_history" class="le_btn">
                        View History (${settings.extractionHistory.length})
                    </button>
                </div>
            </div>

            <div id="le_history_panel" class="le_history_panel le_hidden">
                <h4>Recent Extractions</h4>
                <div id="le_history_list" class="le_history_list"></div>
            </div>
        </div>
    `;
}

function bindSettingsEvents() {
    const settings = getSettings();

    // Status indicator reference
    UI.statusIndicator = document.getElementById('le_status');

    // Enable toggle
    document.getElementById('le_enabled')?.addEventListener('change', (e) => {
        updateSettings({ enabled: e.target.checked });
        updateStatusIndicator(e.target.checked ? 'idle' : 'disabled');
    });

    // Auto mode toggle
    document.getElementById('le_auto_mode')?.addEventListener('change', (e) => {
        updateSettings({ autoMode: e.target.checked });
    });

    // Message interval slider
    const intervalSlider = document.getElementById('le_interval');
    const intervalValue = document.getElementById('le_interval_value');
    intervalSlider?.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        intervalValue.textContent = val;
        updateSettings({ messageInterval: val });
    });

    // Confidence slider
    const confSlider = document.getElementById('le_confidence');
    const confValue = document.getElementById('le_confidence_value');
    confSlider?.addEventListener('input', (e) => {
        const val = parseInt(e.target.value) / 100;
        confValue.textContent = `${(val * 100).toFixed(0)}%`;
        updateSettings({ minConfidence: val });
    });

    // Notifications toggle
    document.getElementById('le_notifications')?.addEventListener('change', (e) => {
        updateSettings({ showNotifications: e.target.checked });
    });

    // Category toggles
    const categories = ['npc', 'location', 'item', 'event', 'faction', 'relationship', 'ability', 'lore'];
    for (const cat of categories) {
        document.getElementById(`le_cat_${cat}`)?.addEventListener('change', (e) => {
            const newCategories = { ...settings.categories, [cat]: e.target.checked };
            updateSettings({ categories: newCategories });
        });
    }

    // Extract now button
    document.getElementById('le_extract_now')?.addEventListener('click', () => {
        extractLore(true);
    });

    // View history button
    document.getElementById('le_view_history')?.addEventListener('click', () => {
        const panel = document.getElementById('le_history_panel');
        const list = document.getElementById('le_history_list');

        if (panel.classList.contains('le_hidden')) {
            panel.classList.remove('le_hidden');

            // Populate history
            const history = settings.extractionHistory.slice().reverse();
            if (history.length === 0) {
                list.innerHTML = '<div class="le_history_empty">No extractions yet</div>';
            } else {
                list.innerHTML = history.slice(0, 20).map(h => `
                    <div class="le_history_item">
                        <span class="le_history_category">${h.category}</span>
                        <span class="le_history_name">${h.name}</span>
                        <span class="le_history_time">${new Date(h.timestamp).toLocaleString()}</span>
                    </div>
                `).join('');
            }
        } else {
            panel.classList.add('le_hidden');
        }
    });

    // Update status
    updateStatusIndicator(settings.enabled ? 'idle' : 'disabled');
}

// ============================================================================
// Initialization
// ============================================================================

async function init() {
    console.log(`${LOG_PREFIX} Initializing...`);

    try {
        // Import SillyTavern modules
        try {
            const extModule = await import('../../../extensions.js');
            getContext = extModule.getContext;
            extension_settings = extModule.extension_settings;
        } catch (e) {
            console.error(`${LOG_PREFIX} Failed to import extensions.js:`, e);
            return;
        }

        try {
            const scriptModule = await import('../../../../script.js');
            eventSource = scriptModule.eventSource;
            event_types = scriptModule.event_types;
            saveSettingsDebounced = scriptModule.saveSettingsDebounced;
            getRequestHeaders = scriptModule.getRequestHeaders;
        } catch (e) {
            console.error(`${LOG_PREFIX} Failed to import script.js:`, e);
            return;
        }

        // Import OpenAI settings for model info
        try {
            const openaiModule = await import('../../../openai.js');
            oai_settings = openaiModule.oai_settings;
        } catch (e) {
            console.warn(`${LOG_PREFIX} Failed to import openai.js:`, e);
            // Non-fatal - we can work without it
        }

        // Import world-info functions
        try {
            const worldInfoModule = await import('../../../world-info.js');
            createWorldInfoEntry = worldInfoModule.createWorldInfoEntry;
            loadWorldInfo = worldInfoModule.loadWorldInfo;
            saveWorldInfo = worldInfoModule.saveWorldInfo;
            reloadEditor = worldInfoModule.reloadEditor;
            METADATA_KEY = worldInfoModule.METADATA_KEY;
        } catch (e) {
            console.error(`${LOG_PREFIX} Failed to import world-info.js:`, e);
            return;
        }

        // Initialize settings
        if (!extension_settings[EXTENSION_NAME]) {
            extension_settings[EXTENSION_NAME] = { ...DEFAULT_SETTINGS };
            saveSettingsDebounced();
        }

        // Register event listeners
        if (eventSource && event_types) {
            eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
            eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
        }

        // Add settings panel to extensions
        const settingsHtml = createSettingsHTML();

        // Try to add to extensions panel
        const extensionsPanel = document.getElementById('extensions_settings');
        if (extensionsPanel) {
            const container = document.createElement('div');
            container.id = 'le_extension_settings';
            container.innerHTML = settingsHtml;
            extensionsPanel.appendChild(container);
            bindSettingsEvents();
        } else {
            // Fallback: wait for DOM and try again
            const observer = new MutationObserver((mutations, obs) => {
                const panel = document.getElementById('extensions_settings');
                if (panel) {
                    const container = document.createElement('div');
                    container.id = 'le_extension_settings';
                    container.innerHTML = settingsHtml;
                    panel.appendChild(container);
                    bindSettingsEvents();
                    obs.disconnect();
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });

            // Cleanup after 30 seconds
            setTimeout(() => observer.disconnect(), 30000);
        }

        console.log(`${LOG_PREFIX} Initialization complete`);

    } catch (e) {
        console.error(`${LOG_PREFIX} Initialization failed:`, e);
    }
}

// ============================================================================
// Public API
// ============================================================================

window.LoreExtractor = {
    extract: () => extractLore(true),
    getSettings: () => getSettings(),
    updateSettings: (updates) => updateSettings(updates),
    isExtracting: () => isExtracting
};

// Initialize
init();

export { extractLore, getSettings, updateSettings };
