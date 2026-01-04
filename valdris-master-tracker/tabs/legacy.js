/**
 * Valdris Master Tracker - Legacy Tab
 * Track character's lasting impact, lineage, inheritance, and dynasty
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
 * Impact level colors
 */
const IMPACT_COLORS = {
    'Local': { bg: 'rgba(136, 136, 136, 0.2)', color: '#888888', border: 'rgba(136, 136, 136, 0.4)' },
    'Regional': { bg: 'rgba(102, 170, 102, 0.2)', color: '#66aa66', border: 'rgba(102, 170, 102, 0.4)' },
    'National': { bg: 'rgba(85, 136, 238, 0.2)', color: '#5588ee', border: 'rgba(85, 136, 238, 0.4)' },
    'Continental': { bg: 'rgba(179, 128, 255, 0.2)', color: '#b380ff', border: 'rgba(179, 128, 255, 0.4)' },
    'World': { bg: 'rgba(255, 170, 51, 0.2)', color: '#ffaa33', border: 'rgba(255, 170, 51, 0.4)' }
};

/**
 * House status colors
 */
const HOUSE_STATUS_COLORS = {
    'Rising': { bg: 'rgba(102, 221, 136, 0.2)', color: '#66dd88', border: 'rgba(102, 221, 136, 0.4)' },
    'Established': { bg: 'rgba(85, 136, 238, 0.2)', color: '#5588ee', border: 'rgba(85, 136, 238, 0.4)' },
    'Declining': { bg: 'rgba(255, 187, 51, 0.2)', color: '#ffbb33', border: 'rgba(255, 187, 51, 0.4)' },
    'Fallen': { bg: 'rgba(221, 68, 68, 0.2)', color: '#dd4444', border: 'rgba(221, 68, 68, 0.4)' },
    'Extinct': { bg: 'rgba(102, 102, 102, 0.2)', color: '#666666', border: 'rgba(102, 102, 102, 0.4)' }
};

// Section collapse state
const collapsedSections = new Set();

/**
 * Create collapsible section header
 */
function createSectionHeader(title, sectionKey, onToggle) {
    const isCollapsed = collapsedSections.has(sectionKey);

    return h('div', {
        class: 'vmt_legacy_section_header',
        onclick: () => {
            if (collapsedSections.has(sectionKey)) {
                collapsedSections.delete(sectionKey);
            } else {
                collapsedSections.add(sectionKey);
            }
            onToggle();
        }
    },
        h('span', { class: 'vmt_legacy_section_toggle' }, isCollapsed ? '>' : 'v'),
        h('span', { class: 'vmt_legacy_section_title' }, title)
    );
}

/**
 * Create bloodline section
 */
