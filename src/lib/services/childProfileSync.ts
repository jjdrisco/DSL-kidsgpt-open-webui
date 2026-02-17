/**
 * Child Profile Sync Service
 *
 * Manages child profile data with localStorage caching and backend synchronization.
 * Provides offline support and cross-device sync via user settings.
 *
 * ARCHITECTURE NOTE - Store Separation Rule:
 * ===========================================
 * This service manages the currently selected child ID using the following stores:
 *
 * - `settings` store: The SINGLE SOURCE OF TRUTH for selectedChildId
 *   - Populated from /users/user/settings endpoint
 *   - Contains UI preferences (theme, selectedChildId, etc.)
 *   - Persists across page refresh
 *
 * - `user` store: Auth/identity data ONLY (id, token, role, permissions)
 *   - Populated from /auths/ endpoint
 *   - Does NOT include UI settings data
 *   - DO NOT read/write selectedChildId from user.settings
 *
 * - localStorage: Used ONLY for child profile cache, NOT for selectedChildId
 *   - DO NOT use localStorage.selectedChildId or localStorage.selectedChildForQuestions
 *
 * IMPORTANT: Always use getCurrentChildId() and setCurrentChildId() methods in this
 * service - they handle the correct store routing. Never directly access user.settings
 * or localStorage for child selection state.
 */

import {
	getChildProfiles,
	createChildProfile,
	updateChildProfile,
	deleteChildProfile,
	type ChildProfile,
	type ChildProfileForm
} from '$lib/apis/child-profiles';
import { updateUserSettings } from '$lib/apis/users';
import { user, settings } from '$lib/stores';
import { get } from 'svelte/store';

class ChildProfileSyncService {
	private readonly CACHE_KEY = 'child-profiles-cache';
	private readonly SYNC_KEY = 'child-profiles-synced';

	private isOnline = navigator.onLine;
	private isUserAuthenticated = () => !!get(user);

	constructor() {
		// Clean up any corrupted cache data on initialization
		this.validateAndCleanCache();

		// Listen for online/offline events
		window.addEventListener('online', () => {
			this.isOnline = true;
			this.syncFromBackend();
		});

		window.addEventListener('offline', () => {
			this.isOnline = false;
		});
	}

	/**
	 * Validate and clean up corrupted cache data
	 */
	private validateAndCleanCache(): void {
		try {
			const cached = localStorage.getItem(this.CACHE_KEY);
			if (cached) {
				const parsed = JSON.parse(cached);
				// If cache is not a valid array, clear it
				if (!Array.isArray(parsed)) {
					console.warn('Clearing corrupted cache data');
					this.clearCache();
				}
			}
		} catch (error) {
			console.warn('Error validating cache, clearing it:', error);
			this.clearCache();
		}
	}

	/**
	 * Sync child profiles from backend to localStorage cache
	 */
	async syncFromBackend(): Promise<ChildProfile[]> {
		if (!this.isOnline || !this.isUserAuthenticated()) {
			return this.getFromCache();
		}

		try {
			let token = get(user)?.token as string | undefined;
			if (!token && typeof localStorage !== 'undefined') {
				const lt = localStorage.getItem('token');
				if (lt && lt.length > 0) token = lt;
			}
			if (!token) return this.getFromCache();

			const profiles = await getChildProfiles(token);
			// Handle null response from API
			const safeProfiles = profiles || [];
			this.saveToCache(safeProfiles);
			localStorage.setItem(this.SYNC_KEY, 'true');
			return safeProfiles;
		} catch (error) {
			console.warn('Failed to sync child profiles from backend:', error);
			return this.getFromCache();
		}
	}

	/**
	 * Get all child profiles (from cache or backend)
	 */
	async getChildProfiles(): Promise<ChildProfile[]> {
		const cacheExists = localStorage.getItem(this.CACHE_KEY);
		const isSynced = localStorage.getItem(this.SYNC_KEY);

		// If no cache or not synced, try to sync from backend
		if (!cacheExists || !isSynced) {
			return await this.syncFromBackend();
		}

		// Return from cache
		return this.getFromCache();
	}

