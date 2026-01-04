/**
 * Valdris Master Tracker - Collections Tab
 * Track collectible sets and discoveries
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

const COLLECTION_CATEGORIES = [
    { key: 'monsters', label: 'Monster Codex' },
    { key: 'recipes', label: 'Recipe Book' },
    { key: 'locations', label: 'Map Discoveries' },
    { key: 'rareItems', label: 'Rare Items Found' },
    { key: 'achievements', label: 'Achievements Gallery' }
];

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function getCompletion(items = []) {
    const total = items.length || 0;
    const found = items.filter(item => item.found).length;
    const percent = total > 0 ? Math.round((found / total) * 100) : 0;
    return { total, found, percent };
}

function createItemCard(item, itemIndex, collection, collectionIndex, categoryKey, updateCollections) {
    return h('div', { class: `vmt-collection-item ${item.found ? 'found' : 'unfound'}` },
        h('label', { class: 'vmt_toggle' },
            h('input', {
                type: 'checkbox',
                checked: item.found ? 'checked' : null,
                onchange: (e) => updateCollections(categoryKey, collectionIndex, itemIndex, { found: e.target.checked })
            }),
            h('span', { class: 'vmt_toggle_label' }, item.name || 'Unnamed')
        ),
        item.notes ? h('div', { class: 'vmt_text_muted' }, item.notes) : null,
        h('button', {
            class: 'vmt_btn_icon vmt_btn_danger',
            onclick: () => updateCollections(categoryKey, collectionIndex, itemIndex, null, true)
        }, '')
    );
}

function createCollectionCard(collection, index, categoryKey, updateCollections, itemsWithIndex) {
    const { total, found, percent } = getCompletion(collection.items || []);

    const itemGrid = h('div', { class: 'vmt-collection-grid' },
        ...(itemsWithIndex || []).map(({ item, index: itemIndex }) =>
            createItemCard(item, itemIndex, collection, index, categoryKey, updateCollections)
        )
    );

    const addInput = h('input', { type: 'text', class: 'vmt_input vmt_input_sm', placeholder: 'Add item...' });
    const notesInput = h('input', { type: 'text', class: 'vmt_input vmt_input_sm', placeholder: 'Notes (optional)...' });
    const addBtn = h('button', {
        class: 'vmt_btn vmt_btn_sm',
        onclick: () => {
            const name = addInput.value.trim();
            if (!name) return;
            const nextItems = [...(collection.items || []), { name, found: false, notes: notesInput.value.trim() }];
            updateCollections(categoryKey, index, null, { items: nextItems }, true);
            addInput.value = '';
            notesInput.value = '';
        }
    }, '+');

    return h('div', { class: 'vmt_card vmt_collection_card' },
        h('div', { class: 'vmt_card_header' },
            h('input', {
                type: 'text',
                class: 'vmt_input vmt_input_title',
                value: collection.name || '',
                placeholder: 'Collection name...',
                onchange: (e) => updateCollections(categoryKey, index, null, { name: e.target.value })
            }),
            h('span', { class: 'vmt_collection_progress' }, `${found}/${total} (${percent}%)`),
            h('button', {
                class: 'vmt_btn_icon vmt_btn_danger',
                onclick: () => updateCollections(categoryKey, index, null, null, true)
            }, '')
        ),
        h('div', { class: 'vmt_field' },
            h('label', { class: 'vmt_label' }, 'Rewards'),
            h('input', {
                type: 'text',
                class: 'vmt_input',
                value: collection.rewards || '',
                placeholder: 'Completion rewards...',
                onchange: (e) => updateCollections(categoryKey, index, null, { rewards: e.target.value })
            })
        ),
        h('div', { class: 'vmt_collection_progress_bar' },
            h('div', { class: 'vmt_progress_bar' },
                h('div', { class: 'vmt_progress_fill', style: `width: ${percent}%` })
            )
        ),
        itemGrid,
        h('div', { class: 'vmt_inline_add' }, addInput, notesInput, addBtn)
    );
}

export function renderCollectionsTab(openModal, render) {
    const state = getState();
    const collections = state.collections || {};

    let activeCategory = 'all';
    let searchTerm = '';

    const container = h('div', { class: 'vmt_tab_panel' });

    const filterRow = h('div', { class: 'vmt_collection_filters' },
        h('select', {
            class: 'vmt_select',
            onchange: (e) => {
                activeCategory = e.target.value;
                renderCollections();
            }
        },
            h('option', { value: 'all' }, 'All Categories'),
            ...COLLECTION_CATEGORIES.map(category =>
                h('option', { value: category.key }, category.label)
            )
        ),
        h('input', {
            type: 'text',
            class: 'vmt_input',
            placeholder: 'Search items...',
            oninput: (e) => {
                searchTerm = e.target.value.toLowerCase();
                renderCollections();
            }
        })
    );

    const addRow = h('div', { class: 'vmt_collection_add' });
    const categorySelect = h('select', { class: 'vmt_select' },
        ...COLLECTION_CATEGORIES.map(category =>
            h('option', { value: category.key }, category.label)
        )
    );
    const nameInput = h('input', { type: 'text', class: 'vmt_input', placeholder: 'New collection name...' });
    const addBtn = h('button', {
        class: 'vmt_btn vmt_btn_primary',
        onclick: async () => {
            const key = categorySelect.value;
            const name = nameInput.value.trim();
            if (!name) return;
            const next = [...(collections[key] || []), { id: generateId(), name, items: [], rewards: '' }];
            await updateField(`collections.${key}`, next);
            nameInput.value = '';
            render();
        }
    }, '+ Add Collection');

    addRow.appendChild(categorySelect);
    addRow.appendChild(nameInput);
    addRow.appendChild(addBtn);

    const list = h('div', { class: 'vmt_collection_list' });

    const updateCollections = async (categoryKey, collectionIndex, itemIndex, patch, shouldRender = false) => {
        const currentCollections = getState().collections || {};
        const nextCategory = [...(currentCollections[categoryKey] || [])];
        if (patch === null && itemIndex === null) {
            nextCategory.splice(collectionIndex, 1);
        } else if (itemIndex !== null && itemIndex !== undefined) {
            const items = [...(nextCategory[collectionIndex].items || [])];
            if (patch === null) {
                items.splice(itemIndex, 1);
            } else {
                items[itemIndex] = { ...items[itemIndex], ...patch };
            }
            nextCategory[collectionIndex] = { ...nextCategory[collectionIndex], items };
        } else {
            nextCategory[collectionIndex] = { ...nextCategory[collectionIndex], ...patch };
        }
        await updateField(`collections.${categoryKey}`, nextCategory);
        if (shouldRender) render();
    };

    const renderCollections = () => {
        list.innerHTML = '';
        COLLECTION_CATEGORIES.forEach(category => {
            if (activeCategory !== 'all' && activeCategory !== category.key) return;
            const categoryCollections = collections[category.key] || [];
            if (!categoryCollections.length) return;

            list.appendChild(h('h4', { class: 'vmt_section_title' }, category.label));

            categoryCollections.forEach((collection, index) => {
                const itemsWithIndex = (collection.items || [])
                    .map((item, itemIndex) => ({ item, index: itemIndex }))
                    .filter(({ item }) => (searchTerm ? item.name?.toLowerCase().includes(searchTerm) : true));
                list.appendChild(createCollectionCard(collection, index, category.key, updateCollections, itemsWithIndex));
            });
        });
    };

    container.appendChild(
        h('div', { class: 'vmt_section_header' },
            h('span', { class: 'vmt_section_title' }, 'Collections')
        )
    );
    container.appendChild(filterRow);
    container.appendChild(addRow);
    container.appendChild(list);

    renderCollections();
    return container;
}
