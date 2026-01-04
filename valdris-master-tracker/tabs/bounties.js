/**
 * Valdris Master Tracker - Bounties Tab
 * Track bounties on the character (wanted status)
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
 * Bounty statuses
 */
const BOUNTY_STATUSES = ['Active', 'Claimed', 'Expired', 'Cleared'];

/**
 * Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Format gold value
 */
function formatGold(value) {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return String(value);
}

/**
 * Get bounty danger level
 */
function getDangerLevel(amount) {
    if (amount >= 10000) return { level: 'legendary', color: '#ffaa33', label: 'LEGENDARY' };
    if (amount >= 5000) return { level: 'extreme', color: '#dd4444', label: 'EXTREME' };
    if (amount >= 1000) return { level: 'high', color: '#ff6644', label: 'HIGH' };
    if (amount >= 500) return { level: 'medium', color: '#ddaa33', label: 'MEDIUM' };
    return { level: 'low', color: '#66aa66', label: 'LOW' };
}

/**
 * Get status color
 */
function getStatusColor(status) {
    switch (status) {
        case 'Active': return '#dd4444';
        case 'Claimed': return '#888888';
        case 'Expired': return '#aaaaaa';
        case 'Cleared': return '#66aa66';
        default: return '#aaaaaa';
    }
}

// Local state for expanded bounties
let expandedBounties = new Set();

/**
 * Create a bounty item
 */
function createBountyItem(bounty, index, onEdit, onDelete, onStatusChange, render) {
    const danger = getDangerLevel(bounty.amount || 0);
    const statusColor = getStatusColor(bounty.status);
    const isExpanded = expandedBounties.has(bounty.id);
    const isActive = bounty.status === 'Active';

    return h('div', {
        class: `vmt_bounty_item ${isActive ? 'vmt_bounty_active' : ''} vmt_bounty_${danger.level}`,
        style: isActive ? `border-left-color: ${danger.color}` : 'border-left-color: #666666'
    },
        // Header
        h('div', { class: 'vmt_bounty_header' },
            h('div', {
                class: 'vmt_bounty_expand_toggle',
                onclick: () => {
                    if (isExpanded) {
                        expandedBounties.delete(bounty.id);
                    } else {
                        expandedBounties.add(bounty.id);
                    }
                    render();
                }
            }, isExpanded ? '▼' : '▶'),
            h('div', { class: 'vmt_bounty_info' },
                h('div', { class: 'vmt_bounty_issuer_row' },
                    h('span', { class: 'vmt_bounty_issuer' }, bounty.issuer || 'Unknown'),
                    isActive ? h('span', {
                        class: 'vmt_bounty_danger_badge',
                        style: `background: ${danger.color}20; color: ${danger.color}; border-color: ${danger.color}40`
                    }, danger.label) : null
                ),
                h('div', { class: 'vmt_bounty_meta_row' },
                    h('span', {
                        class: 'vmt_bounty_status_badge',
                        style: `background: ${statusColor}20; color: ${statusColor}; border-color: ${statusColor}40`
                    }, bounty.status || 'Active'),
                    bounty.region ? h('span', { class: 'vmt_bounty_region' }, bounty.region) : null
                )
            ),
            h('div', { class: 'vmt_bounty_amount_display' },
                h('div', { class: 'vmt_bounty_amount', style: isActive ? `color: ${danger.color}` : '' },
                    `${formatGold(bounty.amount || 0)}`
                ),
                h('div', { class: 'vmt_bounty_gold_label' }, 'gold')
            ),
            h('div', { class: 'vmt_bounty_actions' },
                h('button', {
                    class: 'vmt_btn_icon',
                    onclick: () => onEdit(index),
                    title: 'Edit bounty'
                }, ''),
                h('button', {
                    class: 'vmt_btn_icon vmt_btn_danger',
                    onclick: () => onDelete(index),
                    title: 'Remove bounty'
                }, '')
            )
        ),
        // Reason preview
        bounty.reason ? h('div', { class: 'vmt_bounty_reason_preview' }, bounty.reason) : null,
        // Expanded details
        isExpanded ? h('div', { class: 'vmt_bounty_details' },
            // Full reason
            bounty.reason ? h('div', { class: 'vmt_bounty_reason_full' },
                h('span', { class: 'vmt_label' }, 'Wanted for: '),
                h('span', { class: 'vmt_value' }, bounty.reason)
            ) : null,
            // Hunters
            bounty.hunters && bounty.hunters.length > 0 ? h('div', { class: 'vmt_bounty_hunters' },
                h('div', { class: 'vmt_section_label' }, 'Known Hunters'),
                h('div', { class: 'vmt_hunters_list' },
                    bounty.hunters.map(hunter =>
                        h('span', { class: 'vmt_hunter_badge' }, hunter)
                    )
                )
            ) : null,
            // Notes
            bounty.notes ? h('div', { class: 'vmt_bounty_notes' }, bounty.notes) : null,
            // Status change
            isActive ? h('div', { class: 'vmt_bounty_status_controls' },
                h('span', { class: 'vmt_label' }, 'Mark as: '),
                h('select', {
                    class: 'vmt_status_select',
                    onchange: (e) => onStatusChange(index, e.target.value)
                },
                    BOUNTY_STATUSES.map(status =>
                        h('option', { value: status, selected: bounty.status === status ? 'selected' : null }, status)
                    )
                )
            ) : null
        ) : null
    );
}