	/**
	 * Create a new child profile
	 *
	 * IMPORTANT: This function will throw an error if the backend save fails.
	 * No local fallback is provided - data must be saved to the backend to be usable.
	 */
	async createChildProfile(formData: ChildProfileForm): Promise<ChildProfile> {
		// Must be online and authenticated to create a profile
		if (!this.isOnline || !this.isUserAuthenticated()) {
			throw new Error('Cannot create child profile: user is offline or not authenticated');
		}

		let token = get(user)?.token as string | undefined;
		if (!token && typeof localStorage !== 'undefined') {
			const lt = localStorage.getItem('token');
			if (lt && lt.length > 0) token = lt;
		}

		if (!token) {
			throw new Error('Cannot create child profile: authentication token not found');
		}

		try {
			const newProfile = await createChildProfile(token, formData);

			// Update cache with the new profile from backend
			let profiles = this.getFromCache();
			// Extra safety check
			if (!Array.isArray(profiles)) {
				profiles = [];
			}
			profiles.push(newProfile);
			this.saveToCache(profiles);

			return newProfile;
		} catch (error) {
			// Log the error for debugging
			console.error('Failed to create child profile on backend:', error);

			// Re-throw the error so the UI can display it to the user
			// Extract error message if available
			if (error && typeof error === 'object' && 'detail' in error) {
				throw new Error(
					typeof error.detail === 'string'
						? error.detail
						: 'Failed to create child profile on backend'
				);
			} else if (error instanceof Error) {
				throw error;
			} else {
				throw new Error('Failed to create child profile on backend');
			}
		}
	}

	/**
	 * Update an existing child profile
	 */
	async updateChildProfile(profileId: string, formData: ChildProfileForm): Promise<ChildProfile> {
		// Try to update on backend first if online and authenticated
		if (this.isOnline && this.isUserAuthenticated()) {
			try {
				let token = get(user)?.token as string | undefined;
				if (!token && typeof localStorage !== 'undefined') {
					const lt = localStorage.getItem('token');
					if (lt && lt.length > 0) token = lt;
				}
				if (token) {
					const updatedProfile = await updateChildProfile(token, profileId, formData);
					// Update cache
					let profiles = this.getFromCache();
					// Extra safety check
					if (!Array.isArray(profiles)) {
						profiles = [];
					}
					const index = profiles.findIndex((p) => p.id === profileId);
					if (index !== -1) {
						profiles[index] = updatedProfile;
						this.saveToCache(profiles);
					}
					return updatedProfile;
				}
			} catch (error) {
				console.warn('Failed to update child profile on backend:', error);
			}
		}

		// Fallback: update locally
		let profiles = this.getFromCache();
		// Extra safety check
		if (!Array.isArray(profiles)) {
			profiles = [];
		}
		const index = profiles.findIndex((p) => p.id === profileId);
		if (index !== -1) {
			profiles[index] = {
				...profiles[index],
				...formData,
				updated_at: Date.now()
			};
			this.saveToCache(profiles);
			return profiles[index];
		}

		throw new Error('Child profile not found');
	}

	/**
	 * Delete a child profile
	 */
	async deleteChildProfile(profileId: string): Promise<void> {
		// Try to delete on backend first if online and authenticated
		if (this.isOnline && this.isUserAuthenticated()) {
			try {
				let token = get(user)?.token as string | undefined;
				if (!token && typeof localStorage !== 'undefined') {
					const lt = localStorage.getItem('token');
					if (lt && lt.length > 0) token = lt;
				}
				if (token) {
					await deleteChildProfile(token, profileId);
					// Update cache
					let profiles = this.getFromCache();
					// Extra safety check
					if (!Array.isArray(profiles)) {
						profiles = [];
					}
					profiles = profiles.filter((p) => p.id !== profileId);
					this.saveToCache(profiles);
					return;
				}
			} catch (error) {
				console.warn('Failed to delete child profile on backend:', error);
			}
		}

		// Fallback: delete locally
		let profiles = this.getFromCache();
		// Extra safety check
		if (!Array.isArray(profiles)) {
			profiles = [];
		}
		profiles = profiles.filter((p) => p.id !== profileId);
		this.saveToCache(profiles);
	}

