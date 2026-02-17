/**
 * Interface Mode Utilities
 * 
 * Helper functions for checking and managing interface modes
 */

import { writable } from 'svelte/store';
import { childProfileSync } from '$lib/services/childProfileSync';
import { INTERFACE_MODES, getPiagetStageForAge, getAutoSelectedModesForAge } from '$lib/data/interfaceModes';
import type { ChildProfile } from '$lib/apis/child-profiles';

// In-memory cache of current user's child profile (exported for reactive dependencies)
export const currentUserChildProfile = writable<ChildProfile | null>(null);
let profileFetchPromise: Promise<void> | null = null;

/**
 * Fetch and cache the child profile for the current user
 * Subsequent calls while a fetch is in progress will wait for the same promise
 */
export async function loadChildProfileForCurrentUser(): Promise<void> {
	// If already fetching, wait for that fetch to complete
	if (profileFetchPromise) {
		return profileFetchPromise;
	}
	
	profileFetchPromise = (async () => {
		try {
			const profile = await childProfileSync.getChildProfileForCurrentUser();
			console.log('[loadChildProfileForCurrentUser] profile loaded:', {
				hasProfile: !!profile,
				id: profile?.id,
				selected_features: profile?.selected_features,
				selected_features_length: profile?.selected_features?.length ?? 0,
				selected_interface_modes: profile?.selected_interface_modes
			});
			currentUserChildProfile.set(profile);
		} catch (error) {
			console.error('Error loading child profile:', error);
			currentUserChildProfile.set(null);
		} finally {
			profileFetchPromise = null;
		}
	})();
	
	return profileFetchPromise;
}

/**
 * Get the cached child profile (synchronous, for reactive contexts)
 */
export function getCachedChildProfile(): ChildProfile | null {
	let profile: ChildProfile | null = null;
	currentUserChildProfile.subscribe((p) => (profile = p))();
	return profile;
}

/**
 * Clear the cached profile (call on logout or user change)
 */
export function clearChildProfileCache(): void {
	currentUserChildProfile.set(null);
	profileFetchPromise = null;
}

/**
 * Get the current child's profile (legacy method, uses selectedChildId)
 */
export function getCurrentChildProfile(): ChildProfile | null {
	return childProfileSync.getCurrentChild();
}

/**
 * Check if a specific interface mode is enabled for the current child
 * 
 * Returns false for users who are not child or parent roles.
 * Uses cached profile - call loadChildProfileForCurrentUser() first.
 */
export function isInterfaceModeEnabled(modeId: string): boolean {
	const child = getCachedChildProfile();
	if (!child) return false; // No profile = no modes enabled
	
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
