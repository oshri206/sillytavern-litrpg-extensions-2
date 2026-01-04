/**
 * Valdris Master Tracker - Guilds Tab
 * Track guild/organization memberships
 */

import { getState, updateField } from '../state-manager.js';

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

const GUILD_TYPES = ['Adventurer', 'Merchant', 'Craft', 'Military', 'Criminal', 'Religious', 'Arcane', 'Other'];

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function createTagList(items = [], onChange) {
    const list = h('div', { class: 'vmt_tag_list' },
        ...items.map((item, idx) =>
            h('span', { class: 'vmt_tag' },
                item,
                h('button', {
                    class: 'vmt_tag_remove',
                    onclick: () => {
                        const next = [...items];
                        next.splice(idx, 1);
                        onChange(next);
                    }
                }, 'x')
            )
        )
    );

    const input = h('input', { type: 'text', class: 'vmt_input vmt_input_sm', placeholder: 'Add item...' });
    const addBtn = h('button', {
        class: 'vmt_btn vmt_btn_sm',
        onclick: () => {
            const value = input.value.trim();
            if (!value) return;
            onChange([...(items || []), value]);
            input.value = '';
        }
    }, '+');

    return h('div', { class: 'vmt_effect_list' }, list, h('div', { class: 'vmt_inline_add' }, input, addBtn));
}

function createGuildCard(guild, index, updateGuilds, render) {
    const reputationPercent = Math.min(100, Math.max(0, (guild.reputation || 0)));

    const card = h('div', { class: 'vmt_card vmt_guild_card' });
    card.appendChild(
        h('div', { class: 'vmt_card_header' },
            h('input', {
                type: 'text',
                class: 'vmt_input vmt_input_title',
                value: guild.name || '',
                placeholder: 'Guild name...',
                onchange: (e) => updateGuilds(index, { name: e.target.value })
            }),
            guild.isPrimary ? h('span', { class: 'vmt_primary_badge' }, 'Primary') : null,
            h('button', {
                class: 'vmt_btn_icon vmt_btn_danger',
                onclick: () => updateGuilds(index, null, false, true)
            }, '')
        )
    );

    card.appendChild(
        h('div', { class: 'vmt_grid_2' },
            h('div', { class: 'vmt_field' },
                h('label', { class: 'vmt_label' }, 'Type'),
                h('select', {
                    class: 'vmt_select',
                    onchange: (e) => updateGuilds(index, { type: e.target.value })
                }, ...GUILD_TYPES.map(type =>
                    h('option', { value: type, selected: guild.type === type ? 'selected' : null }, type)
                ))
            ),
            h('div', { class: 'vmt_field' },
                h('label', { class: 'vmt_label' }, 'Rank'),
                h('input', {
                    type: 'text',
                    class: 'vmt_input',
                    value: guild.rank || '',
                    placeholder: 'Rank name...',
                    onchange: (e) => updateGuilds(index, { rank: e.target.value })
                })
            ),
            h('div', { class: 'vmt_field' },
                h('label', { class: 'vmt_label' }, 'Rank Level'),
                h('input', {
                    type: 'number',
                    class: 'vmt_input vmt_input_sm',
                    value: guild.rankLevel ?? 0,
                    onchange: (e) => updateGuilds(index, { rankLevel: Number(e.target.value) })
                })
            ),
            h('div', { class: 'vmt_field' },
                h('label', { class: 'vmt_label' }, 'Join Date'),
                h('input', {
                    type: 'date',
                    class: 'vmt_input',
                    value: guild.joinDate || '',
                    onchange: (e) => updateGuilds(index, { joinDate: e.target.value })
                })
            )
        )
    );

    card.appendChild(
        h('div', { class: 'vmt_guild_reputation' },
            h('div', { class: 'vmt_guild_reputation_header' },
                h('span', { class: 'vmt_label' }, 'Reputation'),
                h('span', { class: 'vmt_label' }, `${guild.reputation ?? 0}`)
            ),
            h('div', { class: 'vmt_progress_bar' },
                h('div', { class: 'vmt_progress_fill', style: `width: ${reputationPercent}%` })
            )
        )
    );

    card.appendChild(
        h('div', { class: 'vmt_grid_2' },
            h('div', { class: 'vmt_field' },
                h('label', { class: 'vmt_label' }, 'Reputation'),
                h('input', {
                    type: 'number',
                    class: 'vmt_input vmt_input_sm',
                    value: guild.reputation ?? 0,
                    onchange: (e) => updateGuilds(index, { reputation: Number(e.target.value) })
                })
            ),
            h('label', { class: 'vmt_toggle' },
                h('input', {
                    type: 'checkbox',
                    checked: guild.isPrimary ? 'checked' : null,
                    onchange: () => {
                        updateGuilds(index, { isPrimary: true }, true, true);
                        render();
                    }
                }),
                h('span', { class: 'vmt_toggle_label' }, 'Primary Guild')
            )
        )
    );

    card.appendChild(
        h('div', { class: 'vmt_grid_2' },
            h('div', { class: 'vmt_field' },
                h('label', { class: 'vmt_label' }, 'Benefits'),
                createTagList(guild.benefits || [], (benefits) => updateGuilds(index, { benefits }))
            ),
            h('div', { class: 'vmt_field' },
                h('label', { class: 'vmt_label' }, 'Duties'),
                createTagList(guild.duties || [], (duties) => updateGuilds(index, { duties }))
            )
        )
    );

    card.appendChild(
        h('div', { class: 'vmt_grid_2' },
            h('div', { class: 'vmt_field' },
                h('label', { class: 'vmt_label' }, 'Guild Dues'),
                h('input', {
                    type: 'text',
                    class: 'vmt_input',
                    value: guild.dues || '',
                    placeholder: 'Optional fees...',
                    onchange: (e) => updateGuilds(index, { dues: e.target.value })
                })
            ),
            h('div', { class: 'vmt_field' },
                h('label', { class: 'vmt_label' }, 'Notes'),
                h('textarea', {
                    class: 'vmt_textarea',
                    placeholder: 'Notes...',
                    onchange: (e) => updateGuilds(index, { notes: e.target.value })
                }, guild.notes || '')
            )
        )
    );

    return card;
}

export function renderGuildsTab(openModal, render) {
    const state = getState();
    const guilds = state.guilds || [];

    const container = h('div', { class: 'vmt_tab_panel' });
    container.appendChild(
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Guild Memberships'),
            h('button', {
                class: 'vmt_btn vmt_btn_primary',
                onclick: async () => {
                    const next = [...guilds, {
                        id: generateId(),
                        name: '',
                        type: 'Adventurer',
                        rank: '',
                        rankLevel: 0,
                        reputation: 0,
                        benefits: [],
                        duties: [],
                        joinDate: '',
                        notes: '',
                        isPrimary: false,
                        dues: ''
                    }];
                    await updateField('guilds', next);
                    render();
                }
            }, '+ Add')
        )
    );

    const list = h('div', { class: 'vmt_card_list' });
    const updateGuilds = async (index, patch, setPrimary = false, shouldRender = false) => {
        const current = getState().guilds || [];
        const next = current.map(guild => ({ ...guild }));
        if (patch === null) {
            next.splice(index, 1);
        } else {
            next[index] = { ...next[index], ...patch };
        }
        if (setPrimary) {
            next.forEach((guild, idx) => {
                guild.isPrimary = idx === index;
            });
        }
        await updateField('guilds', next);
        if (shouldRender) render();
    };

    guilds.forEach((guild, index) => {
        list.appendChild(createGuildCard(guild, index, updateGuilds, render));
    });

    container.appendChild(list);
    return container;
}