	/**
	 * Get the currently selected child profile
	 */
	getCurrentChild(): ChildProfile | null {
		const currentUserId = get(user)?.id;
		if (!currentUserId) return null;

		const selectedChildId = this.getCurrentChildId();
		if (!selectedChildId) return null;

		let profiles = this.getFromCache();
		// Extra safety check
		if (!Array.isArray(profiles)) {
			profiles = [];
		}
		return profiles.find((p) => p.id === selectedChildId) || null;
	}

	/**
	 * Get the child profile for the currently logged-in user
	 * 
	 * This method handles THREE scenarios:
	 * 1. Child user (role: 'child'): Returns a virtual profile with all interface modes enabled
	 *    (Child users have full access - gating only applies to parent testing)
	 * 2. Parent user (role: 'parent'): Uses selectedChildId to fetch and apply that child's restrictions
	 * 3. Other users (admin, interviewee): Returns null (no child profile access)
	 * 
	 * NOTE: Only fetches from backend for parent testing; child users get full access
	 * 
	 * @returns The child profile for the current user, or null
	 */
	async getChildProfileForCurrentUser(): Promise<ChildProfile | null> {
		const currentUser = get(user);
		if (!currentUser?.id) return null;

		let token = currentUser.token as string | undefined;

		// Scenario 1: User has role "child" - fetch their real profile from backend
		if (currentUser.role === 'child') {
			console.log('[getChildProfileForCurrentUser] Child user detected, fetching profile', {
				email: currentUser.email,
				hasToken: !!token
			});
			if (!token && typeof localStorage !== 'undefined') {
				const lt = localStorage.getItem('token');
				if (lt && lt.length > 0) token = lt;
			}
			if (token) {
				try {
					const profiles = await getChildProfiles(token);
					console.log('[getChildProfileForCurrentUser] API response:', {
						profilesCount: profiles?.length ?? 0,
						profiles: profiles,
						firstProfileSelectedFeatures: profiles?.[0]?.selected_features
					});
					if (profiles && Array.isArray(profiles) && profiles.length > 0) {
						const profile = profiles[0];
						const result = {
							...profile,
							selected_features: profile.selected_features ?? [],
							selected_interface_modes:
								(profile.selected_interface_modes?.length ?? 0) > 0
									? profile.selected_interface_modes
									: ['voice_input', 'text_input', 'photo_upload', 'prompt_buttons']
						};
						console.log('[getChildProfileForCurrentUser] Returning real profile:', {
							id: result.id,
							selected_features: result.selected_features
						});
						return result;
					}
				} catch (error) {
					console.warn('[getChildProfileForCurrentUser] Failed to fetch child profile:', error);
				}
			}
			console.log('[getChildProfileForCurrentUser] Using fallback virtual profile (no backend profile found)');
			// Fallback: virtual profile with full access when no backend profile found
			return {
				id: 'virtual-child-profile',
				user_id: currentUser.id,
				name: currentUser.name,
				child_email: currentUser.email,
				child_age: undefined,
				child_gender: undefined,
				child_characteristics: undefined,
				selected_features: [],
				selected_interface_modes: [
					'voice_input',
					'text_input',
					'photo_upload',
					'prompt_buttons'
				],
				created_at: Date.now() / 1000,
				updated_at: Date.now() / 1000,
				attempt_number: 1,
				is_current: true,
				session_number: 1
			} as ChildProfile;
		}

		if (!token && typeof localStorage !== 'undefined') {
			const lt = localStorage.getItem('token');
			if (lt && lt.length > 0) token = lt;
		}
		if (!token) return null;

		// Scenario 2: User has role "parent" - use selectedChildId approach
		if (currentUser.role === 'parent') {
			const selectedChildId = this.getCurrentChildId();
			console.log('[getChildProfileForCurrentUser] Parent user, selectedChildId:', selectedChildId);
			if (!selectedChildId) return null;
			
			try {
				const profiles = await getChildProfiles(token);
				console.log('[getChildProfileForCurrentUser] Parent API response:', {
					profilesCount: profiles?.length ?? 0,
					profileIds: profiles?.map((p) => p.id),
					selectedFeaturesByProfile: profiles?.map((p) => ({ id: p.id, selected_features: p.selected_features }))
				});
				if (!profiles || !Array.isArray(profiles)) {
					return null;
				}
				
				const found = profiles.find((p) => p.id === selectedChildId) || null;
				if (found) {
					console.log('[getChildProfileForCurrentUser] Parent returning profile:', {
						id: found.id,
						selected_features: found.selected_features
					});
				} else {
					console.warn('[getChildProfileForCurrentUser] Parent: no profile matched selectedChildId', selectedChildId);
				}
				return found;
			} catch (error) {
				console.error('Error fetching child profiles:', error);
				return null;
			}
		}

		// Scenario 3: Other user types (admin, interviewee, etc.) - no child profile access
		return null;
	}