function createBloodlineSection(legacy, openModal, render) {
    const bloodline = legacy.bloodline || { name: '', traits: [], ancestors: [], curses: [], blessings: [] };
    const isCollapsed = collapsedSections.has('bloodline');

    const section = h('div', { class: 'vmt_legacy_section' },
        createSectionHeader('Bloodline & Lineage', 'bloodline', render),
        !isCollapsed ? h('div', { class: 'vmt_legacy_section_content' },
            // Bloodline name
            h('div', { class: 'vmt_legacy_field' },
                h('label', { class: 'vmt_label' }, 'Bloodline Name'),
                h('input', {
                    type: 'text',
                    class: 'vmt_input',
                    value: bloodline.name || '',
                    placeholder: 'Enter bloodline name...',
                    onchange: (e) => updateField('legacy.bloodline.name', e.target.value)
                })
            ),

            // Bloodline traits
            h('div', { class: 'vmt_legacy_list_section' },
                h('div', { class: 'vmt_legacy_list_header' },
                    h('span', { class: 'vmt_legacy_list_title' }, 'Inherited Traits'),
                    h('button', {
                        class: 'vmt_btn vmt_btn_sm',
                        onclick: () => openModal('add-bloodline-trait')
                    }, '+ Add Trait')
                ),
                h('div', { class: 'vmt_legacy_tags' },
                    ...(bloodline.traits || []).map((trait, i) =>
                        h('span', { class: 'vmt_legacy_tag vmt_tag_trait' },
                            trait,
                            h('button', {
                                class: 'vmt_tag_remove',
                                onclick: () => {
                                    const traits = [...(bloodline.traits || [])];
                                    traits.splice(i, 1);
                                    updateField('legacy.bloodline.traits', traits);
                                }
                            }, 'x')
                        )
                    )
                )
            ),

            // Known ancestors
            h('div', { class: 'vmt_legacy_list_section' },
                h('div', { class: 'vmt_legacy_list_header' },
                    h('span', { class: 'vmt_legacy_list_title' }, 'Known Ancestors'),
                    h('button', {
                        class: 'vmt_btn vmt_btn_sm',
                        onclick: () => openModal('add-ancestor')
                    }, '+ Add')
                ),
                h('div', { class: 'vmt_ancestors_list' },
                    ...(bloodline.ancestors || []).map((ancestor, i) =>
                        h('div', { class: 'vmt_ancestor_item' },
                            h('div', { class: 'vmt_ancestor_info' },
                                h('span', { class: 'vmt_ancestor_name' }, ancestor.name),
                                h('span', { class: 'vmt_ancestor_relation' }, ancestor.relation)
                            ),
                            ancestor.notes ? h('div', { class: 'vmt_ancestor_notes' }, ancestor.notes) : null,
                            h('div', { class: 'vmt_ancestor_actions' },
                                h('button', {
                                    class: 'vmt_btn_icon',
                                    onclick: () => openModal('edit-ancestor', i),
                                    title: 'Edit'
                                }, ''),
                                h('button', {
                                    class: 'vmt_btn_icon vmt_btn_danger',
                                    onclick: () => {
                                        const ancestors = [...(bloodline.ancestors || [])];
                                        ancestors.splice(i, 1);
                                        updateField('legacy.bloodline.ancestors', ancestors);
                                    },
                                    title: 'Remove'
                                }, '')
                            )
                        )
                    )
                )
            ),

            // Bloodline curses and blessings
            h('div', { class: 'vmt_legacy_dual_lists' },
                // Curses
                h('div', { class: 'vmt_legacy_list_section vmt_legacy_curses' },
                    h('div', { class: 'vmt_legacy_list_header' },
                        h('span', { class: 'vmt_legacy_list_title' }, 'Bloodline Curses'),
                        h('button', {
                            class: 'vmt_btn vmt_btn_sm',
                            onclick: () => openModal('add-bloodline-curse')
                        }, '+')
                    ),
                    h('div', { class: 'vmt_legacy_tags' },
                        ...(bloodline.curses || []).map((curse, i) =>
                            h('span', { class: 'vmt_legacy_tag vmt_tag_curse' },
                                curse,
                                h('button', {
                                    class: 'vmt_tag_remove',
                                    onclick: () => {
                                        const curses = [...(bloodline.curses || [])];
                                        curses.splice(i, 1);
                                        updateField('legacy.bloodline.curses', curses);
                                    }
                                }, 'x')
                            )
                        )
                    )
                ),
                // Blessings
                h('div', { class: 'vmt_legacy_list_section vmt_legacy_blessings' },
                    h('div', { class: 'vmt_legacy_list_header' },
                        h('span', { class: 'vmt_legacy_list_title' }, 'Bloodline Blessings'),
                        h('button', {
                            class: 'vmt_btn vmt_btn_sm',
                            onclick: () => openModal('add-bloodline-blessing')
                        }, '+')
                    ),
                    h('div', { class: 'vmt_legacy_tags' },
                        ...(bloodline.blessings || []).map((blessing, i) =>
                            h('span', { class: 'vmt_legacy_tag vmt_tag_blessing' },
                                blessing,
                                h('button', {
                                    class: 'vmt_tag_remove',
                                    onclick: () => {
                                        const blessings = [...(bloodline.blessings || [])];
                                        blessings.splice(i, 1);
                                        updateField('legacy.bloodline.blessings', blessings);
                                    }
                                }, 'x')
                            )
                        )
                    )
                )
            )
        ) : null
    );

    return section;
}

/**
 * Create heirs section
 */
