/**
 * Valdris Master Tracker - Survival Meters Tab
 * Track survival-related resource bars (Hunger, Thirst, Fatigue, Sanity, Warmth, Custom)
 */

import { getState, updateField } from '../state-manager.js';

/**
 * Helper function to create DOM elements
 */
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

/**
 * Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Default survival meter definitions
 */
const DEFAULT_METERS = {
    hunger: { label: 'Hunger', icon: '', defaultCritical: 20, inverted: false },
    thirst: { label: 'Thirst', icon: '', defaultCritical: 20, inverted: false },
    fatigue: { label: 'Fatigue', icon: '', defaultCritical: 80, inverted: true }, // Higher is worse
    sanity: { label: 'Sanity', icon: '', defaultCritical: 20, inverted: false },
    warmth: { label: 'Warmth', icon: '', defaultCritical: 20, inverted: false }
};

// View state (compact vs expanded)
let viewMode = 'expanded';

/**
 * Get meter status class based on value and threshold
 */
function getMeterStatus(current, max, criticalThreshold, inverted = false) {
    const percent = (current / max) * 100;

    if (inverted) {
        // For inverted meters like fatigue, higher is worse
        if (percent >= criticalThreshold) return 'critical';
        if (percent >= criticalThreshold - 20) return 'warning';
        return 'healthy';
    } else {
        // For normal meters, lower is worse
        if (percent <= criticalThreshold) return 'critical';
        if (percent <= criticalThreshold + 20) return 'warning';
        return 'healthy';
    }
}

/**
 * Get fill color based on status
 */
function getFillColor(status, customColor = null) {
    if (customColor) {
        // For custom meters, adjust color based on status
        if (status === 'critical') return '#ef4444';
        if (status === 'warning') return '#f59e0b';
        return customColor;
    }

    switch (status) {
        case 'critical': return 'linear-gradient(90deg, #f87171, #ef4444)';
        case 'warning': return 'linear-gradient(90deg, #fbbf24, #f59e0b)';
        default: return 'linear-gradient(90deg, #4ade80, #22c55e)';
    }
}

/**
 * Create a survival meter bar component
 */
