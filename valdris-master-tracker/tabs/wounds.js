/**
 * Valdris Master Tracker - Wounds Tab
 * Injury tracking with time-based healing
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
    return 'wnd_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Wound severities with healing times and effects
 */
const WOUND_SEVERITIES = {
    minor: {
        name: 'Minor',
        color: '#66aa66',
        healingDays: { min: 1, max: 3 },
        description: 'Cuts, bruises, minor burns'
    },
    moderate: {
        name: 'Moderate',
        color: '#ddaa33',
        healingDays: { min: 5, max: 10 },
        description: 'Deep cuts, sprains, fractures'
    },
    severe: {
        name: 'Severe',
        color: '#dd6644',
        healingDays: { min: 14, max: 28 },
        description: 'Broken bones, serious burns, organ damage'
    },
    critical: {
        name: 'Critical',
        color: '#dd3333',
        healingDays: { min: 30, max: 60 },
        description: 'Life-threatening injuries, permanent damage risk'
    }
};

/**
 * Wound types
 */
const WOUND_TYPES = [
    'Cut/Laceration',
    'Stab Wound',
    'Blunt Trauma',
    'Burn',
    'Frostbite',
    'Broken Bone',
    'Sprain/Strain',
    'Poison Damage',
    'Acid Burn',
    'Curse Wound',
    'Disease',
    'Internal Injury',
    'Concussion',
    'Other'
];

/**
 * Body locations
 */
const BODY_LOCATIONS = [
    'Head',
    'Face',
    'Neck',
    'Chest',
    'Back',
    'Abdomen',
    'Left Arm',
    'Right Arm',
    'Left Hand',
    'Right Hand',
    'Left Leg',
    'Right Leg',
    'Left Foot',
    'Right Foot'
];

/**
 * Get severity data
 */
function getSeverityData(severity) {
    return WOUND_SEVERITIES[severity] || WOUND_SEVERITIES.minor;
}

/**
 * Calculate healing progress percentage
 */
function getHealingProgress(wound) {
    if (!wound.healingDays || wound.healingDays <= 0) return 100;
    const healed = wound.healingDays - (wound.daysRemaining || 0);
    return Math.min(100, Math.max(0, (healed / wound.healingDays) * 100));
}

/**
 * Create a wound card
 */
function createWoundCard(wound, index, onEdit, onDelete, onHeal, onTreat) {
    const severityData = getSeverityData(wound.severity);
    const progress = getHealingProgress(wound);
    const isHealed = wound.daysRemaining <= 0;

    return h('div', {
        class: `vmt_wound_card ${isHealed ? 'vmt_wound_healed' : ''}`
    },
        h('div', { class: 'vmt_wound_header' },
            h('div', { class: 'vmt_wound_info' },
                h('div', { class: 'vmt_wound_type' }, wound.type || 'Unknown Wound'),
                h('div', { class: 'vmt_wound_location' }, wound.location || 'Unknown Location')
            ),
            h('div', {
                class: 'vmt_wound_severity',
                style: `background: ${severityData.color}20; color: ${severityData.color}; border-color: ${severityData.color}40`
            }, severityData.name),
            h('div', { class: 'vmt_wound_actions' },
                h('button', {
                    class: 'vmt_btn_icon',
                    onclick: () => onEdit(index),
                    title: 'Edit wound'
                }, ''),
                h('button', {
                    class: 'vmt_btn_icon vmt_btn_danger',
                    onclick: () => onDelete(index),
                    title: 'Remove wound'
                }, '')
            )
        ),

        // Healing progress bar
        h('div', { class: 'vmt_wound_healing' },
            h('div', { class: 'vmt_healing_header' },
                h('span', { class: 'vmt_healing_label' },
                    isHealed ? 'Healed!' : `${wound.daysRemaining || 0} days remaining`
                ),
                h('span', { class: 'vmt_healing_percent' }, `${Math.round(progress)}%`)
            ),
            h('div', { class: 'vmt_healing_bar' },
                h('div', {
                    class: 'vmt_healing_fill',
                    style: `width: ${progress}%; background: linear-gradient(90deg, ${severityData.color}, #66dd88)`
                })
            )
        ),

        // Effects
        wound.effects && wound.effects.length > 0 ?
            h('div', { class: 'vmt_wound_effects' },
                h('span', { class: 'vmt_effects_label' }, 'Effects: '),
                h('span', { class: 'vmt_effects_text' }, wound.effects.join(', '))
            ) : null,

        // Treatment status
        h('div', { class: 'vmt_wound_treatment' },
            h('span', {
                class: `vmt_treatment_badge ${wound.treated ? 'vmt_treated' : 'vmt_untreated'}`
            }, wound.treated ? 'Treated' : 'Untreated'),
            !wound.treated ?
                h('button', {
                    class: 'vmt_btn_small vmt_btn_treat',
                    onclick: () => onTreat(index)
                }, 'Apply Treatment') : null
        ),

        // Notes
        wound.notes ?
            h('div', { class: 'vmt_wound_notes' },
                h('span', { class: 'vmt_notes_text' }, wound.notes)
            ) : null,

        // Quick heal button
        !isHealed ?
            h('div', { class: 'vmt_wound_quick_actions' },
                h('button', {
                    class: 'vmt_btn_small',
                    onclick: () => onHeal(index, 1),
                    title: 'Advance healing by 1 day'
                }, '+1 Day'),
                h('button', {
                    class: 'vmt_btn_small',
                    onclick: () => onHeal(index, 7),
                    title: 'Advance healing by 1 week'
                }, '+1 Week'),
                h('button', {
                    class: 'vmt_btn_small vmt_btn_success',
                    onclick: () => onHeal(index, wound.daysRemaining),
                    title: 'Mark as fully healed'
                }, 'Fully Heal')
            ) : null
    );
}

