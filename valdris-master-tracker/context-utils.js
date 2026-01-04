import { getState } from './state-manager.js';

function formatActiveEffects(items = []) {
    if (!items.length) return 'None';
    return items.map(item => `- ${item.name}${item.duration ? ` (${item.duration} remaining)` : ''}`).join('\n');
}

function formatConditions(items = []) {
    if (!items.length) return 'None';
    return items.map(item => item.name).join(', ');
}

function formatEquipmentSummary(equipment = {}) {
    const mainHand = equipment?.mainHand?.name || 'None';
    const offHand = equipment?.offHand?.name || 'None';
    const armor = equipment?.chest?.name || 'None';
    return `${mainHand}, ${offHand}, ${armor}`;
}

export function buildContextBlock(stateOverride, settingsOverride) {
    const state = stateOverride || getState();
    const settings = settingsOverride || state.settings?.contextInjection || {};

    const header = settings.customHeader?.trim()
        ? settings.customHeader.trim()
        : `[CHARACTER STATE - ${state.characterName || 'Unknown'}]`;
    const footer = settings.customFooter?.trim() ? settings.customFooter.trim() : '[/CHARACTER STATE]';

    const lines = [header];
    if (settings.includeResources) {
        lines.push(`HP: ${state.hp?.current ?? 0}/${state.hp?.max ?? 0} | MP: ${state.mp?.current ?? 0}/${state.mp?.max ?? 0} | SP: ${state.stamina?.current ?? 0}/${state.stamina?.max ?? 0}`);
    }
    lines.push(`Level: ${state.level ?? 1} | Class: ${state.mainClass?.name || 'Unknown'} Lv.${state.mainClass?.level ?? 1}`);
    lines.push(`Location: ${state.currentLocation || 'Unknown'}`);

    if (settings.includeBuffsDebuffs) {
        lines.push('', 'Active Effects:');
        lines.push(formatActiveEffects((state.buffs || []).filter(buff => buff.name)));
        lines.push(formatActiveEffects((state.debuffs || []).filter(debuff => debuff.name)));
    }

    if (settings.includeStats) {
        const attrs = state.attributes || {};
        lines.push('', `Key Stats: STR ${attrs.STR?.base ?? 0} | DEX ${attrs.DEX?.base ?? 0} | CON ${attrs.CON?.base ?? 0} | INT ${attrs.INT?.base ?? 0} | WIS ${attrs.WIS?.base ?? 0} | CHA ${attrs.CHA?.base ?? 0}`);
    }

    if (settings.includeEquipment) {
        lines.push('', `Equipment: ${formatEquipmentSummary(state.equipment)}`);
    }

    if (settings.includeSurvival) {
        const hungerEnabled = state.survivalMeters?.hunger?.enabled;
        const thirstEnabled = state.survivalMeters?.thirst?.enabled;
        const hungerVal = state.survivalMeters?.hunger?.current ?? 0;
        const thirstVal = state.survivalMeters?.thirst?.current ?? 0;
        const survivalLine = `Survival: ${hungerEnabled ? `Hunger: ${hungerVal}%` : ''} ${thirstEnabled ? `Thirst: ${thirstVal}%` : ''}`.trim();
        lines.push('', survivalLine || 'Survival: N/A');
    }

    if (settings.includeResources) {
        const conditions = formatConditions(state.conditions || []);
        lines.push('', `Active Conditions: ${conditions}`);
    }

    lines.push(footer);
    return lines.join('\n');
}