function createMeterBar(key, meter, meterDef, basePath, render, showDetails = true) {
    const current = meter.current ?? 100;
    const max = meter.max ?? 100;
    const criticalThreshold = meter.criticalThreshold ?? meterDef?.defaultCritical ?? 20;
    const inverted = meterDef?.inverted ?? false;
    const enabled = meter.enabled !== false;

    const percent = Math.min(100, Math.max(0, (current / max) * 100));
    const status = getMeterStatus(current, max, criticalThreshold, inverted);
    const fillColor = getFillColor(status, meter.color);

    const meterContainer = h('div', {
        class: `vmt_survival_meter ${!enabled ? 'vmt_meter_disabled' : ''} ${status === 'critical' ? 'vmt_meter_critical' : ''}`
    },
        // Meter header
        h('div', { class: 'vmt_meter_header' },
            h('div', { class: 'vmt_meter_label_row' },
                meterDef?.icon ? h('span', { class: 'vmt_meter_icon' }, meterDef.icon) : null,
                h('span', { class: 'vmt_meter_label' }, meterDef?.label || meter.name || key),
                status === 'critical' ? h('span', { class: 'vmt_meter_warning_icon' }, '!') : null
            ),
            h('div', { class: 'vmt_meter_value_display' },
                h('span', { class: 'vmt_meter_current' }, current),
                h('span', { class: 'vmt_meter_separator' }, '/'),
                h('span', { class: 'vmt_meter_max' }, max)
            )
        ),

        // Meter bar
        h('div', { class: 'vmt_meter_bar_container' },
            h('div', { class: 'vmt_meter_bar' },
                h('div', {
                    class: `vmt_meter_fill vmt_meter_${status}`,
                    style: `width: ${percent}%; background: ${fillColor}`
                })
            )
        ),

        // Controls (only in expanded view)
        showDetails ? h('div', { class: 'vmt_meter_controls' },
            // Quick adjust buttons
            h('div', { class: 'vmt_meter_quick_adjust' },
                h('button', {
                    class: 'vmt_btn vmt_btn_sm',
                    onclick: () => {
                        const newVal = Math.max(0, current - 10);
                        updateField(`${basePath}.current`, newVal);
                    }
                }, '-10'),
                h('button', {
                    class: 'vmt_btn vmt_btn_sm',
                    onclick: () => {
                        const newVal = Math.max(0, current - 1);
                        updateField(`${basePath}.current`, newVal);
                    }
                }, '-1'),
                h('input', {
                    type: 'number',
                    class: 'vmt_meter_input',
                    value: current,
                    min: 0,
                    max: max,
                    onchange: (e) => {
                        const val = Math.min(max, Math.max(0, parseInt(e.target.value) || 0));
                        updateField(`${basePath}.current`, val);
                    }
                }),
                h('button', {
                    class: 'vmt_btn vmt_btn_sm',
                    onclick: () => {
                        const newVal = Math.min(max, current + 1);
                        updateField(`${basePath}.current`, newVal);
                    }
                }, '+1'),
                h('button', {
                    class: 'vmt_btn vmt_btn_sm',
                    onclick: () => {
                        const newVal = Math.min(max, current + 10);
                        updateField(`${basePath}.current`, newVal);
                    }
                }, '+10')
            ),

            // Max and threshold settings
            h('div', { class: 'vmt_meter_settings' },
                h('label', { class: 'vmt_meter_setting' },
                    h('span', {}, 'Max:'),
                    h('input', {
                        type: 'number',
                        class: 'vmt_meter_input vmt_input_sm',
                        value: max,
                        min: 1,
                        onchange: (e) => {
                            const val = Math.max(1, parseInt(e.target.value) || 100);
                            updateField(`${basePath}.max`, val);
                        }
                    })
                ),
                h('label', { class: 'vmt_meter_setting' },
                    h('span', {}, 'Crit:'),
                    h('input', {
                        type: 'number',
                        class: 'vmt_meter_input vmt_input_sm',
                        value: criticalThreshold,
                        min: 0,
                        max: 100,
                        onchange: (e) => {
                            const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 20));
                            updateField(`${basePath}.criticalThreshold`, val);
                        }
                    })
                )
            ),

            // Notes
            meter.notes !== undefined ? h('div', { class: 'vmt_meter_notes' },
                h('input', {
                    type: 'text',
                    class: 'vmt_input vmt_input_sm',
                    value: meter.notes || '',
                    placeholder: 'Notes...',
                    onchange: (e) => updateField(`${basePath}.notes`, e.target.value)
                })
            ) : null
        ) : null
    );

    return meterContainer;
}

/**
 * Create toggle switch for meter visibility
 */
function createMeterToggle(key, meter, basePath) {
    const enabled = meter.enabled !== false;

    return h('label', { class: 'vmt_meter_toggle' },
        h('input', {
            type: 'checkbox',
            checked: enabled,
            onchange: (e) => updateField(`${basePath}.enabled`, e.target.checked)
        }),
        h('span', { class: 'vmt_toggle_slider' }),
        h('span', { class: 'vmt_toggle_label' }, DEFAULT_METERS[key]?.label || key)
    );
}

/**
 * Create custom meter card
 */