	/**
	 * Get the currently selected child ID from settings store
	 *
	 * IMPORTANT: Reads from `settings` store, NOT `user.settings`.
	 * The user store doesn't include settings data on page refresh (only auth data).
	 * The settings store is populated from /users/user/settings endpoint and persists correctly.
	 *
	 * @returns The selected child ID, or null if none selected
	 */
	getCurrentChildId(): string | null {
		const settingsData = get(settings);
		return settingsData?.selectedChildId ?? null;
	}

	/**
	 * Set the currently selected child ID in settings store and backend
	 *
	 * IMPORTANT: Updates `settings` store, NOT `user.settings`.
	 * Flow: Backend API (updateUserSettings) → settings store (local state)
	 * The settings store is what getCurrentChildId() reads from.
	 *
	 * @param childId The child ID to select, or null to deselect
	 */
	async setCurrentChildId(childId: string | null): Promise<void> {
		const userData = get(user);
		if (!userData?.token) return;

		try {
			// Get current settings from the settings store
			const currentSettingsData = get(settings) || {};

			// Build the backend payload (needs ui.selectedChildId structure)
			const backendPayload = {
				ui: {
					...currentSettingsData,
					selectedChildId: childId
				}
			};

			// Remove selectedChildId from payload if null
			if (!childId) {
				delete backendPayload.ui.selectedChildId;
			}

			// Save to backend
			await updateUserSettings(userData.token, backendPayload);

			// Update local settings store (this is what getCurrentChildId reads from)
			if (childId) {
				settings.update((s) => ({
					...s,
					selectedChildId: childId
				}));
			} else {
				settings.update((s) => {
					const { selectedChildId, ...rest } = s as Record<string, unknown>;
					return rest;
				});
			}
		} catch (error) {
			console.error('Failed to update selected child in settings:', error);
			throw error;
		}
	}

	/**
	 * Get child profiles from localStorage cache
	 */
	private getFromCache(): ChildProfile[] {
		try {
			const cached = localStorage.getItem(this.CACHE_KEY);
			if (!cached) return [];

			const parsed = JSON.parse(cached);
			// Ensure the parsed value is a valid array
			if (!parsed || !Array.isArray(parsed)) {
				console.warn('Cache contained invalid data, resetting to empty array');
				return [];
			}
			return parsed;
		} catch (error) {
			console.warn('Failed to parse child profiles cache:', error);
			return [];
		}
	}

	/**
	 * Save child profiles to localStorage cache
	 */
	private saveToCache(profiles: ChildProfile[]): void {
		try {
			localStorage.setItem(this.CACHE_KEY, JSON.stringify(profiles));
		} catch (error) {
			console.warn('Failed to save child profiles to cache:', error);
		}
	}

	/**
	 * Clear all cached child profile data
	 */
	clearCache(): void {
		localStorage.removeItem(this.CACHE_KEY);
		localStorage.removeItem(this.SYNC_KEY);
	}
}

// Export singleton instance
export const childProfileSync = new ChildProfileSyncService();