function createHeirsSection(legacy, openModal, render) {
    const heirs = legacy.heirs || [];
    const isCollapsed = collapsedSections.has('heirs');

    return h('div', { class: 'vmt_legacy_section' },
        createSectionHeader('Heirs', 'heirs', render),
        !isCollapsed ? h('div', { class: 'vmt_legacy_section_content' },
            h('div', { class: 'vmt_legacy_list_header' },
                h('span', {}),
                h('button', {
                    class: 'vmt_btn vmt_btn_sm',
                    onclick: () => openModal('add-heir')
                }, '+ Add Heir')
            ),
            h('div', { class: 'vmt_heirs_list' },
                heirs.length === 0 ?
                    h('div', { class: 'vmt_empty_state' }, 'No heirs designated') :
                    heirs.map((heir, i) =>
                        h('div', { class: 'vmt_heir_card' },
                            h('div', { class: 'vmt_heir_header' },
                                h('div', { class: 'vmt_heir_info' },
                                    h('span', { class: 'vmt_heir_name' }, heir.name),
                                    h('span', { class: 'vmt_heir_relation' }, heir.relation),
                                    heir.age ? h('span', { class: 'vmt_heir_age' }, `Age: ${heir.age}`) : null
                                ),
                                h('span', {
                                    class: `vmt_heir_status vmt_heir_status_${(heir.status || 'alive').toLowerCase()}`
                                }, heir.status || 'Alive'),
                                h('div', { class: 'vmt_heir_actions' },
                                    h('button', {
                                        class: 'vmt_btn_icon',
                                        onclick: () => openModal('edit-heir', i),
                                        title: 'Edit'
                                    }, ''),
                                    h('button', {
                                        class: 'vmt_btn_icon vmt_btn_danger',
                                        onclick: () => {
                                            const updated = [...heirs];
                                            updated.splice(i, 1);
                                            updateField('legacy.heirs', updated);
                                        },
                                        title: 'Remove'
                                    }, '')
                                )
                            ),
                            heir.notes ? h('div', { class: 'vmt_heir_notes' }, heir.notes) : null
                        )
                    )
            )
        ) : null
    );
}

/**
 * Create legacy deeds section
 */
function createDeedsSection(legacy, openModal, render) {
    const deeds = legacy.deeds || [];
    const isCollapsed = collapsedSections.has('deeds');

    return h('div', { class: 'vmt_legacy_section' },
        createSectionHeader('Legacy Achievements', 'deeds', render),
        !isCollapsed ? h('div', { class: 'vmt_legacy_section_content' },
            h('div', { class: 'vmt_legacy_list_header' },
                h('span', {}),
                h('button', {
                    class: 'vmt_btn vmt_btn_sm',
                    onclick: () => openModal('add-deed')
                }, '+ Add Deed')
            ),
            h('div', { class: 'vmt_deeds_list' },
                deeds.length === 0 ?
                    h('div', { class: 'vmt_empty_state' }, 'No legacy deeds recorded') :
                    deeds.map((deed, i) => {
                        const impactStyle = IMPACT_COLORS[deed.impact] || IMPACT_COLORS['Local'];
                        return h('div', { class: 'vmt_deed_card' },
                            h('div', { class: 'vmt_deed_header' },
                                h('div', { class: 'vmt_deed_info' },
                                    h('span', { class: 'vmt_deed_name' }, deed.name),
                                    deed.date ? h('span', { class: 'vmt_deed_date' }, deed.date) : null
                                ),
                                h('span', {
                                    class: 'vmt_deed_impact',
                                    style: `background: ${impactStyle.bg}; color: ${impactStyle.color}; border-color: ${impactStyle.border}`
                                }, deed.impact || 'Local'),
                                h('div', { class: 'vmt_deed_actions' },
                                    h('button', {
                                        class: 'vmt_btn_icon',
                                        onclick: () => openModal('edit-deed', i),
                                        title: 'Edit'
                                    }, ''),
                                    h('button', {
                                        class: 'vmt_btn_icon vmt_btn_danger',
                                        onclick: () => {
                                            const updated = [...deeds];
                                            updated.splice(i, 1);
                                            updateField('legacy.deeds', updated);
                                        },
                                        title: 'Remove'
                                    }, '')
                                )
                            ),
                            deed.description ? h('div', { class: 'vmt_deed_description' }, deed.description) : null
                        );
                    })
            )
        ) : null
    );
}

