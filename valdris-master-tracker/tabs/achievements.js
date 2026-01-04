/**
 * Valdris Master Tracker - Achievements Tab
 * Achievement tracking with categories, progress, and completion status
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
 * Achievement categories with colors and icons
 */
const ACHIEVEMENT_CATEGORIES = {
    Combat: { color: '#e05555', icon: '' },
    Exploration: { color: '#55cc77', icon: '' },
    Social: { color: '#5588ee', icon: '' },
    Crafting: { color: '#ddaa33', icon: '' },
    Hidden: { color: '#b380ff', icon: '' }
};

/**
 * Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Format date
 */
function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString();
}

/**
 * Calculate category completion percentage
 */
function getCategoryCompletion(achievements, category) {
    const categoryAchievements = achievements.filter(a => a.category === category);
    if (categoryAchievements.length === 0) return 0;
    const unlocked = categoryAchievements.filter(a => a.unlocked).length;
    return Math.round((unlocked / categoryAchievements.length) * 100);
}

/**
 * Create an achievement item
 */
function createAchievementItem(achievement, index, onEdit, onDelete, onToggle, onUpdateProgress) {
    const category = ACHIEVEMENT_CATEGORIES[achievement.category] || ACHIEVEMENT_CATEGORIES.Combat;
    const hasProgress = achievement.progressMax && achievement.progressMax > 0;
    const progressPercent = hasProgress
        ? Math.min(100, Math.round((achievement.progressCurrent || 0) / achievement.progressMax * 100))
        : 0;

    return h('div', {
        class: `vmt_achievement_item ${achievement.unlocked ? 'vmt_achievement_unlocked' : 'vmt_achievement_locked'}`,
        style: achievement.unlocked ? `border-left-color: ${category.color}` : ''
    },
        h('div', { class: 'vmt_achievement_header' },
            h('div', { class: 'vmt_achievement_icon', style: `background: ${category.color}20; color: ${category.color}` },
                achievement.unlocked ? '' : ''
            ),
            h('div', { class: 'vmt_achievement_info' },
                h('div', { class: 'vmt_achievement_name' }, achievement.name),
                h('div', { class: 'vmt_achievement_desc' }, achievement.description)
            ),
            h('div', { class: 'vmt_achievement_actions' },
                h('button', {
                    class: `vmt_btn_icon ${achievement.unlocked ? 'vmt_btn_success' : ''}`,
                    onclick: () => onToggle(index),
                    title: achievement.unlocked ? 'Mark as locked' : 'Mark as unlocked'
                }, achievement.unlocked ? '' : ''),
                h('button', {
                    class: 'vmt_btn_icon',
                    onclick: () => onEdit(index),
                    title: 'Edit achievement'
                }, ''),
                h('button', {
                    class: 'vmt_btn_icon vmt_btn_danger',
                    onclick: () => onDelete(index),
                    title: 'Delete achievement'
                }, '')
            )
        ),
        // Progress bar if trackable
        hasProgress ? h('div', { class: 'vmt_achievement_progress' },
            h('div', { class: 'vmt_achievement_progress_bar' },
                h('div', {
                    class: 'vmt_achievement_progress_fill',
                    style: `width: ${progressPercent}%; background: linear-gradient(90deg, ${category.color}, ${category.color}aa)`
                })
            ),
            h('div', { class: 'vmt_achievement_progress_text' },
                h('input', {
                    type: 'number',
                    class: 'vmt_progress_input',
                    value: achievement.progressCurrent || 0,
                    min: 0,
                    max: achievement.progressMax,
                    onchange: (e) => onUpdateProgress(index, parseInt(e.target.value, 10) || 0)
                }),
                h('span', {}, ` / ${achievement.progressMax}`)
            )
        ) : null,
        // Meta info
        h('div', { class: 'vmt_achievement_meta' },
            h('span', {
                class: 'vmt_achievement_category_badge',
                style: `background: ${category.color}20; color: ${category.color}; border-color: ${category.color}40`
            }, achievement.category),
            achievement.unlocked && achievement.unlockDate ?
                h('span', { class: 'vmt_achievement_unlock_date' }, `Unlocked: ${formatDate(achievement.unlockDate)}`) : null,
            achievement.rewards ?
                h('span', { class: 'vmt_achievement_rewards' }, `Rewards: ${achievement.rewards}`) : null
        )
    );
}

// Local filter state
let categoryFilter = 'All';
let statusFilter = 'All';

