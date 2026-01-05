/**
 * Valdris Master Tracker - Training Tab
 * Skill training progress over time with sessions tracking
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
    return 'trn_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Training types
 */
const TRAINING_TYPES = {
    skill: { name: 'Skill', color: '#5588ee', icon: '' },
    spell: { name: 'Spell', color: '#b380ff', icon: '' },
    proficiency: { name: 'Proficiency', color: '#66aa66', icon: '' },
    language: { name: 'Language', color: '#ddaa33', icon: '' },
    combat: { name: 'Combat', color: '#dd6644', icon: '' },
    craft: { name: 'Crafting', color: '#88cccc', icon: '' }
};

/**
 * Training statuses
 */
const TRAINING_STATUSES = {
    planned: { name: 'Planned', color: '#888888' },
    in_progress: { name: 'In Progress', color: '#5588ee' },
    completed: { name: 'Completed', color: '#66dd88' },
    abandoned: { name: 'Abandoned', color: '#dd6644' }
};

/**
 * Calculate progress percentage
 */
function getTrainingProgress(training) {
    if (!training.totalHours || training.totalHours <= 0) return 0;
    return Math.min(100, Math.max(0, ((training.completedHours || 0) / training.totalHours) * 100));
}

/**
 * Format hours display
 */
function formatHours(hours) {
    if (hours >= 24) {
        const days = Math.floor(hours / 24);
        const remaining = hours % 24;
        return remaining > 0 ? `${days}d ${remaining}h` : `${days}d`;
    }
    return `${hours}h`;
}

/**
 * Create a training card
 */
function createTrainingCard(training, index, onEdit, onDelete, onAddSession, onComplete, onAbandon) {
    const typeData = TRAINING_TYPES[training.type] || TRAINING_TYPES.skill;
    const statusData = TRAINING_STATUSES[training.status] || TRAINING_STATUSES.planned;
    const progress = getTrainingProgress(training);
    const isComplete = training.status === 'completed';
    const isAbandoned = training.status === 'abandoned';
    const isActive = training.status === 'in_progress';

    return h('div', {
        class: `vmt_training_card ${isComplete ? 'vmt_training_complete' : ''} ${isAbandoned ? 'vmt_training_abandoned' : ''}`
    },
        h('div', { class: 'vmt_training_header' },
            h('div', { class: 'vmt_training_info' },
                h('div', { class: 'vmt_training_skill' }, training.skill || 'Unknown Skill'),
                h('div', { class: 'vmt_training_meta' },
                    h('span', {
                        class: 'vmt_training_type',
                        style: `background: ${typeData.color}20; color: ${typeData.color}`
                    }, typeData.name),
                    training.trainer ?
                        h('span', { class: 'vmt_training_trainer' }, `with ${training.trainer}`) : null
                )
            ),
            h('div', {
                class: 'vmt_training_status',
                style: `background: ${statusData.color}20; color: ${statusData.color}; border-color: ${statusData.color}40`
            }, statusData.name),
            h('div', { class: 'vmt_training_actions' },
                h('button', {
                    class: 'vmt_btn_icon',
                    onclick: () => onEdit(index),
                    title: 'Edit training'
                }, ''),
                h('button', {
                    class: 'vmt_btn_icon vmt_btn_danger',
                    onclick: () => onDelete(index),
                    title: 'Remove training'
                }, '')
            )
        ),

        // Progress bar
        h('div', { class: 'vmt_training_progress' },
            h('div', { class: 'vmt_progress_header' },
                h('span', { class: 'vmt_progress_label' },
                    `${formatHours(training.completedHours || 0)} / ${formatHours(training.totalHours || 0)}`
                ),
                h('span', { class: 'vmt_progress_percent' }, `${Math.round(progress)}%`)
            ),
            h('div', { class: 'vmt_progress_bar' },
                h('div', {
                    class: 'vmt_progress_fill',
                    style: `width: ${progress}%; background: linear-gradient(90deg, ${typeData.color}, ${typeData.color}aa)`
                })
            )
        ),

        // Location
        training.location ?
            h('div', { class: 'vmt_training_location' },
                h('span', { class: 'vmt_location_icon' }, ''),
                h('span', { class: 'vmt_location_text' }, training.location)
            ) : null,

        // Cost tracking
        (training.costPerSession || training.totalSpent) ?
            h('div', { class: 'vmt_training_cost' },
                h('span', { class: 'vmt_cost_label' }, 'Cost: '),
                h('span', { class: 'vmt_cost_value' },
                    training.totalSpent ? `${training.totalSpent}g spent` : `${training.costPerSession}g/session`
                )
            ) : null,

        // Prerequisites
        training.prerequisites && training.prerequisites.length > 0 ?
            h('div', { class: 'vmt_training_prereqs' },
                h('span', { class: 'vmt_prereqs_label' }, 'Prerequisites: '),
                h('span', { class: 'vmt_prereqs_text' }, training.prerequisites.join(', '))
            ) : null,

        // Rewards
        training.rewards && training.rewards.length > 0 ?
            h('div', { class: 'vmt_training_rewards' },
                h('span', { class: 'vmt_rewards_label' }, 'Rewards: '),
                h('span', { class: 'vmt_rewards_text' }, training.rewards.join(', '))
            ) : null,

        // Sessions log (recent)
        training.sessionsLog && training.sessionsLog.length > 0 ?
            h('div', { class: 'vmt_training_sessions' },
                h('span', { class: 'vmt_sessions_label' }, `Sessions (${training.sessionsLog.length})`),
                h('div', { class: 'vmt_sessions_list' },
                    training.sessionsLog.slice(-3).reverse().map(session =>
                        h('div', { class: 'vmt_session_item' },
                            h('span', { class: 'vmt_session_date' }, session.date || '-'),
                            h('span', { class: 'vmt_session_hours' }, `${session.hours || 0}h`),
                            session.notes ?
                                h('span', { class: 'vmt_session_notes' }, session.notes) : null
                        )
                    )
                )
            ) : null,

        // Action buttons
        !isComplete && !isAbandoned ?
            h('div', { class: 'vmt_training_quick_actions' },
                h('button', {
                    class: 'vmt_btn_small vmt_btn_primary',
                    onclick: () => onAddSession(index)
                }, '+ Add Session'),
                progress >= 100 ?
                    h('button', {
                        class: 'vmt_btn_small vmt_btn_success',
                        onclick: () => onComplete(index)
                    }, 'Complete') :
                    h('button', {
                        class: 'vmt_btn_small vmt_btn_danger',
                        onclick: () => onAbandon(index)
                    }, 'Abandon')
            ) : null
    );
}

