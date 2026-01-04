/**
 * Valdris Master Tracker - Overview Tab
 * Dashboard with vitals, level, stats summary, and status indicators
 */

import { getState, updateField, recalculateDerivedStats } from '../state-manager.js';

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
 * Create a progress bar component
 */
function createProgressBar(current, max, colorClass, label, onEdit) {
    const percent = max > 0 ? Math.min(100, (current / max) * 100) : 0;

    const bar = h('div', { class: `vmt_progress_bar ${colorClass}` },
        h('div', { class: 'vmt_progress_fill', style: `width: ${percent}%` }),
        h('div', { class: 'vmt_progress_text' },
            h('span', { class: 'vmt_progress_label' }, label),
            h('span', { class: 'vmt_progress_values' },
                h('span', {
                    class: 'vmt_editable',
                    onclick: () => onEdit('current', current)
                }, String(current)),
                ' / ',
                h('span', {
                    class: 'vmt_editable',
                    onclick: () => onEdit('max', max)
                }, String(max))
            )
        )
    );

    return bar;
}

/**
 * Create the XP progress bar
 */
function createXPBar(xp, level, onEdit) {
    const percent = xp.needed > 0 ? Math.min(100, (xp.current / xp.needed) * 100) : 0;

    return h('div', { class: 'vmt_xp_section' },
        h('div', { class: 'vmt_level_badge' },
            h('span', { class: 'vmt_level_label' }, 'LVL'),
            h('span', {
                class: 'vmt_level_number vmt_editable',
                onclick: () => onEdit('level', level)
            }, String(level))
        ),
        h('div', { class: 'vmt_xp_bar_container' },
            h('div', { class: 'vmt_progress_bar vmt_xp' },
                h('div', { class: 'vmt_progress_fill', style: `width: ${percent}%` }),
                h('div', { class: 'vmt_progress_text' },
                    h('span', { class: 'vmt_progress_label' }, 'XP'),
                    h('span', { class: 'vmt_progress_values' },
                        h('span', {
                            class: 'vmt_editable',
                            onclick: () => onEdit('xp.current', xp.current)
                        }, String(xp.current)),
                        ' / ',
                        h('span', {
                            class: 'vmt_editable',
                            onclick: () => onEdit('xp.needed', xp.needed)
                        }, String(xp.needed))
                    )
                )
            )
        )
    );
}

/**
 * Create stat summary item
 */
function createStatItem(name, value, modifier) {
    const modStr = modifier >= 0 ? `+${modifier}` : String(modifier);
    const total = value + modifier;

    return h('div', { class: 'vmt_stat_item' },
        h('span', { class: 'vmt_stat_name' }, name),
        h('span', { class: 'vmt_stat_value' }, String(total)),
        modifier !== 0 ? h('span', { class: `vmt_stat_mod ${modifier > 0 ? 'positive' : 'negative'}` }, `(${modStr})`) : null
    );
}

/**
 * Create buffs/debuffs counter
 */
function createStatusCounter(buffs, debuffs, onManage) {
    return h('div', { class: 'vmt_status_counters' },
        h('div', {
            class: 'vmt_status_item vmt_buffs',
            onclick: () => onManage('buffs')
        },
            h('span', { class: 'vmt_status_icon' }, ''),
            h('span', { class: 'vmt_status_count' }, String(buffs.length)),
            h('span', { class: 'vmt_status_label' }, 'Buffs')
        ),
        h('div', {
            class: 'vmt_status_item vmt_debuffs',
            onclick: () => onManage('debuffs')
        },
            h('span', { class: 'vmt_status_icon' }, ''),
            h('span', { class: 'vmt_status_count' }, String(debuffs.length)),
            h('span', { class: 'vmt_status_label' }, 'Debuffs')
        )
    );
}

/**
 * Create active title display
 */
function createTitleDisplay(title, onEdit) {
    const hasTitle = title.name && title.name.trim() !== '';

    return h('div', { class: 'vmt_title_section' },
        h('div', { class: 'vmt_title_header' },
            h('span', { class: 'vmt_section_label' }, 'Active Title'),
            h('button', {
                class: 'vmt_btn_small',
                onclick: onEdit
            }, hasTitle ? 'Edit' : 'Set')
        ),
        hasTitle
            ? h('div', { class: 'vmt_title_content' },
                h('div', { class: 'vmt_title_name' }, title.name),
                title.effects ? h('div', { class: 'vmt_title_effects' }, title.effects) : null
            )
            : h('div', { class: 'vmt_title_empty' }, 'No title equipped')
    );
}

/**
 * Create vitals status indicators
 */