/**
 * Create inheritance section
 */
function createInheritanceSection(legacy, openModal, render) {
    const inheritance = legacy.inheritance || [];
    const isCollapsed = collapsedSections.has('inheritance');

    return h('div', { class: 'vmt_legacy_section' },
        createSectionHeader('Inheritance / Will', 'inheritance', render),
        !isCollapsed ? h('div', { class: 'vmt_legacy_section_content' },
            h('div', { class: 'vmt_legacy_list_header' },
                h('span', {}),
                h('button', {
                    class: 'vmt_btn vmt_btn_sm',
                    onclick: () => openModal('add-inheritance')
                }, '+ Add Item')
            ),
            h('div', { class: 'vmt_inheritance_list' },
                inheritance.length === 0 ?
                    h('div', { class: 'vmt_empty_state' }, 'No inheritance items designated') :
                    inheritance.map((item, i) =>
                        h('div', { class: 'vmt_inheritance_item' },
                            h('div', { class: 'vmt_inheritance_header' },
                                h('span', { class: 'vmt_inheritance_item_name' }, item.item),
                                h('span', { class: 'vmt_inheritance_arrow' }, '->'),
                                h('span', { class: 'vmt_inheritance_recipient' }, item.recipient),
                                h('div', { class: 'vmt_inheritance_actions' },
                                    h('button', {
                                        class: 'vmt_btn_icon',
                                        onclick: () => openModal('edit-inheritance', i),
                                        title: 'Edit'
                                    }, ''),
                                    h('button', {
                                        class: 'vmt_btn_icon vmt_btn_danger',
                                        onclick: () => {
                                            const updated = [...inheritance];
                                            updated.splice(i, 1);
                                            updateField('legacy.inheritance', updated);
                                        },
                                        title: 'Remove'
                                    }, '')
                                )
                            ),
                            item.conditions ? h('div', { class: 'vmt_inheritance_conditions' },
                                h('span', { class: 'vmt_label_sm' }, 'Conditions: '),
                                item.conditions
                            ) : null
                        )
                    )
            )
        ) : null
    );
}

/**
 * Create house/dynasty section
 */