function createCustomMeterCard(meter, index, openModal, render) {
    const current = meter.current ?? 100;
    const max = meter.max ?? 100;
    const criticalThreshold = meter.criticalThreshold ?? 20;
    const percent = Math.min(100, Math.max(0, (current / max) * 100));
    const status = getMeterStatus(current, max, criticalThreshold, false);
    const fillColor = meter.color || '#b380ff';
    const displayColor = status === 'critical' ? '#ef4444' : (status === 'warning' ? '#f59e0b' : fillColor);

    return h('div', { class: `vmt_custom_meter_card ${status === 'critical' ? 'vmt_meter_critical' : ''}` },
        h('div', { class: 'vmt_custom_meter_header' },
            h('div', { class: 'vmt_custom_meter_name_row' },
                h('div', {
                    class: 'vmt_custom_meter_color_swatch',
                    style: `background: ${meter.color || '#b380ff'}`
                }),
                h('span', { class: 'vmt_custom_meter_name' }, meter.name || 'Custom Meter'),
                status === 'critical' ? h('span', { class: 'vmt_meter_warning_icon' }, '!') : null
            ),
            h('div', { class: 'vmt_custom_meter_actions' },
                h('button', {
                    class: 'vmt_btn_icon',
                    onclick: () => openModal('edit-custom-meter', index),
                    title: 'Edit'
                }, ''),
                h('button', {
                    class: 'vmt_btn_icon vmt_btn_danger',
                    onclick: () => {
                        const state = getState();
                        const custom = [...(state.survivalMeters?.custom || [])];
                        custom.splice(index, 1);
                        updateField('survivalMeters.custom', custom);
                    },
                    title: 'Remove'
                }, '')
            )
        ),

        // Bar
        h('div', { class: 'vmt_meter_bar_container' },
            h('div', { class: 'vmt_meter_bar' },
                h('div', {
                    class: `vmt_meter_fill vmt_meter_${status}`,
                    style: `width: ${percent}%; background: ${displayColor}`
                })
            ),
            h('div', { class: 'vmt_meter_value_overlay' },
                `${current} / ${max}`
            )
        ),

        // Quick adjust
        h('div', { class: 'vmt_meter_quick_adjust' },
            h('button', {
                class: 'vmt_btn vmt_btn_sm',
                onclick: () => {
                    const custom = [...(getState().survivalMeters?.custom || [])];
                    custom[index] = { ...custom[index], current: Math.max(0, current - 10) };
                    updateField('survivalMeters.custom', custom);
                }
            }, '-10'),
            h('button', {
                class: 'vmt_btn vmt_btn_sm',
                onclick: () => {
                    const custom = [...(getState().survivalMeters?.custom || [])];
                    custom[index] = { ...custom[index], current: Math.max(0, current - 1) };
                    updateField('survivalMeters.custom', custom);
                }
            }, '-1'),
            h('input', {
                type: 'number',
                class: 'vmt_meter_input',
                value: current,
                min: 0,
                max: max,
                onchange: (e) => {
                    const val = Math.min(max, Math.max(0, parseInt(e.target.value) || 0));
                    const custom = [...(getState().survivalMeters?.custom || [])];
                    custom[index] = { ...custom[index], current: val };
                    updateField('survivalMeters.custom', custom);
                }
            }),
            h('button', {
                class: 'vmt_btn vmt_btn_sm',
                onclick: () => {
                    const custom = [...(getState().survivalMeters?.custom || [])];
                    custom[index] = { ...custom[index], current: Math.min(max, current + 1) };
                    updateField('survivalMeters.custom', custom);
                }
            }, '+1'),
            h('button', {
                class: 'vmt_btn vmt_btn_sm',
                onclick: () => {
                    const custom = [...(getState().survivalMeters?.custom || [])];
                    custom[index] = { ...custom[index], current: Math.min(max, current + 10) };
                    updateField('survivalMeters.custom', custom);
                }
            }, '+10')
        ),

        // Description
        meter.description ? h('div', { class: 'vmt_custom_meter_description' }, meter.description) : null
    );
}

/**
 * Render the Survival Meters tab content
 */
