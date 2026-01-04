/**
 * Valdris Master Tracker - Skills Tab
 * Active skills, passive skills, categories filter, and proficiencies
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
 * Skill categories
 */
const SKILL_CATEGORIES = ['Combat', 'Magic', 'Utility', 'Social', 'Crafting'];

/**
 * Proficiency definitions
 */
const PROFICIENCY_DEFS = {
    weapons: {
        label: 'Weapons',
        items: {
            simple: 'Simple',
            martial: 'Martial',
            exotic: 'Exotic',
            ranged: 'Ranged',
            twoHanded: 'Two-Handed'
        }
    },
    armor: {
        label: 'Armor',
        items: {
            light: 'Light',
            medium: 'Medium',
            heavy: 'Heavy',
            shields: 'Shields'
        }
    },
    tools: {
        label: 'Tools',
        items: {
            artisan: 'Artisan',
            gaming: 'Gaming',
            musical: 'Musical',
            thieves: "Thieves'",
            herbalism: 'Herbalism',
            alchemist: 'Alchemist',
            smith: 'Smith'
        }
    },
    languages: {
        label: 'Languages',
        items: {
            common: 'Common',
            elvish: 'Elvish',
            dwarvish: 'Dwarvish',
            orcish: 'Orcish',
            draconic: 'Draconic',
            celestial: 'Celestial',
            infernal: 'Infernal',
            abyssal: 'Abyssal'
        }
    },
    vehicles: {
        label: 'Vehicles',
        items: {
            land: 'Land',
            water: 'Water',
            air: 'Air'
        }
    }
};

/**
 * Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Create an active skill item
 */
function createActiveSkillItem(skill, index, onEdit, onDelete) {
    return h('div', { class: 'vmt_skill_item vmt_skill_active' },
        h('div', { class: 'vmt_skill_header_row' },
            h('div', { class: 'vmt_skill_name' }, skill.name),
            h('div', { class: 'vmt_skill_actions' },
                h('button', {
                    class: 'vmt_btn_icon',
                    onclick: () => onEdit(index),
                    title: 'Edit skill'
                }, ''),
                h('button', {
                    class: 'vmt_btn_icon vmt_btn_danger',
                    onclick: () => onDelete(index),
                    title: 'Delete skill'
                }, '')
            )
        ),
        skill.description ? h('div', { class: 'vmt_skill_desc' }, skill.description) : null,
        h('div', { class: 'vmt_skill_stats' },
            h('span', { class: 'vmt_skill_badge vmt_badge_category' }, skill.category || 'General'),
            skill.rank ? h('span', { class: 'vmt_skill_badge vmt_badge_rank' }, `Rank ${skill.rank}`) : null,
            skill.cooldown ? h('span', { class: 'vmt_skill_stat' }, `CD: ${skill.cooldown}`) : null,
            skill.resourceCost ? h('span', { class: 'vmt_skill_stat' }, `Cost: ${skill.resourceCost}`) : null,
            skill.damageEffect ? h('span', { class: 'vmt_skill_stat vmt_skill_damage' }, skill.damageEffect) : null
        )
    );
}

/**
 * Create a passive skill item
 */
function createPassiveSkillItem(skill, index, onEdit, onDelete) {
    return h('div', { class: 'vmt_skill_item vmt_skill_passive' },
        h('div', { class: 'vmt_skill_header_row' },
            h('div', { class: 'vmt_skill_name' }, skill.name),
            h('div', { class: 'vmt_skill_actions' },
                h('button', {
                    class: 'vmt_btn_icon',
                    onclick: () => onEdit(index),
                    title: 'Edit skill'
                }, ''),
                h('button', {
                    class: 'vmt_btn_icon vmt_btn_danger',
                    onclick: () => onDelete(index),
                    title: 'Delete skill'
                }, '')
            )
        ),
        skill.description ? h('div', { class: 'vmt_skill_desc' }, skill.description) : null,
        h('div', { class: 'vmt_skill_stats' },
            h('span', { class: 'vmt_skill_badge vmt_badge_category' }, skill.category || 'General'),
            skill.effect ? h('span', { class: 'vmt_skill_stat vmt_skill_effect' }, skill.effect) : null
        )
    );
}

/**
 * Create a proficiency checkbox group
 */
function createProficiencyGroup(category, profs, onToggle) {
    const def = PROFICIENCY_DEFS[category];

    return h('div', { class: 'vmt_prof_group' },
        h('div', { class: 'vmt_prof_group_header' }, def.label),
        h('div', { class: 'vmt_prof_items' },
            Object.entries(def.items).map(([key, label]) =>
                h('label', { class: 'vmt_prof_item' },
                    h('input', {
                        type: 'checkbox',
                        class: 'vmt_prof_checkbox',
                        checked: profs[key] ? 'checked' : null,
                        onchange: () => onToggle(category, key)
                    }),
                    h('span', { class: 'vmt_prof_label' }, label)
                )
            )
        )
    );
}

/**
 * Create category filter buttons
 */