function createHouseSection(legacy, openModal, render) {
    const house = legacy.house || { name: '', motto: '', status: 'Established', allies: [], enemies: [] };
    const isCollapsed = collapsedSections.has('house');
    const statusStyle = HOUSE_STATUS_COLORS[house.status] || HOUSE_STATUS_COLORS['Established'];

    return h('div', { class: 'vmt_legacy_section' },
        createSectionHeader('Dynasty / House', 'house', render),
        !isCollapsed ? h('div', { class: 'vmt_legacy_section_content' },
            // House name and motto
            h('div', { class: 'vmt_legacy_house_basics' },
                h('div', { class: 'vmt_legacy_field' },
                    h('label', { class: 'vmt_label' }, 'House Name'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_input',
                        value: house.name || '',
                        placeholder: 'House name...',
                        onchange: (e) => updateField('legacy.house.name', e.target.value)
                    })
                ),
                h('div', { class: 'vmt_legacy_field' },
                    h('label', { class: 'vmt_label' }, 'House Words / Motto'),
                    h('input', {
                        type: 'text',
                        class: 'vmt_input vmt_input_italic',
                        value: house.motto || '',
                        placeholder: '"Our motto here..."',
                        onchange: (e) => updateField('legacy.house.motto', e.target.value)
                    })
                )
            ),

            // House status
            h('div', { class: 'vmt_legacy_field' },
                h('label', { class: 'vmt_label' }, 'House Status'),
                h('div', { class: 'vmt_house_status_row' },
                    h('select', {
                        class: 'vmt_select',
                        value: house.status || 'Established',
                        onchange: (e) => updateField('legacy.house.status', e.target.value)
                    },
                        ['Rising', 'Established', 'Declining', 'Fallen', 'Extinct'].map(status =>
                            h('option', {
                                value: status,
                                selected: house.status === status
                            }, status)
                        )
                    ),
                    h('span', {
                        class: 'vmt_house_status_badge',
                        style: `background: ${statusStyle.bg}; color: ${statusStyle.color}; border-color: ${statusStyle.border}`
                    }, house.status || 'Established')
                )
            ),

            // Allies and enemies
            h('div', { class: 'vmt_legacy_dual_lists' },
                // Allies
                h('div', { class: 'vmt_legacy_list_section vmt_legacy_allies' },
                    h('div', { class: 'vmt_legacy_list_header' },
                        h('span', { class: 'vmt_legacy_list_title' }, 'Allied Houses'),
                        h('button', {
                            class: 'vmt_btn vmt_btn_sm',
                            onclick: () => openModal('add-house-ally')
                        }, '+')
                    ),
                    h('div', { class: 'vmt_legacy_tags' },
                        ...(house.allies || []).map((ally, i) =>
                            h('span', { class: 'vmt_legacy_tag vmt_tag_ally' },
                                ally,
                                h('button', {
                                    class: 'vmt_tag_remove',
                                    onclick: () => {
                                        const allies = [...(house.allies || [])];
                                        allies.splice(i, 1);
                                        updateField('legacy.house.allies', allies);
                                    }
                                }, 'x')
                            )
                        )
                    )
                ),
                // Enemies
                h('div', { class: 'vmt_legacy_list_section vmt_legacy_enemies' },
                    h('div', { class: 'vmt_legacy_list_header' },
                        h('span', { class: 'vmt_legacy_list_title' }, 'Rival Houses'),
                        h('button', {
                            class: 'vmt_btn vmt_btn_sm',
                            onclick: () => openModal('add-house-enemy')
                        }, '+')
                    ),
                    h('div', { class: 'vmt_legacy_tags' },
                        ...(house.enemies || []).map((enemy, i) =>
                            h('span', { class: 'vmt_legacy_tag vmt_tag_enemy' },
                                enemy,
                                h('button', {
                                    class: 'vmt_tag_remove',
                                    onclick: () => {
                                        const enemies = [...(house.enemies || [])];
                                        enemies.splice(i, 1);
                                        updateField('legacy.house.enemies', enemies);
                                    }
                                }, 'x')
                            )
                        )
                    )
                )
            )
        ) : null
    );
}

/**
 * Render the Legacy tab content
 */
export function renderLegacyTab(openModal, render) {
    const state = getState();
    const legacy = state.legacy || {
        bloodline: { name: '', traits: [], ancestors: [], curses: [], blessings: [] },
        heirs: [],
        deeds: [],
        inheritance: [],
        house: { name: '', motto: '', status: 'Established', allies: [], enemies: [] }
    };

    const container = h('div', { class: 'vmt_legacy_tab' },
        // Legacy summary at top
        h('div', { class: 'vmt_legacy_summary' },
            h('div', { class: 'vmt_summary_item' },
                h('span', { class: 'vmt_summary_label' }, 'Bloodline'),
                h('span', { class: 'vmt_summary_value' }, legacy.bloodline?.name || 'Unknown')
            ),
            h('div', { class: 'vmt_summary_item' },
                h('span', { class: 'vmt_summary_label' }, 'House'),
                h('span', { class: 'vmt_summary_value' }, legacy.house?.name || 'None')
            ),
            h('div', { class: 'vmt_summary_item' },
                h('span', { class: 'vmt_summary_label' }, 'Heirs'),
                h('span', { class: 'vmt_summary_value' }, (legacy.heirs || []).length)
            ),
            h('div', { class: 'vmt_summary_item' },
                h('span', { class: 'vmt_summary_label' }, 'Deeds'),
                h('span', { class: 'vmt_summary_value' }, (legacy.deeds || []).length)
            )
        ),

        // Collapsible sections
        createBloodlineSection(legacy, openModal, render),
        createHeirsSection(legacy, openModal, render),
        createDeedsSection(legacy, openModal, render),
        createInheritanceSection(legacy, openModal, render),
        createHouseSection(legacy, openModal, render)
    );

    return container;
}
