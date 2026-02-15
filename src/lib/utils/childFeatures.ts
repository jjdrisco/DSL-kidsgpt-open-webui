/**
 * Child Feature Utilities
 * 
 * Helper functions for checking and managing child features
 */

import { childProfileSync } from '$lib/services/childProfileSync';
import { CHILD_FEATURES } from '$lib/data/childFeatures';
import type { ChildProfile } from '$lib/apis/child-profiles';

/**
 * Get the current child's profile
 */
export function getCurrentChildProfile(): ChildProfile | null {
	return childProfileSync.getCurrentChild();
}

/**
 * Check if a specific feature is enabled for the current child
 */
export function isFeatureEnabled(featureId: string): boolean {
	const child = getCurrentChildProfile();
	if (!child) return false;
	
	return child.selected_features?.includes(featureId) ?? false;
}

/**
 * Check if a specific capability within a feature is enabled
 */
export function isCapabilityEnabled(featureId: string, capabilityId: string): boolean {
	if (!isFeatureEnabled(featureId)) return false;
	
	const feature = CHILD_FEATURES.find((f) => f.id === featureId);
	if (!feature) return false;
	
	const capability = feature.capabilities.find((c) => c.id === capabilityId);
	return capability?.enabled ?? false;
}

/**
 * Get all enabled features for the current child
 */
export function getEnabledFeatures(): string[] {
	const child = getCurrentChildProfile();
	return child?.selected_features || [];
}

/**
 * Check if the current user is a child
 */
export function isChildUser(): boolean {
	const child = getCurrentChildProfile();
	return child !== null;
}

/**
 * Get feature details by ID
 */
export function getFeatureById(featureId: string) {
	return CHILD_FEATURES.find((f) => f.id === featureId);
}