function createCategoryFilter(activeFilter, onFilterChange) {
    return h('div', { class: 'vmt_category_filter' },
        h('button', {
            class: `vmt_filter_btn ${activeFilter === 'All' ? 'active' : ''}`,
            onclick: () => onFilterChange('All')
        }, 'All'),
        ...SKILL_CATEGORIES.map(cat =>
            h('button', {
                class: `vmt_filter_btn ${activeFilter === cat ? 'active' : ''}`,
                onclick: () => onFilterChange(cat)
            }, cat)
        )
    );
}

// Local filter state
let activeSkillFilter = 'All';
let passiveSkillFilter = 'All';

/**
 * Render the Skills tab content
 */
export function renderSkillsTab(openModal, render) {
    const state = getState();
    const skills = state.skills || { active: [], passive: [] };
    const proficiencies = state.proficiencies || {};

    const container = h('div', { class: 'vmt_skills_tab' });

    // Active Skills Section
    const activeSection = h('div', { class: 'vmt_section vmt_skills_section' },
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Active Skills'),
            h('button', {
                class: 'vmt_btn_small vmt_btn_add',
                onclick: () => openModal('add-active-skill', {
                    onSave: async (skill) => {
                        const newSkill = { ...skill, id: generateId() };
                        const updated = [...(skills.active || []), newSkill];
                        await updateField('skills.active', updated);
                        render();
                    }
                })
            }, '+ Add')
        )
    );

    // Category filter for active skills
    activeSection.appendChild(createCategoryFilter(activeSkillFilter, (cat) => {
        activeSkillFilter = cat;
        render();
    }));

    const filteredActive = activeSkillFilter === 'All'
        ? skills.active
        : skills.active.filter(s => s.category === activeSkillFilter);

    const activeList = h('div', { class: 'vmt_skills_list' });
    if (filteredActive.length === 0) {
        activeList.appendChild(h('div', { class: 'vmt_empty' }, 'No active skills'));
    } else {
        filteredActive.forEach((skill, i) => {
            const originalIndex = skills.active.indexOf(skill);
            activeList.appendChild(createActiveSkillItem(
                skill,
                originalIndex,
                (idx) => openModal('edit-active-skill', {
                    skill: skills.active[idx],
                    onSave: async (updated) => {
                        const list = [...skills.active];
                        list[idx] = { ...list[idx], ...updated };
                        await updateField('skills.active', list);
                        render();
                    }
                }),
                async (idx) => {
                    const list = skills.active.filter((_, j) => j !== idx);
                    await updateField('skills.active', list);
                    render();
                }
            ));
        });
    }
    activeSection.appendChild(activeList);
    container.appendChild(activeSection);

    // Passive Skills Section
    const passiveSection = h('div', { class: 'vmt_section vmt_skills_section' },
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Passive Skills'),
            h('button', {
                class: 'vmt_btn_small vmt_btn_add',
                onclick: () => openModal('add-passive-skill', {
                    onSave: async (skill) => {
                        const newSkill = { ...skill, id: generateId() };
                        const updated = [...(skills.passive || []), newSkill];
                        await updateField('skills.passive', updated);
                        render();
                    }
                })
            }, '+ Add')
        )
    );

    // Category filter for passive skills
    passiveSection.appendChild(createCategoryFilter(passiveSkillFilter, (cat) => {
        passiveSkillFilter = cat;
        render();
    }));

    const filteredPassive = passiveSkillFilter === 'All'
        ? skills.passive
        : skills.passive.filter(s => s.category === passiveSkillFilter);

    const passiveList = h('div', { class: 'vmt_skills_list' });
    if (filteredPassive.length === 0) {
        passiveList.appendChild(h('div', { class: 'vmt_empty' }, 'No passive skills'));
    } else {
        filteredPassive.forEach((skill, i) => {
            const originalIndex = skills.passive.indexOf(skill);
            passiveList.appendChild(createPassiveSkillItem(
                skill,
                originalIndex,
                (idx) => openModal('edit-passive-skill', {
                    skill: skills.passive[idx],
                    onSave: async (updated) => {
                        const list = [...skills.passive];
                        list[idx] = { ...list[idx], ...updated };
                        await updateField('skills.passive', list);
                        render();
                    }
                }),
                async (idx) => {
                    const list = skills.passive.filter((_, j) => j !== idx);
                    await updateField('skills.passive', list);
                    render();
                }
            ));
        });
    }
    passiveSection.appendChild(passiveList);
    container.appendChild(passiveSection);

    // Proficiencies Section
    const profSection = h('div', { class: 'vmt_section vmt_proficiencies_section' },
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Proficiencies')
        )
    );

    const profGrid = h('div', { class: 'vmt_prof_grid' });

    const handleToggle = async (category, key) => {
        const currentProfs = state.proficiencies || {};
        const categoryProfs = currentProfs[category] || {};
        const newValue = !categoryProfs[key];
        await updateField(`proficiencies.${category}.${key}`, newValue);
        render();
    };

    for (const category of Object.keys(PROFICIENCY_DEFS)) {
        const profs = proficiencies[category] || {};
        profGrid.appendChild(createProficiencyGroup(category, profs, handleToggle));
    }

    profSection.appendChild(profGrid);
    container.appendChild(profSection);

    return container;
}
