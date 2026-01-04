/**
 * Valdris Master Tracker - Affinities Tab
 * Elemental and magical affinities with visual bars and effects
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
 * Default elemental affinities with colors and icons
 */
const DEFAULT_AFFINITIES = {
    Fire: { color: '#ff6633', icon: '', gradient: 'linear-gradient(90deg, #ff4422, #ff8844)' },
    Ice: { color: '#66ccff', icon: '', gradient: 'linear-gradient(90deg, #44aaff, #88ddff)' },
    Lightning: { color: '#ffdd44', icon: '', gradient: 'linear-gradient(90deg, #ffcc00, #ffee66)' },
    Earth: { color: '#aa7744', icon: '', gradient: 'linear-gradient(90deg, #886633, #ccaa66)' },
    Wind: { color: '#88ddaa', icon: '', gradient: 'linear-gradient(90deg, #66cc88, #aaeebb)' },
    Water: { color: '#4488dd', icon: '', gradient: 'linear-gradient(90deg, #3366cc, #66aaee)' },
    Light: { color: '#ffeeaa', icon: '', gradient: 'linear-gradient(90deg, #ffdd77, #ffffcc)' },
    Shadow: { color: '#8866aa', icon: '', gradient: 'linear-gradient(90deg, #664488, #aa88cc)' },
    Arcane: { color: '#bb66ff', icon: '', gradient: 'linear-gradient(90deg, #9944ee, #dd88ff)' },
    Nature: { color: '#66aa44', icon: '', gradient: 'linear-gradient(90deg, #448822, #88cc55)' }
};

/**
 * Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Get affinity level description
 */
function getAffinityLevel(percent) {
    if (percent >= 90) return { name: 'Master', color: '#ffaa33' };
    if (percent >= 70) return { name: 'Expert', color: '#b380ff' };
    if (percent >= 50) return { name: 'Adept', color: '#5588ee' };
    if (percent >= 30) return { name: 'Apprentice', color: '#66aa66' };
    if (percent >= 10) return { name: 'Novice', color: '#aaaaaa' };
    return { name: 'None', color: '#666666' };
}

/**
 * Create an affinity bar item
 */
function createAffinityItem(key, affinity, value, notes, onValueChange, onNotesEdit, isCustom, onDelete) {
    const level = getAffinityLevel(value);
    const affinityInfo = DEFAULT_AFFINITIES[key] || {
        color: '#888888',
        icon: '',
        gradient: 'linear-gradient(90deg, #666666, #999999)'
    };

    return h('div', { class: 'vmt_affinity_item' },
        h('div', { class: 'vmt_affinity_header' },
            h('div', { class: 'vmt_affinity_icon', style: `color: ${affinityInfo.color}` }, affinityInfo.icon),
            h('div', { class: 'vmt_affinity_name' }, key),
            h('div', { class: 'vmt_affinity_level', style: `color: ${level.color}` }, level.name),
            isCustom ? h('button', {
                class: 'vmt_btn_icon vmt_btn_danger vmt_btn_small',
                onclick: onDelete,
                title: 'Remove affinity'
            }, '') : null
        ),
        h('div', { class: 'vmt_affinity_bar_container' },
            h('div', { class: 'vmt_affinity_bar' },
                h('div', {
                    class: 'vmt_affinity_fill',
                    style: `width: ${value}%; background: ${affinityInfo.gradient}`
                })
            ),
            h('div', { class: 'vmt_affinity_controls' },
                h('button', {
                    class: 'vmt_btn_icon vmt_btn_small',
                    onclick: () => onValueChange(Math.max(0, value - 5)),
                    title: '-5%'
                }, '-'),
                h('input', {
                    type: 'number',
                    class: 'vmt_affinity_input',
                    value: value,
                    min: 0,
                    max: 100,
                    onchange: (e) => onValueChange(Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)))
                }),
                h('span', { class: 'vmt_affinity_percent' }, '%'),
                h('button', {
                    class: 'vmt_btn_icon vmt_btn_small',
                    onclick: () => onValueChange(Math.min(100, value + 5)),
                    title: '+5%'
                }, '+')
            )
        ),
        h('div', { class: 'vmt_affinity_notes' },
            h('input', {
                type: 'text',
                class: 'vmt_affinity_notes_input',
                value: notes || '',
                placeholder: 'Effects/notes...',
                onchange: (e) => onNotesEdit(e.target.value)
            })
        )
    );
}

/**
 * Render the Affinities tab content
 */
