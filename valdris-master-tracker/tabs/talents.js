/**
 * Valdris Master Tracker - Talents Tab
 * Track talent tree progression
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

const TALENT_TIERS = [1, 2, 3, 4, 5];

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function createEffectList(items = [], onChange) {
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

    const input = h('input', { type: 'text', class: 'vmt_input vmt_input_sm', placeholder: 'Add effect...' });
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

function createTalentRow(talent, talentIndex, treeIndex, updateTrees) {
    return h('div', { class: 'vmt_card vmt_talent_row' },
        h('div', { class: 'vmt_grid_2' },
            h('input', {
                type: 'text',
                class: 'vmt_input',
                value: talent.name || '',
                placeholder: 'Talent name...',
                onchange: (e) => updateTrees(treeIndex, talentIndex, { name: e.target.value })
            }),
            h('select', {
                class: 'vmt_select vmt_input_sm',
                onchange: (e) => updateTrees(treeIndex, talentIndex, { tier: Number(e.target.value) })
            }, ...TALENT_TIERS.map(tier =>
                h('option', { value: tier, selected: talent.tier === tier ? 'selected' : null }, `Tier ${tier}`)
            ))
        ),
        h('div', { class: 'vmt_grid_2' },
            h('div', { class: 'vmt_field' },
                h('label', { class: 'vmt_label' }, 'Points'),
                h('div', { class: 'vmt_inline_fields' },
                    h('input', {
                        type: 'number',
                        class: 'vmt_input vmt_input_sm',
                        value: talent.pointsInvested ?? 0,
                        min: 0,
                        onchange: (e) => updateTrees(treeIndex, talentIndex, { pointsInvested: Number(e.target.value) })
                    }),
                    h('span', { class: 'vmt_text_muted' }, '/'),
                    h('input', {
                        type: 'number',
                        class: 'vmt_input vmt_input_sm',
                        value: talent.pointsMax ?? 1,
                        min: 1,
                        onchange: (e) => updateTrees(treeIndex, talentIndex, { pointsMax: Number(e.target.value) })
                    })
                )
            ),
            h('label', { class: 'vmt_toggle' },
                h('input', {
                    type: 'checkbox',
                    checked: talent.unlocked ? 'checked' : null,
                    onchange: (e) => updateTrees(treeIndex, talentIndex, { unlocked: e.target.checked })
                }),
                h('span', { class: 'vmt_toggle_label' }, 'Unlocked')
            )
        ),
        h('div', { class: 'vmt_field' },
            h('label', { class: 'vmt_label' }, 'Prerequisite'),
            h('input', {
                type: 'text',
                class: 'vmt_input',
                value: talent.prerequisite || '',
                placeholder: 'Prerequisite talent...',
                onchange: (e) => updateTrees(treeIndex, talentIndex, { prerequisite: e.target.value })
            })
        ),
        h('div', { class: 'vmt_field' },
            h('label', { class: 'vmt_label' }, 'Description'),
            h('textarea', {
                class: 'vmt_textarea',
                onchange: (e) => updateTrees(treeIndex, talentIndex, { description: e.target.value })
            }, talent.description || '')
        ),
        h('div', { class: 'vmt_field' },
            h('label', { class: 'vmt_label' }, 'Effects'),
            createEffectList(talent.effects || [], (effects) => updateTrees(treeIndex, talentIndex, { effects }))
        ),
        h('button', {
            class: 'vmt_btn_icon vmt_btn_danger',
            onclick: () => updateTrees(treeIndex, talentIndex, null, true)
        }, '')
    );
}

function createTreeCard(tree, treeIndex, updateTrees, render) {
    const card = h('div', { class: 'vmt_card vmt_talent_tree_card' });

    card.appendChild(
        h('div', { class: 'vmt_card_header' },
            h('input', {
                type: 'text',
                class: 'vmt_input vmt_input_title',
                value: tree.name || '',
                placeholder: 'Tree name...',
                onchange: (e) => updateTrees(treeIndex, null, { name: e.target.value })
            }),
            h('div', { class: 'vmt_inline_fields' },
                h('label', { class: 'vmt_label' }, 'Points'),
                h('input', {
                    type: 'number',
                    class: 'vmt_input vmt_input_sm',
                    value: tree.points ?? 0,
                    min: 0,
                    onchange: (e) => updateTrees(treeIndex, null, { points: Number(e.target.value) })
                })
            ),
            h('button', {
                class: 'vmt_btn vmt_btn_sm',
                onclick: () => {
                    updateTrees(treeIndex, (tree.talents || []).length, {
                        id: generateId(),
                        name: '',
                        tier: 1,
                        pointsInvested: 0,
                        pointsMax: 1,
                        prerequisite: '',
                        description: '',
                        effects: [],
                        unlocked: false
                    });
                    render();
                }
            }, '+ Talent'),
            h('button', {
                class: 'vmt_btn_icon vmt_btn_danger',
                onclick: () => updateTrees(treeIndex, null, null, true)
            }, '')
        )
    );

    TALENT_TIERS.forEach(tier => {
        const tierTalents = (tree.talents || []).map((talent, index) => ({ talent, index }))
            .filter(({ talent }) => Number(talent.tier || 1) === tier);
        if (tierTalents.length === 0) return;

        const tierSection = h('div', { class: 'vmt_talent_tier' },
            h('h4', { class: 'vmt_talent_tier_title' }, `Tier ${tier}`)
        );

        tierTalents.forEach(({ talent, index }) => {
            tierSection.appendChild(createTalentRow(talent, index, treeIndex, updateTrees));
        });

        card.appendChild(tierSection);
    });

    return card;
}

export function renderTalentsTab(openModal, render) {
    const state = getState();
    const talentsState = state.talents || { availablePoints: 0, trees: [] };

    const container = h('div', { class: 'vmt_tab_panel' });

    container.appendChild(
        h('div', { class: 'vmt_section' },
            h('div', { class: 'vmt_section_header' },
                h('span', { class: 'vmt_section_title' }, 'Talent Points'),
                h('div', { class: 'vmt_inline_fields' },
                    h('label', { class: 'vmt_label' }, 'Available'),
                    h('input', {
                        type: 'number',
                        class: 'vmt_input vmt_input_sm',
                        value: talentsState.availablePoints ?? 0,
                        min: 0,
                        onchange: (e) => updateField('talents.availablePoints', Number(e.target.value))
                    })
                ),
                h('button', {
                    class: 'vmt_btn vmt_btn_primary',
                    onclick: async () => {
                        const next = [...(talentsState.trees || []), { id: generateId(), name: '', points: 0, talents: [] }];
                        await updateField('talents.trees', next);
                        render();
                    }
                }, '+ Add Tree')
            )
        )
    );

    const list = h('div', { class: 'vmt_card_list' });
    const updateTrees = async (treeIndex, talentIndex, patch, shouldRender = false) => {
        const currentTrees = getState().talents?.trees || [];
        const trees = currentTrees.map(tree => ({ ...tree, talents: [...(tree.talents || [])] }));
        if (patch === null && talentIndex === null) {
            trees.splice(treeIndex, 1);
        } else if (talentIndex !== null && talentIndex !== undefined) {
            if (patch === null) {
                trees[treeIndex].talents.splice(talentIndex, 1);
            } else if (trees[treeIndex].talents[talentIndex]) {
                trees[treeIndex].talents[talentIndex] = { ...trees[treeIndex].talents[talentIndex], ...patch };
            } else {
                trees[treeIndex].talents[talentIndex] = patch;
            }
        } else {
            trees[treeIndex] = { ...trees[treeIndex], ...patch };
        }
        await updateField('talents.trees', trees);
        if (shouldRender) render();
    };

    (talentsState.trees || []).forEach((tree, index) => {
        list.appendChild(createTreeCard(tree, index, updateTrees, render));
    });

    container.appendChild(list);
    return container;
}
