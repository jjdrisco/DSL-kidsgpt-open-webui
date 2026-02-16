/**
 * Interface Mode Utilities
 * 
 * Helper functions for checking and managing interface modes
 */

import { childProfileSync } from '$lib/services/childProfileSync';
import { INTERFACE_MODES, getPiagetStageForAge, getAutoSelectedModesForAge } from '$lib/data/interfaceModes';
import type { ChildProfile } from '$lib/apis/child-profiles';

/**
 * Get the current child's profile
 */
export function getCurrentChildProfile(): ChildProfile | null {
	return childProfileSync.getCurrentChild();
}

/**
 * Check if a specific interface mode is enabled for the current child
 */
export function isInterfaceModeEnabled(modeId: string): boolean {
	const child = getCurrentChildProfile();
	if (!child) return false;
	
	// If no modes selected, fallback to all modes (for backward compatibility)
	if (!child.selected_interface_modes || child.selected_interface_modes.length === 0) {
		return true;
	}
	
	return child.selected_interface_modes.includes(modeId);
}

/**
 * Get all enabled interface modes for the current child
 */
export function getEnabledInterfaceModes(): string[] {
	const child = getCurrentChildProfile();
	return child?.selected_interface_modes || [];
}

/**
 * Get enabled interface mode objects
 */
export function getEnabledInterfaceModeObjects() {
	const enabledIds = getEnabledInterfaceModes();
	
	// If no modes selected, return all modes (backward compatibility)
	if (enabledIds.length === 0) {
		return INTERFACE_MODES;
	}
	
	return INTERFACE_MODES.filter((mode) => enabledIds.includes(mode.id));
}

/**
 * Check if the current user is a child
 */
export function isChildUser(): boolean {
	const child = getCurrentChildProfile();
	return child !== null;
}

/**
 * Get Piaget stage for a specific age
 */
export function getPiagetStageForChildAge(ageString: string) {
	const ageMatch = ageString.match(/(\d+)/);
	if (!ageMatch) return null;
	
	const age = parseInt(ageMatch[1]);
	return getPiagetStageForAge(age);
}

/**
 * Get auto-selected modes for child's age
 */
export function getAutoSelectedModesForChildAge(ageString: string): string[] {
	const ageMatch = ageString.match(/(\d+)/);
	if (!ageMatch) return [];
	
	const age = parseInt(ageMatch[1]);
	return getAutoSelectedModesForAge(age);
}

/**
 * Get interface mode by ID
 */
export function getModeById(modeId: string) {
	return INTERFACE_MODES.find((mode) => mode.id === modeId);
}