/**
 * Render the Wounds tab content
 */
export function renderWoundsTab(openModal, render) {
    const state = getState();
    const wounds = state.wounds || [];

    const container = h('div', { class: 'vmt_wounds_tab' });

    // Summary section
    const activeWounds = wounds.filter(w => (w.daysRemaining || 0) > 0);
    const healedWounds = wounds.filter(w => (w.daysRemaining || 0) <= 0);

    const summary = h('div', { class: 'vmt_wounds_summary' },
        h('div', { class: 'vmt_summary_item' },
            h('div', { class: 'vmt_summary_label' }, 'Active Wounds'),
            h('div', { class: 'vmt_summary_value vmt_text_danger' }, activeWounds.length)
        ),
        h('div', { class: 'vmt_summary_item' },
            h('div', { class: 'vmt_summary_label' }, 'Healed'),
            h('div', { class: 'vmt_summary_value vmt_text_success' }, healedWounds.length)
        ),
        ...Object.entries(WOUND_SEVERITIES).map(([key, data]) => {
            const count = activeWounds.filter(w => w.severity === key).length;
            return h('div', { class: 'vmt_summary_item' },
                h('div', { class: 'vmt_summary_label', style: `color: ${data.color}` }, data.name),
                h('div', { class: 'vmt_summary_value' }, count)
            );
        })
    );
    container.appendChild(summary);

    // Main section
    const mainSection = h('div', { class: 'vmt_section vmt_wounds_section' },
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Injury Tracker'),
            h('button', {
                class: 'vmt_btn_small vmt_btn_add',
                onclick: () => openModal('add-wound', {
                    woundTypes: WOUND_TYPES,
                    bodyLocations: BODY_LOCATIONS,
                    severities: WOUND_SEVERITIES,
                    onSave: async (wound) => {
                        const severityData = getSeverityData(wound.severity);
                        const healingDays = wound.healingDays ||
                            Math.floor(Math.random() * (severityData.healingDays.max - severityData.healingDays.min + 1)) +
                            severityData.healingDays.min;

                        const newWound = {
                            ...wound,
                            id: generateId(),
                            healingDays: healingDays,
                            daysRemaining: healingDays,
                            receivedDate: wound.receivedDate || { year: 2847, month: 7, day: 14 },
                            treated: wound.treated || false,
                            effects: wound.effects || [],
                            healingModifiers: wound.healingModifiers || []
                        };
                        const updated = [...wounds, newWound];
                        await updateField('wounds', updated);
                        render();
                    }
                })
            }, '+ Add Wound')
        )
    );

    // Active wounds
    if (activeWounds.length > 0) {
        const activeSection = h('div', { class: 'vmt_wounds_group' },
            h('h4', { class: 'vmt_wounds_group_title' }, 'Active Injuries')
        );

        const woundsList = h('div', { class: 'vmt_wounds_list' });
        activeWounds.forEach((wound) => {
            const originalIndex = wounds.indexOf(wound);
            woundsList.appendChild(createWoundCard(
                wound,
                originalIndex,
                // Edit
                (idx) => openModal('edit-wound', {
                    wound: wounds[idx],
                    woundTypes: WOUND_TYPES,
                    bodyLocations: BODY_LOCATIONS,
                    severities: WOUND_SEVERITIES,
                    onSave: async (updated) => {
                        const list = [...wounds];
                        list[idx] = { ...list[idx], ...updated };
                        await updateField('wounds', list);
                        render();
                    }
                }),
                // Delete
                async (idx) => {
                    const list = wounds.filter((_, j) => j !== idx);
                    await updateField('wounds', list);
                    render();
                },
                // Heal (advance days)
                async (idx, days) => {
                    const list = [...wounds];
                    list[idx] = {
                        ...list[idx],
                        daysRemaining: Math.max(0, (list[idx].daysRemaining || 0) - days)
                    };
                    await updateField('wounds', list);
                    render();
                },
                // Treat
                async (idx) => {
                    const list = [...wounds];
                    const wound = list[idx];
                    // Treatment reduces healing time by 25%
                    const reduction = Math.floor((wound.daysRemaining || 0) * 0.25);
                    list[idx] = {
                        ...wound,
                        treated: true,
                        daysRemaining: Math.max(0, (wound.daysRemaining || 0) - reduction),
                        healingModifiers: [...(wound.healingModifiers || []), 'Treated (-25% time)']
                    };
                    await updateField('wounds', list);
                    render();
                }
            ));
        });
        activeSection.appendChild(woundsList);
        mainSection.appendChild(activeSection);
    }

    // Healed wounds (collapsed by default)
    if (healedWounds.length > 0) {
        const healedSection = h('div', { class: 'vmt_wounds_group vmt_wounds_healed_group' },
            h('h4', {
                class: 'vmt_wounds_group_title vmt_collapsible',
                onclick: (e) => {
                    const list = e.target.nextElementSibling;
                    list.classList.toggle('vmt_collapsed');
                    e.target.classList.toggle('vmt_collapsed');
                }
            }, `Healed Injuries (${healedWounds.length})`)
        );

        const healedList = h('div', { class: 'vmt_wounds_list vmt_collapsed' });
        healedWounds.forEach((wound) => {
            const originalIndex = wounds.indexOf(wound);
            healedList.appendChild(createWoundCard(
                wound,
                originalIndex,
                (idx) => openModal('edit-wound', {
                    wound: wounds[idx],
                    woundTypes: WOUND_TYPES,
                    bodyLocations: BODY_LOCATIONS,
                    severities: WOUND_SEVERITIES,
                    onSave: async (updated) => {
                        const list = [...wounds];
                        list[idx] = { ...list[idx], ...updated };
                        await updateField('wounds', list);
                        render();
                    }
                }),
                async (idx) => {
                    const list = wounds.filter((_, j) => j !== idx);
                    await updateField('wounds', list);
                    render();
                },
                () => { }, // No heal action for healed wounds
                () => { }  // No treat action for healed wounds
            ));
        });
        healedSection.appendChild(healedList);
        mainSection.appendChild(healedSection);
    }

    // Empty state
    if (wounds.length === 0) {
        mainSection.appendChild(h('div', { class: 'vmt_empty' },
            h('p', {}, 'No injuries recorded'),
            h('p', { class: 'vmt_empty_hint' }, 'Wounds heal over time based on severity. Treatment can speed recovery.')
        ));
    }

    // Info section
    const infoSection = h('div', { class: 'vmt_wounds_info' },
        h('h4', {}, 'Severity Guide'),
        h('div', { class: 'vmt_severity_guide' },
            ...Object.entries(WOUND_SEVERITIES).map(([key, data]) =>
                h('div', { class: 'vmt_severity_item' },
                    h('span', {
                        class: 'vmt_severity_badge',
                        style: `background: ${data.color}20; color: ${data.color}`
                    }, data.name),
                    h('span', { class: 'vmt_severity_days' },
                        `${data.healingDays.min}-${data.healingDays.max} days`
                    ),
                    h('span', { class: 'vmt_severity_desc' }, data.description)
                )
            )
        )
    );
    mainSection.appendChild(infoSection);

    container.appendChild(mainSection);

    return container;
}

/**
 * Process wound healing for a new day
 * Call this when ValdrisEventBus emits 'newDay'
 */
export function processWoundHealing(wounds) {
    return wounds.map(wound => ({
        ...wound,
        daysRemaining: Math.max(0, (wound.daysRemaining || 0) - 1)
    }));
}

export { WOUND_TYPES, BODY_LOCATIONS, WOUND_SEVERITIES };