// Local filter state
let typeFilter = 'All';
let statusFilter = 'All';

/**
 * Render the Training tab content
 */
export function renderTrainingTab(openModal, render) {
    const state = getState();
    const training = state.training || [];

    const container = h('div', { class: 'vmt_training_tab' });

    // Summary section
    const inProgress = training.filter(t => t.status === 'in_progress');
    const completed = training.filter(t => t.status === 'completed');
    const totalHoursSpent = training.reduce((sum, t) => sum + (t.completedHours || 0), 0);

    const summary = h('div', { class: 'vmt_training_summary' },
        h('div', { class: 'vmt_summary_item' },
            h('div', { class: 'vmt_summary_label' }, 'Active'),
            h('div', { class: 'vmt_summary_value vmt_text_primary' }, inProgress.length)
        ),
        h('div', { class: 'vmt_summary_item' },
            h('div', { class: 'vmt_summary_label' }, 'Completed'),
            h('div', { class: 'vmt_summary_value vmt_text_success' }, completed.length)
        ),
        h('div', { class: 'vmt_summary_item' },
            h('div', { class: 'vmt_summary_label' }, 'Total Hours'),
            h('div', { class: 'vmt_summary_value' }, formatHours(totalHoursSpent))
        )
    );
    container.appendChild(summary);

    // Main section
    const mainSection = h('div', { class: 'vmt_section vmt_training_section' },
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Training Progress'),
            h('button', {
                class: 'vmt_btn_small vmt_btn_add',
                onclick: () => openModal('add-training', {
                    trainingTypes: TRAINING_TYPES,
                    onSave: async (newTraining) => {
                        const item = {
                            ...newTraining,
                            id: generateId(),
                            completedHours: newTraining.completedHours || 0,
                            totalHours: newTraining.totalHours || 40,
                            status: newTraining.status || 'planned',
                            sessionsLog: [],
                            totalSpent: 0
                        };
                        const updated = [...training, item];
                        await updateField('training', updated);
                        render();
                    }
                })
            }, '+ New Training')
        )
    );

    // Filters
    const filterRow = h('div', { class: 'vmt_training_filters' },
        h('div', { class: 'vmt_filter_group' },
            h('span', { class: 'vmt_filter_label' }, 'Type:'),
            h('select', {
                class: 'vmt_filter_select',
                onchange: (e) => { typeFilter = e.target.value; render(); }
            },
                h('option', { value: 'All', selected: typeFilter === 'All' ? 'selected' : null }, 'All'),
                ...Object.entries(TRAINING_TYPES).map(([key, data]) =>
                    h('option', { value: key, selected: typeFilter === key ? 'selected' : null }, data.name)
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
                ...Object.entries(TRAINING_STATUSES).map(([key, data]) =>
                    h('option', { value: key, selected: statusFilter === key ? 'selected' : null }, data.name)
                )
            )
        )
    );
    mainSection.appendChild(filterRow);

    // Training list
    let filteredTraining = training;
    if (typeFilter !== 'All') {
        filteredTraining = filteredTraining.filter(t => t.type === typeFilter);
    }
    if (statusFilter !== 'All') {
        filteredTraining = filteredTraining.filter(t => t.status === statusFilter);
    }

    const trainingList = h('div', { class: 'vmt_training_list' });

    if (filteredTraining.length === 0) {
        trainingList.appendChild(h('div', { class: 'vmt_empty' },
            h('p', {}, 'No training in progress'),
            h('p', { class: 'vmt_empty_hint' }, 'Start training to learn new skills, spells, or proficiencies.')
        ));
    } else {
        // Sort: in_progress first, then planned, then completed, then abandoned
        const sortOrder = { 'in_progress': 0, 'planned': 1, 'completed': 2, 'abandoned': 3 };
        filteredTraining.sort((a, b) => (sortOrder[a.status] || 99) - (sortOrder[b.status] || 99));

        filteredTraining.forEach((item) => {
            const originalIndex = training.indexOf(item);
            trainingList.appendChild(createTrainingCard(
                item,
                originalIndex,
                // Edit
                (idx) => openModal('edit-training', {
                    training: training[idx],
                    trainingTypes: TRAINING_TYPES,
                    onSave: async (updated) => {
                        const list = [...training];
                        list[idx] = { ...list[idx], ...updated };
                        await updateField('training', list);
                        render();
                    }
                }),
                // Delete
                async (idx) => {
                    const list = training.filter((_, j) => j !== idx);
                    await updateField('training', list);
                    render();
                },
                // Add session
                (idx) => openModal('add-training-session', {
                    training: training[idx],
                    onSave: async (session) => {
                        const list = [...training];
                        const item = list[idx];
                        const newHours = (item.completedHours || 0) + (session.hours || 0);
                        const newSpent = (item.totalSpent || 0) + (item.costPerSession || 0);

                        list[idx] = {
                            ...item,
                            status: 'in_progress',
                            completedHours: newHours,
                            totalSpent: newSpent,
                            sessionsLog: [
                                ...(item.sessionsLog || []),
                                {
                                    date: session.date || new Date().toLocaleDateString(),
                                    hours: session.hours || 0,
                                    notes: session.notes || ''
                                }
                            ]
                        };
                        await updateField('training', list);
                        render();
                    }
                }),
                // Complete
                async (idx) => {
                    const list = [...training];
                    list[idx] = {
                        ...list[idx],
                        status: 'completed',
                        completedHours: list[idx].totalHours // Mark as fully complete
                    };
                    await updateField('training', list);
                    render();
                },
                // Abandon
                async (idx) => {
                    const list = [...training];
                    list[idx] = { ...list[idx], status: 'abandoned' };
                    await updateField('training', list);
                    render();
                }
            ));
        });
    }

    mainSection.appendChild(trainingList);
    container.appendChild(mainSection);

    return container;
}

export { TRAINING_TYPES, TRAINING_STATUSES };