export function renderAffinitiesTab(openModal, render) {
    const state = getState();

    // Initialize affinities if not present
    const affinities = state.affinities || {};
    const affinityValues = affinities.values || {};
    const affinityNotes = affinities.notes || {};
    const customAffinities = affinities.custom || [];

    const container = h('div', { class: 'vmt_affinities_tab' });

    // Summary section - average affinity levels
    const allValues = [
        ...Object.keys(DEFAULT_AFFINITIES).map(k => affinityValues[k] || 0),
        ...customAffinities.map(c => c.value || 0)
    ];
    const avgAffinity = allValues.length > 0
        ? Math.round(allValues.reduce((a, b) => a + b, 0) / allValues.length)
        : 0;
    const strongAffinities = allValues.filter(v => v >= 50).length;

    const summary = h('div', { class: 'vmt_affinities_summary' },
        h('div', { class: 'vmt_summary_item' },
            h('div', { class: 'vmt_summary_label' }, 'Average'),
            h('div', { class: 'vmt_summary_value vmt_highlight' }, `${avgAffinity}%`)
        ),
        h('div', { class: 'vmt_summary_item' },
            h('div', { class: 'vmt_summary_label' }, 'Strong (50%+)'),
            h('div', { class: 'vmt_summary_value' }, strongAffinities)
        ),
        h('div', { class: 'vmt_summary_item' },
            h('div', { class: 'vmt_summary_label' }, 'Total'),
            h('div', { class: 'vmt_summary_value' }, Object.keys(DEFAULT_AFFINITIES).length + customAffinities.length)
        )
    );
    container.appendChild(summary);

    // Default elemental affinities section
    const elementalSection = h('div', { class: 'vmt_section vmt_affinities_section' },
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Elemental Affinities')
        )
    );

    const elementalList = h('div', { class: 'vmt_affinities_list' });

    Object.keys(DEFAULT_AFFINITIES).forEach(key => {
        const value = affinityValues[key] || 0;
        const notes = affinityNotes[key] || '';

        elementalList.appendChild(createAffinityItem(
            key,
            DEFAULT_AFFINITIES[key],
            value,
            notes,
            // Value change
            async (newValue) => {
                const updatedValues = { ...affinityValues, [key]: newValue };
                await updateField('affinities.values', updatedValues);
                render();
            },
            // Notes edit
            async (newNotes) => {
                const updatedNotes = { ...affinityNotes, [key]: newNotes };
                await updateField('affinities.notes', updatedNotes);
            },
            false, // Not custom
            null // No delete for default
        ));
    });

    elementalSection.appendChild(elementalList);
    container.appendChild(elementalSection);

    // Custom affinities section
    const customSection = h('div', { class: 'vmt_section vmt_affinities_section' },
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Custom Affinities'),
            h('button', {
                class: 'vmt_btn_small vmt_btn_add',
                onclick: () => openModal('add-affinity', {
                    onSave: async (affinity) => {
                        const newAffinity = {
                            ...affinity,
                            id: generateId()
                        };
                        const updated = [...customAffinities, newAffinity];
                        await updateField('affinities.custom', updated);
                        render();
                    }
                })
            }, '+ Add Custom')
        )
    );

    const customList = h('div', { class: 'vmt_affinities_list' });

    if (customAffinities.length === 0) {
        customList.appendChild(h('div', { class: 'vmt_empty' }, 'No custom affinities'));
    } else {
        customAffinities.forEach((affinity, index) => {
            customList.appendChild(createAffinityItem(
                affinity.name,
                { color: affinity.color || '#888888', icon: '', gradient: `linear-gradient(90deg, ${affinity.color || '#666666'}, ${affinity.color || '#999999'}aa)` },
                affinity.value || 0,
                affinity.notes || '',
                // Value change
                async (newValue) => {
                    const updated = [...customAffinities];
                    updated[index] = { ...updated[index], value: newValue };
                    await updateField('affinities.custom', updated);
                    render();
                },
                // Notes edit
                async (newNotes) => {
                    const updated = [...customAffinities];
                    updated[index] = { ...updated[index], notes: newNotes };
                    await updateField('affinities.custom', updated);
                },
                true, // Is custom
                // Delete
                async () => {
                    const updated = customAffinities.filter((_, i) => i !== index);
                    await updateField('affinities.custom', updated);
                    render();
                }
            ));
        });
    }

    customSection.appendChild(customList);
    container.appendChild(customSection);

    // Quick actions
    const actionsSection = h('div', { class: 'vmt_affinities_actions' },
        h('button', {
            class: 'vmt_btn',
            onclick: async () => {
                const resetValues = {};
                Object.keys(DEFAULT_AFFINITIES).forEach(k => resetValues[k] = 0);
                await updateField('affinities.values', resetValues);
                await updateField('affinities.notes', {});
                await updateField('affinities.custom', []);
                render();
            }
        }, 'Reset All'),
        h('button', {
            class: 'vmt_btn',
            onclick: async () => {
                const balancedValues = {};
                Object.keys(DEFAULT_AFFINITIES).forEach(k => balancedValues[k] = 50);
                await updateField('affinities.values', balancedValues);
                render();
            }
        }, 'Balance All (50%)')
    );
    container.appendChild(actionsSection);

    return container;
}
