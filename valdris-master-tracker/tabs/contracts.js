/**
 * Valdris Master Tracker - Contracts Tab
 * Track active agreements, quests, and obligations
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
 * Contract types
 */
const CONTRACT_TYPES = ['Quest', 'Pact', 'Debt', 'Service', 'Other'];

/**
 * Contract statuses
 */
const CONTRACT_STATUSES = ['Active', 'Complete', 'Failed', 'Expired'];

/**
 * Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Check if deadline is overdue
 */
function isOverdue(deadline, status) {
    if (!deadline || status !== 'Active') return false;
    return new Date(deadline) < new Date();
}

/**
 * Format deadline for display
 */
function formatDeadline(deadline) {
    if (!deadline) return 'None';
    const date = new Date(deadline);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Get status color
 */
function getStatusColor(status, overdue = false) {
    if (overdue) return '#ff4466';
    switch (status) {
        case 'Active': return '#66dd88';
        case 'Complete': return '#5588ee';
        case 'Failed': return '#dd4444';
        case 'Expired': return '#888888';
        default: return '#aaaaaa';
    }
}

/**
 * Get type color
 */
function getTypeColor(type) {
    switch (type) {
        case 'Quest': return '#ddaa33';
        case 'Pact': return '#b380ff';
        case 'Debt': return '#dd6666';
        case 'Service': return '#5588ee';
        default: return '#aaaaaa';
    }
}

// Local state for expanded contracts
let expandedContracts = new Set();

/**
 * Create a contract item
 */
function createContractItem(contract, index, onEdit, onDelete, onStatusChange, onToggleObjective) {
    const overdue = isOverdue(contract.deadline, contract.status);
    const statusColor = getStatusColor(contract.status, overdue);
    const typeColor = getTypeColor(contract.type);
    const isExpanded = expandedContracts.has(contract.id);

    const completedObjectives = (contract.objectives || []).filter(o => o.completed).length;
    const totalObjectives = (contract.objectives || []).length;

    return h('div', {
        class: `vmt_contract_item ${overdue ? 'vmt_contract_overdue' : ''} ${contract.status === 'Complete' ? 'vmt_contract_complete' : ''}`,
        style: `border-left-color: ${typeColor}`
    },
        // Header row
        h('div', { class: 'vmt_contract_header' },
            h('div', {
                class: 'vmt_contract_expand_toggle',
                onclick: () => {
                    if (isExpanded) {
                        expandedContracts.delete(contract.id);
                    } else {
                        expandedContracts.add(contract.id);
                    }
                    // Force re-render
                    const event = new CustomEvent('vmt-rerender');
                    document.dispatchEvent(event);
                }
            }, isExpanded ? '▼' : '▶'),
            h('div', { class: 'vmt_contract_info' },
                h('div', { class: 'vmt_contract_name' }, contract.name || 'Unnamed Contract'),
                h('div', { class: 'vmt_contract_meta_row' },
                    h('span', {
                        class: 'vmt_contract_type_badge',
                        style: `background: ${typeColor}20; color: ${typeColor}; border-color: ${typeColor}40`
                    }, contract.type || 'Quest'),
                    h('span', {
                        class: 'vmt_contract_status_badge',
                        style: `background: ${statusColor}20; color: ${statusColor}; border-color: ${statusColor}40`
                    }, overdue ? 'OVERDUE' : contract.status),
                    contract.contractor ? h('span', { class: 'vmt_contract_contractor' }, `From: ${contract.contractor}`) : null
                )
            ),
            h('div', { class: 'vmt_contract_actions' },
                h('button', {
                    class: 'vmt_btn_icon',
                    onclick: () => onEdit(index),
                    title: 'Edit contract'
                }, ''),
                h('button', {
                    class: 'vmt_btn_icon vmt_btn_danger',
                    onclick: () => onDelete(index),
                    title: 'Remove contract'
                }, '')
            )
        ),
        // Progress bar for objectives
        totalObjectives > 0 ? h('div', { class: 'vmt_contract_progress' },
            h('div', { class: 'vmt_contract_progress_bar' },
                h('div', {
                    class: 'vmt_contract_progress_fill',
                    style: `width: ${(completedObjectives / totalObjectives) * 100}%`
                })
            ),
            h('span', { class: 'vmt_contract_progress_text' }, `${completedObjectives}/${totalObjectives} objectives`)
        ) : null,
        // Expanded details
        isExpanded ? h('div', { class: 'vmt_contract_details' },
            contract.description ? h('div', { class: 'vmt_contract_description' }, contract.description) : null,
            // Objectives
            totalObjectives > 0 ? h('div', { class: 'vmt_contract_objectives' },
                h('div', { class: 'vmt_contract_section_label' }, 'Objectives'),
                h('div', { class: 'vmt_objectives_list' },
                    (contract.objectives || []).map((obj, objIdx) =>
                        h('div', { class: `vmt_objective_item ${obj.completed ? 'completed' : ''}` },
                            h('input', {
                                type: 'checkbox',
                                class: 'vmt_objective_checkbox',
                                checked: obj.completed ? 'checked' : null,
                                onchange: () => onToggleObjective(index, objIdx)
                            }),
                            h('span', { class: 'vmt_objective_text' }, obj.text)
                        )
                    )
                )
            ) : null,
            // Rewards/Penalties
            h('div', { class: 'vmt_contract_rewards_penalties' },
                contract.rewards ? h('div', { class: 'vmt_contract_reward' },
                    h('span', { class: 'vmt_label' }, 'Rewards: '),
                    h('span', { class: 'vmt_value positive' }, contract.rewards)
                ) : null,
                contract.penalties ? h('div', { class: 'vmt_contract_penalty' },
                    h('span', { class: 'vmt_label' }, 'Penalties: '),
                    h('span', { class: 'vmt_value negative' }, contract.penalties)
                ) : null
            ),
            // Deadline
            contract.deadline ? h('div', { class: `vmt_contract_deadline ${overdue ? 'overdue' : ''}` },
                h('span', { class: 'vmt_label' }, 'Deadline: '),
                h('span', { class: 'vmt_value' }, formatDeadline(contract.deadline))
            ) : null,
            // Status change dropdown
            contract.status === 'Active' ? h('div', { class: 'vmt_contract_status_controls' },
                h('select', {
                    class: 'vmt_status_select',
                    onchange: (e) => onStatusChange(index, e.target.value)
                },
                    CONTRACT_STATUSES.map(status =>
                        h('option', { value: status, selected: contract.status === status ? 'selected' : null }, status)
                    )
                )
            ) : null
        ) : null
    );
}

// Local filter state
let statusFilter = 'All';
let typeFilter = 'All';

/**
 * Render the Contracts tab content
 */
export function renderContractsTab(openModal, render) {
    const state = getState();
    const contracts = state.contracts || [];

    // Set up re-render listener for expand/collapse
    const rerenderHandler = () => render();
    document.removeEventListener('vmt-rerender', rerenderHandler);
    document.addEventListener('vmt-rerender', rerenderHandler);

    const container = h('div', { class: 'vmt_contracts_tab' });

    // Summary section
    const activeCount = contracts.filter(c => c.status === 'Active').length;
    const overdueCount = contracts.filter(c => isOverdue(c.deadline, c.status)).length;
    const completedCount = contracts.filter(c => c.status === 'Complete').length;

    const summary = h('div', { class: 'vmt_contracts_summary' },
        h('div', { class: 'vmt_summary_item' },
            h('div', { class: 'vmt_summary_label' }, 'Total'),
            h('div', { class: 'vmt_summary_value' }, contracts.length)
        ),
        h('div', { class: 'vmt_summary_item vmt_summary_active' },
            h('div', { class: 'vmt_summary_label' }, 'Active'),
            h('div', { class: 'vmt_summary_value' }, activeCount)
        ),
        overdueCount > 0 ? h('div', { class: 'vmt_summary_item vmt_summary_overdue' },
            h('div', { class: 'vmt_summary_label' }, 'Overdue'),
            h('div', { class: 'vmt_summary_value' }, overdueCount)
        ) : null,
        h('div', { class: 'vmt_summary_item vmt_summary_completed' },
            h('div', { class: 'vmt_summary_label' }, 'Completed'),
            h('div', { class: 'vmt_summary_value' }, completedCount)
        )
    );
    container.appendChild(summary);

    // Main section
    const mainSection = h('div', { class: 'vmt_section vmt_contracts_section' },
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Contracts'),
            h('button', {
                class: 'vmt_btn_small vmt_btn_add',
                onclick: () => openModal('add-contract', {
                    onSave: async (contract) => {
                        const newContract = {
                            ...contract,
                            id: generateId()
                        };
                        const updated = [...contracts, newContract];
                        await updateField('contracts', updated);
                        render();
                    }
                })
            }, '+ Add')
        )
    );

    // Filters
    const filterRow = h('div', { class: 'vmt_contracts_filters' },
        h('div', { class: 'vmt_filter_group' },
            h('span', { class: 'vmt_filter_label' }, 'Status:'),
            h('select', {
                class: 'vmt_filter_select',
                onchange: (e) => { statusFilter = e.target.value; render(); }
            },
                h('option', { value: 'All', selected: statusFilter === 'All' ? 'selected' : null }, 'All'),
                ...CONTRACT_STATUSES.map(status =>
                    h('option', { value: status, selected: statusFilter === status ? 'selected' : null }, status)
                )
            )
        ),
        h('div', { class: 'vmt_filter_group' },
            h('span', { class: 'vmt_filter_label' }, 'Type:'),
            h('select', {
                class: 'vmt_filter_select',
                onchange: (e) => { typeFilter = e.target.value; render(); }
            },
                h('option', { value: 'All', selected: typeFilter === 'All' ? 'selected' : null }, 'All'),
                ...CONTRACT_TYPES.map(type =>
                    h('option', { value: type, selected: typeFilter === type ? 'selected' : null }, type)
                )
            )
        )
    );
    mainSection.appendChild(filterRow);

    // Contracts list
    let filteredContracts = contracts;
    if (statusFilter !== 'All') {
        filteredContracts = filteredContracts.filter(c => c.status === statusFilter);
    }
    if (typeFilter !== 'All') {
        filteredContracts = filteredContracts.filter(c => c.type === typeFilter);
    }

    // Sort: Active first, then overdue at top, then by deadline
    filteredContracts.sort((a, b) => {
        if (a.status === 'Active' && b.status !== 'Active') return -1;
        if (b.status === 'Active' && a.status !== 'Active') return 1;
        const aOverdue = isOverdue(a.deadline, a.status);
        const bOverdue = isOverdue(b.deadline, b.status);
        if (aOverdue && !bOverdue) return -1;
        if (bOverdue && !aOverdue) return 1;
        return 0;
    });

    const contractsList = h('div', { class: 'vmt_contracts_list' });

    if (filteredContracts.length === 0) {
        contractsList.appendChild(h('div', { class: 'vmt_empty' }, 'No contracts'));
    } else {
        filteredContracts.forEach((contract) => {
            const originalIndex = contracts.indexOf(contract);
            contractsList.appendChild(createContractItem(
                contract,
                originalIndex,
                // Edit
                (idx) => openModal('edit-contract', {
                    contract: contracts[idx],
                    onSave: async (updated) => {
                        const list = [...contracts];
                        list[idx] = { ...list[idx], ...updated };
                        await updateField('contracts', list);
                        render();
                    }
                }),
                // Delete
                async (idx) => {
                    const list = contracts.filter((_, j) => j !== idx);
                    expandedContracts.delete(contracts[idx].id);
                    await updateField('contracts', list);
                    render();
                },
                // Status change
                async (idx, newStatus) => {
                    const list = [...contracts];
                    list[idx] = { ...list[idx], status: newStatus };
                    await updateField('contracts', list);
                    render();
                },
                // Toggle objective
                async (idx, objIdx) => {
                    const list = [...contracts];
                    const objectives = [...(list[idx].objectives || [])];
                    objectives[objIdx] = { ...objectives[objIdx], completed: !objectives[objIdx].completed };
                    list[idx] = { ...list[idx], objectives };

                    // Auto-complete if all objectives done
                    const allComplete = objectives.every(o => o.completed);
                    if (allComplete && objectives.length > 0 && list[idx].status === 'Active') {
                        list[idx].status = 'Complete';
                    }

                    await updateField('contracts', list);
                    render();
                }
            ));
        });
    }

    mainSection.appendChild(contractsList);
    container.appendChild(mainSection);

    return container;
}