// Local filter state
let statusFilter = 'All';
let sortBy = 'amount';

/**
 * Render the Bounties tab content
 */
export function renderBountiesTab(openModal, render) {
    const state = getState();
    const bounties = state.bounties || [];

    const container = h('div', { class: 'vmt_bounties_tab' });

    // Calculate totals
    const activeBounties = bounties.filter(b => b.status === 'Active');
    const totalActiveBounty = activeBounties.reduce((sum, b) => sum + (b.amount || 0), 0);
    const highestBounty = activeBounties.length > 0 ?
        Math.max(...activeBounties.map(b => b.amount || 0)) : 0;
    const regionsCount = new Set(activeBounties.map(b => b.region).filter(Boolean)).size;

    const totalDanger = getDangerLevel(totalActiveBounty);

    // Summary section
    const summary = h('div', { class: 'vmt_bounties_summary' },
        h('div', { class: `vmt_summary_item vmt_summary_total_bounty ${totalActiveBounty > 0 ? 'danger' : ''}` },
            h('div', { class: 'vmt_summary_label' }, 'Total Bounty'),
            h('div', { class: 'vmt_summary_value', style: totalActiveBounty > 0 ? `color: ${totalDanger.color}` : '' },
                `${formatGold(totalActiveBounty)}`
            )
        ),
        h('div', { class: 'vmt_summary_item' },
            h('div', { class: 'vmt_summary_label' }, 'Active'),
            h('div', { class: 'vmt_summary_value' }, activeBounties.length)
        ),
        highestBounty > 0 ? h('div', { class: 'vmt_summary_item vmt_summary_highest' },
            h('div', { class: 'vmt_summary_label' }, 'Highest'),
            h('div', { class: 'vmt_summary_value' }, `${formatGold(highestBounty)}`)
        ) : null,
        regionsCount > 0 ? h('div', { class: 'vmt_summary_item' },
            h('div', { class: 'vmt_summary_label' }, 'Regions'),
            h('div', { class: 'vmt_summary_value' }, regionsCount)
        ) : null
    );
    container.appendChild(summary);

    // Danger warning for high bounties
    if (totalActiveBounty >= 1000) {
        container.appendChild(
            h('div', { class: 'vmt_bounty_warning', style: `border-color: ${totalDanger.color}; background: ${totalDanger.color}15` },
                h('span', { class: 'vmt_warning_icon' }, ''),
                h('span', { class: 'vmt_warning_text', style: `color: ${totalDanger.color}` },
                    totalActiveBounty >= 10000 ? 'LEGENDARY BOUNTY - Extreme danger! Elite hunters are after you!' :
                    totalActiveBounty >= 5000 ? 'EXTREME BOUNTY - Professional hunters are tracking you!' :
                    'HIGH BOUNTY - Watch your back, bounty hunters are looking for you!'
                )
            )
        );
    }

    // Main section
    const mainSection = h('div', { class: 'vmt_section vmt_bounties_section' },
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Bounties'),
            h('button', {
                class: 'vmt_btn_small vmt_btn_add',
                onclick: () => openModal('add-bounty', {
                    onSave: async (bounty) => {
                        const newBounty = {
                            ...bounty,
                            id: generateId(),
                            status: 'Active'
                        };
                        const updated = [...bounties, newBounty];
                        await updateField('bounties', updated);
                        render();
                    }
                })
            }, '+ Add')
        )
    );

    // Filters and sort
    const filterRow = h('div', { class: 'vmt_bounties_filters' },
        h('div', { class: 'vmt_filter_group' },
            h('span', { class: 'vmt_filter_label' }, 'Status:'),
            h('select', {
                class: 'vmt_filter_select',
                onchange: (e) => { statusFilter = e.target.value; render(); }
            },
                h('option', { value: 'All', selected: statusFilter === 'All' ? 'selected' : null }, 'All'),
                ...BOUNTY_STATUSES.map(status =>
                    h('option', { value: status, selected: statusFilter === status ? 'selected' : null }, status)
                )
            )
        ),
        h('div', { class: 'vmt_filter_group' },
            h('span', { class: 'vmt_filter_label' }, 'Sort:'),
            h('select', {
                class: 'vmt_filter_select',
                onchange: (e) => { sortBy = e.target.value; render(); }
            },
                h('option', { value: 'amount', selected: sortBy === 'amount' ? 'selected' : null }, 'Amount'),
                h('option', { value: 'region', selected: sortBy === 'region' ? 'selected' : null }, 'Region'),
                h('option', { value: 'issuer', selected: sortBy === 'issuer' ? 'selected' : null }, 'Issuer')
            )
        )
    );
    mainSection.appendChild(filterRow);

    // Bounties list
    let filteredBounties = bounties;
    if (statusFilter !== 'All') {
        filteredBounties = filteredBounties.filter(b => b.status === statusFilter);
    }

    // Sort
    filteredBounties.sort((a, b) => {
        // Active always first
        if (a.status === 'Active' && b.status !== 'Active') return -1;
        if (b.status === 'Active' && a.status !== 'Active') return 1;

        switch (sortBy) {
            case 'amount':
                return (b.amount || 0) - (a.amount || 0);
            case 'region':
                return (a.region || '').localeCompare(b.region || '');
            case 'issuer':
                return (a.issuer || '').localeCompare(b.issuer || '');
            default:
                return 0;
        }
    });

    const bountiesList = h('div', { class: 'vmt_bounties_list' });

    if (filteredBounties.length === 0) {
        bountiesList.appendChild(h('div', { class: 'vmt_empty' },
            statusFilter === 'Active' ? 'No active bounties - You\'re clean!' : 'No bounties'
        ));
    } else {
        filteredBounties.forEach((bounty) => {
            const originalIndex = bounties.indexOf(bounty);
            bountiesList.appendChild(createBountyItem(
                bounty,
                originalIndex,
                // Edit
                (idx) => openModal('edit-bounty', {
                    bounty: bounties[idx],
                    onSave: async (updated) => {
                        const list = [...bounties];
                        list[idx] = { ...list[idx], ...updated };
                        await updateField('bounties', list);
                        render();
                    }
                }),
                // Delete
                async (idx) => {
                    const list = bounties.filter((_, j) => j !== idx);
                    expandedBounties.delete(bounties[idx].id);
                    await updateField('bounties', list);
                    render();
                },
                // Status change
                async (idx, newStatus) => {
                    const list = [...bounties];
                    list[idx] = { ...list[idx], status: newStatus };
                    await updateField('bounties', list);
                    render();
                },
                render
            ));
        });
    }

    mainSection.appendChild(bountiesList);
    container.appendChild(mainSection);

    return container;
}
