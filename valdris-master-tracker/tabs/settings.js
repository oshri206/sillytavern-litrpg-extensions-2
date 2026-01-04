/**
 * Valdris Master Tracker - Settings Tab
 * Configure context injection, auto-parsing, and general settings
 */

import { getState, updateField, setState, recalculateDerivedStats, createEmptyState } from '../state-manager.js';
import { buildContextBlock } from '../context-utils.js';

function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class') el.className = v;
        else if (k.startsWith('on') && typeof v === 'function') {
            el.addEventListener(k.substring(2), v);
        } else if (v === false || v === null || v === undefined) continue;
        else el.setAttribute(k, String(v));
    }
    for (const c of children.flat()) {
        if (c === null || c === undefined) continue;
        if (typeof c === 'string' || typeof c === 'number') {
            el.appendChild(document.createTextNode(String(c)));
        } else {
            el.appendChild(c);
        }
    }
    return el;
}

const INJECTION_POSITIONS = [
    { value: 'authorNote', label: 'Author Note' },
    { value: 'systemPrompt', label: 'System Prompt' },
    { value: 'worldInfo', label: 'World Info' }
];

function createToggle(label, checked, onChange) {
    return h('label', { class: 'vmt_toggle' },
        h('input', { type: 'checkbox', checked: checked ? 'checked' : null, onchange: (e) => onChange(e.target.checked) }),
        h('span', { class: 'vmt_toggle_label' }, label)
    );
}

function createPatternRow(pattern, index, updatePatterns) {
    return h('div', { class: 'vmt_card vmt_pattern_row' },
        h('input', {
            type: 'text',
            class: 'vmt_input',
            value: pattern.name || '',
            placeholder: 'Name...',
            onchange: (e) => updatePatterns(index, { name: e.target.value })
        }),
        h('input', {
            type: 'text',
            class: 'vmt_input',
            value: pattern.pattern || '',
            placeholder: 'Regex pattern...',
            onchange: (e) => updatePatterns(index, { pattern: e.target.value })
        }),
        h('input', {
            type: 'text',
            class: 'vmt_input',
            value: pattern.field || '',
            placeholder: 'Field (hp/mp/xp/gold/item/status)',
            onchange: (e) => updatePatterns(index, { field: e.target.value })
        }),
        h('input', {
            type: 'text',
            class: 'vmt_input',
            value: pattern.operation || '',
            placeholder: 'Operation (+/-/set)',
            onchange: (e) => updatePatterns(index, { operation: e.target.value })
        }),
        createToggle('Enabled', pattern.enabled !== false, (value) => updatePatterns(index, { enabled: value })),
        h('button', {
            class: 'vmt_btn_icon vmt_btn_danger',
            onclick: () => updatePatterns(index, null)
        }, '')
    );
}

