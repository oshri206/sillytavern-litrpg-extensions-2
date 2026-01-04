/**
 * Valdris Master Tracker - Class & Level Tab
 * Class management, features, and multiclass support
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
 * Create XP progress bar for a class
 */
function createClassXPBar(xp, level) {
    const percent = xp.needed > 0 ? Math.min(100, (xp.current / xp.needed) * 100) : 0;

    return h('div', { class: 'vmt_class_xp_bar' },
        h('div', { class: 'vmt_progress_bar vmt_class_xp' },
            h('div', { class: 'vmt_progress_fill', style: `width: ${percent}%` }),
            h('div', { class: 'vmt_progress_text' },
                h('span', { class: 'vmt_progress_values' },
                    `${xp.current} / ${xp.needed} XP`
                )
            )
        )
    );
}

/**
 * Create a feature item with level tag
 */
function createFeatureItem(feature, index, onEdit, onDelete) {
    return h('div', { class: 'vmt_feature_item' },
        h('div', { class: 'vmt_feature_level' }, `Lv.${feature.level}`),
        h('div', { class: 'vmt_feature_content' },
            h('div', { class: 'vmt_feature_name' }, feature.name),
            feature.description
                ? h('div', { class: 'vmt_feature_desc' }, feature.description)
                : null
        ),
        h('div', { class: 'vmt_feature_actions' },
            h('button', {
                class: 'vmt_btn_icon',
                onclick: () => onEdit(index),
                title: 'Edit feature'
            }, ''),
            h('button', {
                class: 'vmt_btn_icon vmt_btn_danger',
                onclick: () => onDelete(index),
                title: 'Remove feature'
            }, '')
        )
    );
}

/**
 * Create the main class card
 */
function createMainClassCard(mainClass, openModal, render) {
    const handleFieldChange = async (field, value) => {
        await updateField(`mainClass.${field}`, value);
        render();
    };

    const handleXPChange = async (field, value) => {
        await updateField(`mainClass.xp.${field}`, parseInt(value, 10) || 0);
        render();
    };

    const handleAddFeature = () => {
        openModal('add-feature', {
            classPath: 'mainClass',
            onSave: async (feature) => {
                const features = [...mainClass.features, feature];
                await updateField('mainClass.features', features);
                render();
            }
        });
    };

    const handleEditFeature = (index) => {
        openModal('edit-feature', {
            feature: mainClass.features[index],
            onSave: async (updatedFeature) => {
                const features = [...mainClass.features];
                features[index] = updatedFeature;
                await updateField('mainClass.features', features);
                render();
            }
        });
    };

    const handleDeleteFeature = async (index) => {
        const features = mainClass.features.filter((_, i) => i !== index);
        await updateField('mainClass.features', features);
        render();
    };

    return h('div', { class: 'vmt_class_card vmt_main_class' },
        h('div', { class: 'vmt_class_header' },
            h('div', { class: 'vmt_class_badge' }, 'Main Class'),
            h('div', { class: 'vmt_class_level_display' },
                h('span', { class: 'vmt_class_level_label' }, 'Level'),
                h('input', {
                    type: 'number',
                    class: 'vmt_input_level',
                    value: mainClass.level,
                    min: 1,
                    max: 999,
                    onchange: (e) => handleFieldChange('level', parseInt(e.target.value, 10) || 1)
                })
            )
        ),

        h('div', { class: 'vmt_class_body' },
            // Class name
            h('div', { class: 'vmt_class_field' },
                h('label', { class: 'vmt_field_label' }, 'Class Name'),
                h('input', {
                    type: 'text',
                    class: 'vmt_input_text',
                    value: mainClass.name,
                    placeholder: 'Enter class name...',
                    onchange: (e) => handleFieldChange('name', e.target.value)
                })
            ),

            // Subclass
            h('div', { class: 'vmt_class_field' },
                h('label', { class: 'vmt_field_label' }, 'Subclass / Specialization'),
                h('input', {
                    type: 'text',
                    class: 'vmt_input_text',
                    value: mainClass.subclass || '',
                    placeholder: 'Enter subclass (optional)...',
                    onchange: (e) => handleFieldChange('subclass', e.target.value)
                })
            ),

            // XP Bar
            h('div', { class: 'vmt_class_xp_section' },
                h('div', { class: 'vmt_xp_inputs' },
                    h('div', { class: 'vmt_xp_field' },
                        h('label', { class: 'vmt_field_label_small' }, 'Current XP'),
                        h('input', {
                            type: 'number',
                            class: 'vmt_input_small',
                            value: mainClass.xp.current,
                            min: 0,
                            onchange: (e) => handleXPChange('current', e.target.value)
                        })
                    ),
                    h('div', { class: 'vmt_xp_field' },
                        h('label', { class: 'vmt_field_label_small' }, 'XP Needed'),
                        h('input', {
                            type: 'number',
                            class: 'vmt_input_small',
                            value: mainClass.xp.needed,
                            min: 1,
                            onchange: (e) => handleXPChange('needed', e.target.value)
                        })
                    )
                ),
                createClassXPBar(mainClass.xp, mainClass.level)
            ),

            // Features
            h('div', { class: 'vmt_features_section' },
                h('div', { class: 'vmt_features_header' },
                    h('span', { class: 'vmt_features_title' }, 'Class Features'),
                    h('button', {
                        class: 'vmt_btn_small vmt_btn_add',
                        onclick: handleAddFeature
                    }, '+ Add Feature')
                ),
                h('div', { class: 'vmt_features_list' },
                    mainClass.features.length === 0
                        ? h('div', { class: 'vmt_features_empty' }, 'No features added yet')
                        : mainClass.features
                            .sort((a, b) => a.level - b.level)
                            .map((f, i) => createFeatureItem(f, i, handleEditFeature, handleDeleteFeature))
                )
            )
        )
    );
}

