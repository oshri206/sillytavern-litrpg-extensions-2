/**
 * Valdris Master Tracker - Karma Tab
 * Track moral alignment and cosmic balance
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

const KARMA_LABELS = [
    { label: 'Pure Evil', value: -1000 },
    { label: 'Evil', value: -700 },
    { label: 'Dark', value: -300 },
    { label: 'Neutral', value: 0 },
    { label: 'Light', value: 300 },
    { label: 'Good', value: 700 },
    { label: 'Saintly', value: 1000 }
];

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function createHistoryRow(entry, index, updateHistory) {
    return h('div', { class: 'vmt_card vmt_karma_history_row' },
        h('input', {
            type: 'text',
            class: 'vmt_input',
            value: entry.action || '',
            placeholder: 'Action...',
            onchange: (e) => updateHistory(index, { action: e.target.value })
        }),
        h('input', {
            type: 'number',
            class: 'vmt_input vmt_input_sm',
            value: entry.change ?? 0,
            onchange: (e) => updateHistory(index, { change: Number(e.target.value) })
        }),
        h('input', {
            type: 'date',
            class: 'vmt_input',
            value: entry.date || '',
            onchange: (e) => updateHistory(index, { date: e.target.value })
        }),
        h('input', {
            type: 'text',
            class: 'vmt_input',
            value: entry.notes || '',
            placeholder: 'Notes...',
            onchange: (e) => updateHistory(index, { notes: e.target.value })
        }),
        h('button', {
            class: 'vmt_btn_icon vmt_btn_danger',
            onclick: () => updateHistory(index, null, true)
        }, '')
    );
}

function createFactionRow(entry, index, updateFaction) {
    return h('div', { class: 'vmt_card vmt_karma_faction_row' },
        h('input', {
            type: 'text',
            class: 'vmt_input',
            value: entry.faction || '',
            placeholder: 'Faction...',
            onchange: (e) => updateFaction(index, { faction: e.target.value })
        }),
        h('input', {
            type: 'number',
            class: 'vmt_input vmt_input_sm',
            value: entry.value ?? 0,
            min: -1000,
            max: 1000,
            onchange: (e) => updateFaction(index, { value: Number(e.target.value) })
        }),
        h('button', {
            class: 'vmt_btn_icon vmt_btn_danger',
            onclick: () => updateFaction(index, null, true)
        }, '')
    );
}

function createEffectList(effects = [], onChange) {
    const list = h('div', { class: 'vmt_tag_list' },
        ...effects.map((effect, idx) =>
            h('span', { class: 'vmt_tag' },
                effect,
                h('button', {
                    class: 'vmt_tag_remove',
                    onclick: () => {
                        const next = [...effects];
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
            onChange([...(effects || []), value]);
            input.value = '';
        }
    }, '+');

    return h('div', { class: 'vmt_effect_list' }, list, h('div', { class: 'vmt_inline_add' }, input, addBtn));
}

export function renderKarmaTab(openModal, render) {
    const state = getState();
    const karma = state.karma || { value: 0, history: [], factionKarma: [], currentEffects: [] };
    const indicatorPosition = ((karma.value + 1000) / 2000) * 100;

    const container = h('div', { class: 'vmt_tab_panel' });

    container.appendChild(
        h('div', { class: 'vmt_section' },
            h('div', { class: 'vmt_section_header' },
                h('span', { class: 'vmt_section_title' }, 'Karma Meter')
            ),
            h('div', { class: 'vmt_karma_controls' },
                h('input', {
                    type: 'number',
                    class: 'vmt_input vmt_input_sm',
                    min: -1000,
                    max: 1000,
                    value: karma.value ?? 0,
                    onchange: (e) => updateField('karma.value', Number(e.target.value))
                }),
                h('input', {
                    type: 'range',
                    class: 'vmt_range',
                    min: -1000,
                    max: 1000,
                    value: karma.value ?? 0,
                    oninput: (e) => updateField('karma.value', Number(e.target.value))
                })
            ),
            h('div', { class: 'vmt_karma_bar' },
                h('div', { class: 'vmt_karma_indicator', style: `left: ${indicatorPosition}%` })
            ),
            h('div', { class: 'vmt_karma_labels' },
                ...KARMA_LABELS.map(label => h('span', { class: 'vmt_karma_label' }, label.label))
            )
        )
    );

    const updateHistory = async (index, patch, shouldRender = false) => {
        const history = [...(getState().karma?.history || [])];
        if (patch === null) {
            history.splice(index, 1);
        } else {
            history[index] = { ...history[index], ...patch };
        }
        await updateField('karma.history', history);
        if (shouldRender) render();
    };

    const updateFaction = async (index, patch, shouldRender = false) => {
        const factionKarma = [...(getState().karma?.factionKarma || [])];
        if (patch === null) {
            factionKarma.splice(index, 1);
        } else {
            factionKarma[index] = { ...factionKarma[index], ...patch };
        }
        await updateField('karma.factionKarma', factionKarma);
        if (shouldRender) render();
    };

    container.appendChild(
        h('div', { class: 'vmt_section' },
            h('div', { class: 'vmt_section_header' },
                h('span', { class: 'vmt_section_title' }, 'Karma History'),
                h('button', {
                    class: 'vmt_btn vmt_btn_sm',
                    onclick: () => updateHistory((karma.history || []).length, { id: generateId(), action: '', change: 0, date: '', notes: '' }, true)
                }, '+ Add Event')
            ),
            h('div', { class: 'vmt_card_list' },
                ...(karma.history || []).map((entry, index) => createHistoryRow(entry, index, updateHistory))
            )
        )
    );

    container.appendChild(
        h('div', { class: 'vmt_section' },
            h('div', { class: 'vmt_section_header' },
                h('span', { class: 'vmt_section_title' }, 'Faction Karma'),
                h('button', {
                    class: 'vmt_btn vmt_btn_sm',
                    onclick: () => updateFaction((karma.factionKarma || []).length, { id: generateId(), faction: '', value: 0 }, true)
                }, '+ Add Faction')
            ),
            h('div', { class: 'vmt_card_list' },
                ...(karma.factionKarma || []).map((entry, index) => createFactionRow(entry, index, updateFaction))
            )
        )
    );

    container.appendChild(
        h('div', { class: 'vmt_section' },
            h('div', { class: 'vmt_section_header' },
                h('span', { class: 'vmt_section_title' }, 'Consequences'),
                h('span', { class: 'vmt_text_muted' }, 'Current effects based on karma level')
            ),
            createEffectList(karma.currentEffects || [], (effects) => updateField('karma.currentEffects', effects))
        )
    );

    return container;
}