function createStatusIndicators(hp, mp, stamina) {
    const getStatus = (current, max) => {
        const percent = max > 0 ? (current / max) * 100 : 0;
        if (percent <= 25) return 'critical';
        if (percent <= 50) return 'low';
        if (percent <= 75) return 'medium';
        return 'full';
    };

    return h('div', { class: 'vmt_status_indicators' },
        h('div', { class: `vmt_indicator vmt_hp_indicator ${getStatus(hp.current, hp.max)}` },
            h('span', { class: 'vmt_indicator_icon' }, ''),
            h('span', { class: 'vmt_indicator_label' },
                getStatus(hp.current, hp.max) === 'critical' ? 'Critical HP!' :
                    getStatus(hp.current, hp.max) === 'low' ? 'Low HP' : 'HP OK'
            )
        ),
        mp.max > 0 ? h('div', { class: `vmt_indicator vmt_mp_indicator ${getStatus(mp.current, mp.max)}` },
            h('span', { class: 'vmt_indicator_icon' }, ''),
            h('span', { class: 'vmt_indicator_label' },
                getStatus(mp.current, mp.max) === 'critical' ? 'Low Mana!' :
                    getStatus(mp.current, mp.max) === 'low' ? 'Mana Low' : 'MP OK'
            )
        ) : null,
        h('div', { class: `vmt_indicator vmt_stamina_indicator ${getStatus(stamina.current, stamina.max)}` },
            h('span', { class: 'vmt_indicator_icon' }, ''),
            h('span', { class: 'vmt_indicator_label' },
                getStatus(stamina.current, stamina.max) === 'critical' ? 'Exhausted!' :
                    getStatus(stamina.current, stamina.max) === 'low' ? 'Tired' : 'Energized'
            )
        )
    );
}

/**
 * Render the Overview tab content
 */
export function renderOverviewTab(openModal, render) {
    const state = getState();
    const { hp, mp, stamina, level, xp, activeTitle, attributes, buffs, debuffs } = state;

    // Handler for editing values
    const handleEdit = (field, currentValue) => {
        openModal('edit-value', {
            field,
            currentValue,
            onSave: async (newValue) => {
                await updateField(field, parseInt(newValue, 10) || 0);
                render();
            }
        });
    };

    // Handler for editing title
    const handleEditTitle = () => {
        openModal('edit-title', {
            title: activeTitle,
            onSave: async (newTitle) => {
                await updateField('activeTitle', newTitle);
                render();
            }
        });
    };

    // Handler for managing buffs/debuffs
    const handleManageStatus = (type) => {
        openModal('manage-status', {
            type,
            items: type === 'buffs' ? buffs : debuffs,
            onSave: async (newItems) => {
                await updateField(type, newItems);
                render();
            }
        });
    };

    // Build the container
    const container = h('div', { class: 'vmt_overview_tab' });

    // Character name header
    container.appendChild(
        h('div', { class: 'vmt_character_header' },
            h('input', {
                type: 'text',
                class: 'vmt_character_name_input',
                value: state.characterName || 'Adventurer',
                onchange: async (e) => {
                    await updateField('characterName', e.target.value);
                }
            })
        )
    );

    // Vitals section
    const vitalsSection = h('div', { class: 'vmt_vitals_section' });

    vitalsSection.appendChild(createProgressBar(hp.current, hp.max, 'vmt_hp', 'HP', (type, val) => handleEdit(`hp.${type}`, val)));
    vitalsSection.appendChild(createProgressBar(mp.current, mp.max, 'vmt_mp', 'MP', (type, val) => handleEdit(`mp.${type}`, val)));
    vitalsSection.appendChild(createProgressBar(stamina.current, stamina.max, 'vmt_stamina', 'STA', (type, val) => handleEdit(`stamina.${type}`, val)));

    container.appendChild(vitalsSection);

    // Level & XP section
    container.appendChild(createXPBar(xp, level, handleEdit));

    // Status indicators
    container.appendChild(createStatusIndicators(hp, mp, stamina));

    // Active title
    container.appendChild(createTitleDisplay(activeTitle, handleEditTitle));

    // Stats summary (top 6)
    const statsSection = h('div', { class: 'vmt_stats_summary' },
        h('div', { class: 'vmt_section_header' }, 'Core Stats')
    );

    const statsGrid = h('div', { class: 'vmt_stats_grid' });
    for (const [name, attr] of Object.entries(attributes)) {
        statsGrid.appendChild(createStatItem(name, attr.base, attr.modifier));
    }
    statsSection.appendChild(statsGrid);
    container.appendChild(statsSection);

    // Buffs/Debuffs counters
    container.appendChild(createStatusCounter(buffs, debuffs, handleManageStatus));

    return container;
}