/**
 * Render the Achievements tab content
 */
export function renderAchievementsTab(openModal, render) {
    const state = getState();
    const achievements = state.achievements || [];

    const container = h('div', { class: 'vmt_achievements_tab' });

    // Category completion summary
    const summary = h('div', { class: 'vmt_achievements_summary' });

    // Overall completion
    const totalUnlocked = achievements.filter(a => a.unlocked).length;
    const totalPercent = achievements.length > 0 ? Math.round((totalUnlocked / achievements.length) * 100) : 0;

    summary.appendChild(
        h('div', { class: 'vmt_summary_item vmt_summary_total' },
            h('div', { class: 'vmt_summary_label' }, 'Overall'),
            h('div', { class: 'vmt_summary_value vmt_highlight' }, `${totalPercent}%`),
            h('div', { class: 'vmt_summary_sublabel' }, `${totalUnlocked}/${achievements.length}`)
        )
    );

    // Per-category completion
    Object.entries(ACHIEVEMENT_CATEGORIES).forEach(([name, cat]) => {
        const categoryAchievements = achievements.filter(a => a.category === name);
        const unlocked = categoryAchievements.filter(a => a.unlocked).length;
        const percent = getCategoryCompletion(achievements, name);

        summary.appendChild(
            h('div', {
                class: 'vmt_summary_item',
                style: `border-bottom: 2px solid ${cat.color}`
            },
                h('div', { class: 'vmt_summary_icon', style: `color: ${cat.color}` }, cat.icon),
                h('div', { class: 'vmt_summary_label' }, name),
                h('div', { class: 'vmt_summary_value', style: `color: ${cat.color}` }, `${percent}%`),
                h('div', { class: 'vmt_summary_sublabel' }, `${unlocked}/${categoryAchievements.length}`)
            )
        );
    });

    container.appendChild(summary);

    // Main section
    const mainSection = h('div', { class: 'vmt_section vmt_achievements_section' },
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Achievements'),
            h('button', {
                class: 'vmt_btn_small vmt_btn_add',
                onclick: () => openModal('add-achievement', {
                    onSave: async (achievement) => {
                        const newAchievement = {
                            ...achievement,
                            id: generateId(),
                            unlocked: false,
                            unlockDate: null,
                            progressCurrent: 0
                        };
                        const updated = [...achievements, newAchievement];
                        await updateField('achievements', updated);
                        render();
                    }
                })
            }, '+ Add')
        )
    );

    // Filters
    const filterRow = h('div', { class: 'vmt_achievements_filters' },
        h('div', { class: 'vmt_filter_group' },
            h('span', { class: 'vmt_filter_label' }, 'Category:'),
            h('select', {
                class: 'vmt_filter_select',
                onchange: (e) => { categoryFilter = e.target.value; render(); }
            },
                h('option', { value: 'All', selected: categoryFilter === 'All' ? 'selected' : null }, 'All'),
                ...Object.keys(ACHIEVEMENT_CATEGORIES).map(cat =>
                    h('option', { value: cat, selected: categoryFilter === cat ? 'selected' : null }, cat)
                )
            )
        ),
        h('div', { class: 'vmt_filter_group' },
            h('span', { class: 'vmt_filter_label' }, 'Status:'),
            h('select', {
                class: 'vmt_filter_select',
                onchange: (e) => { statusFilter = e.target.value; render(); }
            },
                h('option', { value: 'All', selected: statusFilter === 'All' ? 'selected' : null }, 'All'),
                h('option', { value: 'Unlocked', selected: statusFilter === 'Unlocked' ? 'selected' : null }, 'Unlocked'),
                h('option', { value: 'Locked', selected: statusFilter === 'Locked' ? 'selected' : null }, 'Locked'),
                h('option', { value: 'In Progress', selected: statusFilter === 'In Progress' ? 'selected' : null }, 'In Progress')
            )
        )
    );
    mainSection.appendChild(filterRow);

    // Achievements list
    let filteredAchievements = achievements;
    if (categoryFilter !== 'All') {
        filteredAchievements = filteredAchievements.filter(a => a.category === categoryFilter);
    }
    if (statusFilter !== 'All') {
        if (statusFilter === 'Unlocked') {
            filteredAchievements = filteredAchievements.filter(a => a.unlocked);
        } else if (statusFilter === 'Locked') {
            filteredAchievements = filteredAchievements.filter(a => !a.unlocked);
        } else if (statusFilter === 'In Progress') {
            filteredAchievements = filteredAchievements.filter(a =>
                !a.unlocked && a.progressMax > 0 && (a.progressCurrent || 0) > 0
            );
        }
    }

    const achievementsList = h('div', { class: 'vmt_achievements_list' });

    if (filteredAchievements.length === 0) {
        achievementsList.appendChild(h('div', { class: 'vmt_empty' }, 'No achievements'));
    } else {
        // Group by category if viewing all
        if (categoryFilter === 'All') {
            Object.entries(ACHIEVEMENT_CATEGORIES).forEach(([catName, catInfo]) => {
                const catAchievements = filteredAchievements.filter(a => a.category === catName);
                if (catAchievements.length === 0) return;

                achievementsList.appendChild(
                    h('div', { class: 'vmt_achievement_category_header' },
                        h('span', { class: 'vmt_category_icon', style: `color: ${catInfo.color}` }, catInfo.icon),
                        h('span', { class: 'vmt_category_label' }, catName),
                        h('span', { class: 'vmt_category_count' }, `(${catAchievements.filter(a => a.unlocked).length}/${catAchievements.length})`)
                    )
                );

                catAchievements.forEach((achievement) => {
                    const originalIndex = achievements.indexOf(achievement);
                    achievementsList.appendChild(createAchievementItem(
                        achievement,
                        originalIndex,
                        // Edit
                        (idx) => openModal('edit-achievement', {
                            achievement: achievements[idx],
                            onSave: async (updated) => {
                                const list = [...achievements];
                                list[idx] = { ...list[idx], ...updated };
                                await updateField('achievements', list);
                                render();
                            }
                        }),
                        // Delete
                        async (idx) => {
                            const list = achievements.filter((_, j) => j !== idx);
                            await updateField('achievements', list);
                            render();
                        },
                        // Toggle unlock
                        async (idx) => {
                            const list = [...achievements];
                            const wasUnlocked = list[idx].unlocked;
                            list[idx] = {
                                ...list[idx],
                                unlocked: !wasUnlocked,
                                unlockDate: !wasUnlocked ? Date.now() : null,
                                progressCurrent: !wasUnlocked && list[idx].progressMax ? list[idx].progressMax : list[idx].progressCurrent
                            };
                            await updateField('achievements', list);
                            render();
                        },
                        // Update progress
                        async (idx, progress) => {
                            const list = [...achievements];
                            const isComplete = progress >= list[idx].progressMax;
                            list[idx] = {
                                ...list[idx],
                                progressCurrent: progress,
                                unlocked: isComplete ? true : list[idx].unlocked,
                                unlockDate: isComplete && !list[idx].unlocked ? Date.now() : list[idx].unlockDate
                            };
                            await updateField('achievements', list);
                            render();
                        }
                    ));
                });
            });
        } else {
            filteredAchievements.forEach((achievement) => {
                const originalIndex = achievements.indexOf(achievement);
                achievementsList.appendChild(createAchievementItem(
                    achievement,
                    originalIndex,
                    (idx) => openModal('edit-achievement', {
                        achievement: achievements[idx],
                        onSave: async (updated) => {
                            const list = [...achievements];
                            list[idx] = { ...list[idx], ...updated };
                            await updateField('achievements', list);
                            render();
                        }
                    }),
                    async (idx) => {
                        const list = achievements.filter((_, j) => j !== idx);
                        await updateField('achievements', list);
                        render();
                    },
                    async (idx) => {
                        const list = [...achievements];
                        const wasUnlocked = list[idx].unlocked;
                        list[idx] = {
                            ...list[idx],
                            unlocked: !wasUnlocked,
                            unlockDate: !wasUnlocked ? Date.now() : null,
                            progressCurrent: !wasUnlocked && list[idx].progressMax ? list[idx].progressMax : list[idx].progressCurrent
                        };
                        await updateField('achievements', list);
                        render();
                    },
                    async (idx, progress) => {
                        const list = [...achievements];
                        const isComplete = progress >= list[idx].progressMax;
                        list[idx] = {
                            ...list[idx],
                            progressCurrent: progress,
                            unlocked: isComplete ? true : list[idx].unlocked,
                            unlockDate: isComplete && !list[idx].unlocked ? Date.now() : list[idx].unlockDate
                        };
                        await updateField('achievements', list);
                        render();
                    }
                ));
            });
        }
    }

    mainSection.appendChild(achievementsList);
    container.appendChild(mainSection);

    return container;
}