export function renderSurvivalMetersTab(openModal, render) {
    const state = getState();
    const survivalMeters = state.survivalMeters || {
        hunger: { current: 100, max: 100, enabled: true, criticalThreshold: 20, notes: '' },
        thirst: { current: 100, max: 100, enabled: true, criticalThreshold: 20, notes: '' },
        fatigue: { current: 0, max: 100, enabled: true, criticalThreshold: 80, notes: '' },
        sanity: { current: 100, max: 100, enabled: true, criticalThreshold: 20, notes: '' },
        warmth: { current: 100, max: 100, enabled: true, criticalThreshold: 20, notes: '' },
        custom: []
    };

    // Count critical meters
    let criticalCount = 0;
    for (const key of Object.keys(DEFAULT_METERS)) {
        const meter = survivalMeters[key];
        if (meter?.enabled !== false) {
            const status = getMeterStatus(
                meter?.current ?? 100,
                meter?.max ?? 100,
                meter?.criticalThreshold ?? DEFAULT_METERS[key].defaultCritical,
                DEFAULT_METERS[key].inverted
            );
            if (status === 'critical') criticalCount++;
        }
    }
    for (const meter of (survivalMeters.custom || [])) {
        const status = getMeterStatus(
            meter.current ?? 100,
            meter.max ?? 100,
            meter.criticalThreshold ?? 20,
            false
        );
        if (status === 'critical') criticalCount++;
    }

    const container = h('div', { class: 'vmt_survival_tab' },
        // Header with view toggle
        h('div', { class: 'vmt_survival_header' },
            h('div', { class: 'vmt_survival_status' },
                criticalCount > 0 ?
                    h('span', { class: 'vmt_survival_warning' },
                        h('span', { class: 'vmt_warning_icon' }, '!'),
                        ` ${criticalCount} Critical`
                    ) :
                    h('span', { class: 'vmt_survival_ok' }, 'All Stable')
            ),
            h('div', { class: 'vmt_view_toggle' },
                h('button', {
                    class: `vmt_btn vmt_btn_sm ${viewMode === 'compact' ? 'vmt_btn_active' : ''}`,
                    onclick: () => { viewMode = 'compact'; render(); }
                }, 'Compact'),
                h('button', {
                    class: `vmt_btn vmt_btn_sm ${viewMode === 'expanded' ? 'vmt_btn_active' : ''}`,
                    onclick: () => { viewMode = 'expanded'; render(); }
                }, 'Expanded')
            )
        ),

        // Meter toggles (in expanded view)
        viewMode === 'expanded' ? h('div', { class: 'vmt_meter_toggles' },
            h('span', { class: 'vmt_toggles_label' }, 'Show:'),
            ...Object.keys(DEFAULT_METERS).map(key =>
                createMeterToggle(key, survivalMeters[key] || {}, `survivalMeters.${key}`)
            )
        ) : null,

        // Default meters
        h('div', { class: `vmt_meters_grid ${viewMode === 'compact' ? 'vmt_meters_compact' : ''}` },
            ...Object.keys(DEFAULT_METERS)
                .filter(key => (survivalMeters[key]?.enabled !== false))
                .map(key =>
                    createMeterBar(
                        key,
                        survivalMeters[key] || {},
                        DEFAULT_METERS[key],
                        `survivalMeters.${key}`,
                        render,
                        viewMode === 'expanded'
                    )
                )
        ),

        // Custom meters section
        h('div', { class: 'vmt_custom_meters_section' },
            h('div', { class: 'vmt_custom_meters_header' },
                h('span', { class: 'vmt_section_title' }, 'Custom Meters'),
                h('button', {
                    class: 'vmt_btn vmt_btn_sm',
                    onclick: () => openModal('add-custom-meter')
                }, '+ Add Meter')
            ),
            h('div', { class: 'vmt_custom_meters_grid' },
                (survivalMeters.custom || []).length === 0 ?
                    h('div', { class: 'vmt_empty_state' }, 'No custom meters. Add one above!') :
                    (survivalMeters.custom || []).map((meter, i) =>
                        createCustomMeterCard(meter, i, openModal, render)
                    )
            )
        )
    );

    return container;
}