export function renderSettingsTab(openModal, render) {
    const state = getState();
    const settings = state.settings || {};
    const contextSettings = settings.contextInjection || {};
    const autoParsing = settings.autoParsing || {};

    const container = h('div', { class: 'vmt_tab_panel' });
    const previewEl = h('pre', { class: 'vmt_context_preview' }, buildContextBlock(state, contextSettings));

    const updatePreview = () => {
        previewEl.textContent = buildContextBlock(getState(), getState().settings?.contextInjection);
    };

    container.appendChild(
        h('div', { class: 'vmt_section' },
            h('div', { class: 'vmt_section_header' },
                h('span', { class: 'vmt_section_title' }, 'Context Injection')
            ),
            h('div', { class: 'vmt_section_body' },
                createToggle('Enabled', contextSettings.enabled, async (value) => {
                    await updateField('settings.contextInjection.enabled', value);
                    updatePreview();
                }),
                h('div', { class: 'vmt_field' },
                    h('label', { class: 'vmt_label' }, 'Position'),
                    h('select', {
                        class: 'vmt_select',
                        onchange: async (e) => {
                            await updateField('settings.contextInjection.position', e.target.value);
                            updatePreview();
                        }
                    }, ...INJECTION_POSITIONS.map(pos =>
                        h('option', { value: pos.value, selected: contextSettings.position === pos.value ? 'selected' : null }, pos.label)
                    ))
                ),
                h('div', { class: 'vmt_toggle_grid' },
                    createToggle('Include Stats', contextSettings.includeStats, async (value) => {
                        await updateField('settings.contextInjection.includeStats', value);
                        updatePreview();
                    }),
                    createToggle('Include Equipment', contextSettings.includeEquipment, async (value) => {
                        await updateField('settings.contextInjection.includeEquipment', value);
                        updatePreview();
                    }),
                    createToggle('Include Buffs/Debuffs', contextSettings.includeBuffsDebuffs, async (value) => {
                        await updateField('settings.contextInjection.includeBuffsDebuffs', value);
                        updatePreview();
                    }),
                    createToggle('Include Survival', contextSettings.includeSurvival, async (value) => {
                        await updateField('settings.contextInjection.includeSurvival', value);
                        updatePreview();
                    }),
                    createToggle('Include Resources', contextSettings.includeResources, async (value) => {
                        await updateField('settings.contextInjection.includeResources', value);
                        updatePreview();
                    })
                ),
                h('div', { class: 'vmt_grid_2' },
                    h('div', { class: 'vmt_field' },
                        h('label', { class: 'vmt_label' }, 'Custom Header'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_input',
                            value: contextSettings.customHeader || '',
                            placeholder: '[CHARACTER STATE - Name]',
                            onchange: async (e) => {
                                await updateField('settings.contextInjection.customHeader', e.target.value);
                                updatePreview();
                            }
                        })
                    ),
                    h('div', { class: 'vmt_field' },
                        h('label', { class: 'vmt_label' }, 'Custom Footer'),
                        h('input', {
                            type: 'text',
                            class: 'vmt_input',
                            value: contextSettings.customFooter || '',
                            placeholder: '[/CHARACTER STATE]',
                            onchange: async (e) => {
                                await updateField('settings.contextInjection.customFooter', e.target.value);
                                updatePreview();
                            }
                        })
                    )
                ),
                h('div', { class: 'vmt_field' },
                    h('label', { class: 'vmt_label' }, 'Preview'),
                    previewEl
                ),
                h('button', {
                    class: 'vmt_btn vmt_btn_sm',
                    onclick: updatePreview
                }, 'Test Inject')
            )
        )
    );

    const updatePatterns = async (index, patch) => {
        const patterns = [...(getState().settings?.autoParsing?.customPatterns || [])];
        if (patch === null) {
            patterns.splice(index, 1);
        } else {
            patterns[index] = { ...patterns[index], ...patch };
        }
        await updateField('settings.autoParsing.customPatterns', patterns);
    };

    container.appendChild(
        h('div', { class: 'vmt_section' },
            h('div', { class: 'vmt_section_header' },
                h('span', { class: 'vmt_section_title' }, 'Auto-Parsing')
            ),
            h('div', { class: 'vmt_section_body' },
                h('div', { class: 'vmt_toggle_grid' },
                    createToggle('Enabled', autoParsing.enabled, (value) => updateField('settings.autoParsing.enabled', value)),
                    createToggle('Auto Apply', autoParsing.autoApply, (value) => updateField('settings.autoParsing.autoApply', value)),
                    createToggle('Show Toasts', autoParsing.showToasts, (value) => updateField('settings.autoParsing.showToasts', value))
                ),
                h('div', { class: 'vmt_grid_2' },
                    h('div', { class: 'vmt_field' },
                        h('label', { class: 'vmt_label' }, 'Undo Window (sec)'),
                        h('input', {
                            type: 'number',
                            class: 'vmt_input vmt_input_sm',
                            min: 1,
                            value: autoParsing.undoWindow ?? 5,
                            onchange: (e) => updateField('settings.autoParsing.undoWindow', Number(e.target.value))
                        })
                    ),
                    h('div', { class: 'vmt_field' },
                        h('label', { class: 'vmt_label' }, 'Parse Categories'),
                        h('div', { class: 'vmt_toggle_grid' },
                            ...Object.entries(autoParsing.parseCategories || {}).map(([key, enabled]) =>
                                createToggle(key, enabled, (value) => updateField(`settings.autoParsing.parseCategories.${key}`, value))
                            )
                        )
                    )
                ),
                h('div', { class: 'vmt_section_subheader' }, 'Custom Patterns'),
                h('div', { class: 'vmt_card_list' },
                    ...(autoParsing.customPatterns || []).map((pattern, index) => createPatternRow(pattern, index, updatePatterns))
                ),
                h('button', {
                    class: 'vmt_btn vmt_btn_sm',
                    onclick: () => updatePatterns((autoParsing.customPatterns || []).length, { name: '', pattern: '', field: '', operation: '+', enabled: true })
                }, '+ Add Pattern')
            )
        )
    );

    const historyList = h('div', { class: 'vmt_card_list' },
        ...(settings.parseHistory || []).slice().reverse().map(entry =>
            h('div', { class: 'vmt_card vmt_parse_history_item' },
                h('div', { class: 'vmt_parse_history_header' },
                    h('span', { class: 'vmt_label' }, entry.timestamp || ''),
                    h('span', { class: 'vmt_text_muted' }, entry.summary || '')
                ),
                h('div', { class: 'vmt_text_muted' }, entry.message || '')
            )
        )
    );

    container.appendChild(
        h('div', { class: 'vmt_section' },
            h('div', { class: 'vmt_section_header' },
                h('span', { class: 'vmt_section_title' }, 'Parse History'),
                h('button', {
                    class: 'vmt_btn vmt_btn_sm',
                    onclick: () => updateField('settings.parseHistory', [])
                }, 'Clear History')
            ),
            historyList
        )
    );

    const exportArea = h('textarea', { class: 'vmt_textarea vmt_export_area', placeholder: 'Exported JSON will appear here...' });

    container.appendChild(
        h('div', { class: 'vmt_section' },
            h('div', { class: 'vmt_section_header' },
                h('span', { class: 'vmt_section_title' }, 'General Settings')
            ),
            h('div', { class: 'vmt_field' },
                h('label', { class: 'vmt_label' }, 'Export / Import'),
                exportArea,
                h('div', { class: 'vmt_inline_add' },
                    h('button', {
                        class: 'vmt_btn vmt_btn_sm',
                        onclick: () => {
                            exportArea.value = JSON.stringify(getState(), null, 2);
                        }
                    }, 'Export State'),
                    h('button', {
                        class: 'vmt_btn vmt_btn_sm',
                        onclick: async () => {
                            if (!exportArea.value.trim()) return;
                            try {
                                const parsed = JSON.parse(exportArea.value);
                                await setState(parsed);
                                await recalculateDerivedStats();
                                render();
                            } catch (err) {
                                console.error('[VMasterTracker] Failed to import state', err);
                            }
                        }
                    }, 'Import State'),
                    h('button', {
                        class: 'vmt_btn vmt_btn_danger',
                        onclick: async () => {
                            await setState(createEmptyState());
                            await recalculateDerivedStats();
                            render();
                        }
                    }, 'Reset to Defaults')
                )
            )
        )
    );

    return container;
}