/**
 * Create a secondary class card
 */
function createSecondaryClassCard(classData, index, openModal, render) {
    const basePath = `secondaryClasses.${index}`;

    const handleFieldChange = async (field, value) => {
        const state = getState();
        const classes = [...state.secondaryClasses];
        const keys = field.split('.');
        let obj = classes[index];
        for (let i = 0; i < keys.length - 1; i++) {
            obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = value;
        await updateField('secondaryClasses', classes);
        render();
    };

    const handleRemoveClass = async () => {
        const state = getState();
        const classes = state.secondaryClasses.filter((_, i) => i !== index);
        await updateField('secondaryClasses', classes);
        render();
    };

    const handleAddFeature = () => {
        openModal('add-feature', {
            classPath: basePath,
            onSave: async (feature) => {
                const state = getState();
                const classes = [...state.secondaryClasses];
                classes[index].features = [...classes[index].features, feature];
                await updateField('secondaryClasses', classes);
                render();
            }
        });
    };

    const handleEditFeature = (featureIndex) => {
        openModal('edit-feature', {
            feature: classData.features[featureIndex],
            onSave: async (updatedFeature) => {
                const state = getState();
                const classes = [...state.secondaryClasses];
                classes[index].features[featureIndex] = updatedFeature;
                await updateField('secondaryClasses', classes);
                render();
            }
        });
    };

    const handleDeleteFeature = async (featureIndex) => {
        const state = getState();
        const classes = [...state.secondaryClasses];
        classes[index].features = classes[index].features.filter((_, i) => i !== featureIndex);
        await updateField('secondaryClasses', classes);
        render();
    };

    return h('div', { class: 'vmt_class_card vmt_secondary_class' },
        h('div', { class: 'vmt_class_header' },
            h('div', { class: 'vmt_class_badge vmt_secondary_badge' }, 'Multiclass'),
            h('div', { class: 'vmt_class_level_display' },
                h('span', { class: 'vmt_class_level_label' }, 'Level'),
                h('input', {
                    type: 'number',
                    class: 'vmt_input_level',
                    value: classData.level,
                    min: 1,
                    max: 999,
                    onchange: (e) => handleFieldChange('level', parseInt(e.target.value, 10) || 1)
                })
            ),
            h('button', {
                class: 'vmt_btn_icon vmt_btn_danger',
                onclick: handleRemoveClass,
                title: 'Remove this class'
            }, '')
        ),

        h('div', { class: 'vmt_class_body' },
            // Class name
            h('div', { class: 'vmt_class_field' },
                h('label', { class: 'vmt_field_label' }, 'Class Name'),
                h('input', {
                    type: 'text',
                    class: 'vmt_input_text',
                    value: classData.name,
                    placeholder: 'Enter class name...',
                    onchange: (e) => handleFieldChange('name', e.target.value)
                })
            ),

            // Subclass
            h('div', { class: 'vmt_class_field' },
                h('label', { class: 'vmt_field_label' }, 'Subclass / Specialization'),
                h('input', {
                    type: 'text',
                    class: 'vmt_input_text',
                    value: classData.subclass || '',
                    placeholder: 'Enter subclass (optional)...',
                    onchange: (e) => handleFieldChange('subclass', e.target.value)
                })
            ),

            // XP Bar
            h('div', { class: 'vmt_class_xp_section' },
                h('div', { class: 'vmt_xp_inputs' },
                    h('div', { class: 'vmt_xp_field' },
                        h('label', { class: 'vmt_field_label_small' }, 'Current XP'),
                        h('input', {
                            type: 'number',
                            class: 'vmt_input_small',
                            value: classData.xp.current,
                            min: 0,
                            onchange: (e) => handleFieldChange('xp.current', parseInt(e.target.value, 10) || 0)
                        })
                    ),
                    h('div', { class: 'vmt_xp_field' },
                        h('label', { class: 'vmt_field_label_small' }, 'XP Needed'),
                        h('input', {
                            type: 'number',
                            class: 'vmt_input_small',
                            value: classData.xp.needed,
                            min: 1,
                            onchange: (e) => handleFieldChange('xp.needed', parseInt(e.target.value, 10) || 1)
                        })
                    )
                ),
                createClassXPBar(classData.xp, classData.level)
            ),

            // Features
            h('div', { class: 'vmt_features_section' },
                h('div', { class: 'vmt_features_header' },
                    h('span', { class: 'vmt_features_title' }, 'Class Features'),
                    h('button', {
                        class: 'vmt_btn_small vmt_btn_add',
                        onclick: handleAddFeature
                    }, '+ Add')
                ),
                h('div', { class: 'vmt_features_list' },
                    classData.features.length === 0
                        ? h('div', { class: 'vmt_features_empty' }, 'No features')
                        : classData.features
                            .sort((a, b) => a.level - b.level)
                            .map((f, i) => createFeatureItem(f, i, handleEditFeature, handleDeleteFeature))
                )
            )
        )
    );
}

/**
 * Create the add multiclass button/section
 */
function createAddMulticlassSection(openModal, render) {
    const handleAddClass = () => {
        openModal('add-class', {
            onSave: async (newClass) => {
                const state = getState();
                const classes = [...state.secondaryClasses, newClass];
                await updateField('secondaryClasses', classes);
                render();
            }
        });
    };

    return h('div', { class: 'vmt_add_multiclass_section' },
        h('button', {
            class: 'vmt_btn_add_class',
            onclick: handleAddClass
        },
            h('span', { class: 'vmt_add_icon' }, '+'),
            h('span', { class: 'vmt_add_text' }, 'Add Multiclass')
        )
    );
}

/**
 * Create combined level summary
 */
function createLevelSummary(mainClass, secondaryClasses) {
    const totalLevel = mainClass.level + secondaryClasses.reduce((sum, c) => sum + c.level, 0);
    const classCount = 1 + secondaryClasses.length;

    return h('div', { class: 'vmt_level_summary' },
        h('div', { class: 'vmt_summary_stat' },
            h('span', { class: 'vmt_summary_value' }, String(totalLevel)),
            h('span', { class: 'vmt_summary_label' }, 'Combined Level')
        ),
        h('div', { class: 'vmt_summary_stat' },
            h('span', { class: 'vmt_summary_value' }, String(classCount)),
            h('span', { class: 'vmt_summary_label' }, classCount === 1 ? 'Class' : 'Classes')
        ),
        h('div', { class: 'vmt_summary_stat' },
            h('span', { class: 'vmt_summary_value' },
                String(mainClass.features.length + secondaryClasses.reduce((sum, c) => sum + c.features.length, 0))
            ),
            h('span', { class: 'vmt_summary_label' }, 'Total Features')
        )
    );
}

/**
 * Render the Class & Level tab content
 */
export function renderClassLevelTab(openModal, render) {
    const state = getState();
    const { mainClass, secondaryClasses } = state;

    const container = h('div', { class: 'vmt_class_tab' });

    // Level summary
    container.appendChild(createLevelSummary(mainClass, secondaryClasses));

    // Main class card
    container.appendChild(createMainClassCard(mainClass, openModal, render));

    // Secondary classes
    if (secondaryClasses.length > 0) {
        const multiclassSection = h('div', { class: 'vmt_multiclass_section' },
            h('div', { class: 'vmt_section_divider' },
                h('span', { class: 'vmt_divider_text' }, 'Multiclass')
            )
        );

        for (let i = 0; i < secondaryClasses.length; i++) {
            multiclassSection.appendChild(
                createSecondaryClassCard(secondaryClasses[i], i, openModal, render)
            );
        }

        container.appendChild(multiclassSection);
    }

    // Add multiclass button
    container.appendChild(createAddMulticlassSection(openModal, render));

    return container;
}
