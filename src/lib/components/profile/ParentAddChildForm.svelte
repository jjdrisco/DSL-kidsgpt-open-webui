<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { user } from '$lib/stores';
	import { get } from 'svelte/store';
	import { childProfileSync } from '$lib/services/childProfileSync';
	import type { ChildProfile } from '$lib/apis/child-profiles';
	import { getChildProfiles } from '$lib/apis/child-profiles';
	import { toast } from 'svelte-sonner';
	import FeatureSelection from '$lib/components/profile/FeatureSelection.svelte';
	import InterfaceModeSelection from '$lib/components/profile/InterfaceModeSelection.svelte';
	import ChildPasswordModal from '$lib/components/profile/ChildPasswordModal.svelte';
	import { getModeById } from '$lib/data/interfaceModes';
	import { CHILD_FEATURES } from '$lib/data/childFeatures';
	import { AGE_GROUPS, getAgeLabel, getAgeValueFromLabel } from '$lib/utils/ageGroups';

	const i18n = getContext('i18n');
	
	// Password modal state
	let showPasswordModal = false;
	let generatedPassword = '';
	let createdChildName = '';
	let createdChildEmail = '';

	function getModeDisplayName(modeId: string): string {
		return getModeById(modeId)?.name ?? modeId;
	}

	function getFeatureDisplayName(featureId: string): string {
		return CHILD_FEATURES.find((f) => f.id === featureId)?.name ?? featureId;
	}

	// Callbacks
	export let onProfileSaved: ((profile: ChildProfile) => void | Promise<void>) | undefined =
		undefined;
	export let onProfileCreated: ((profile: ChildProfile) => void | Promise<void>) | undefined =
		undefined;
	export let onProfileUpdated: ((profile: ChildProfile) => void | Promise<void>) | undefined =
		undefined;
	export let onProfileDeleted: ((profileId: string) => void | Promise<void>) | undefined =
		undefined;
	export let onChildSelected:
		| ((profile: ChildProfile, index: number) => void | Promise<void>)
		| undefined = undefined;

	// Child profile data
	let childName: string = '';
	let childAge: string = '';  // String from select, converted to number when saving
	let childEmail: string = '';

	// Feature selection
	let selectedFeatures: string[] = [];
	
	// Interface mode selection
	let selectedInterfaceModes: string[] = [];

	// Multi-child support
	let childProfiles: ChildProfile[] = [];
	let selectedChildIndex: number = -1;
	let showForm: boolean = false;
	let isEditing: boolean = false;
	let isProfileCompleted: boolean = false;

	// Main page container for scrolling
	let mainPageContainer: HTMLElement;

	function getChildGridTemplate(): string {
		const cols = Math.max(1, Math.min((childProfiles?.length || 0) + 1, 5));
		return `repeat(${cols}, minmax(120px, 1fr))`;
	}

	function hydrateFormFromSelectedChild() {
		const sel = childProfiles[selectedChildIndex];
		console.log('[ParentAddChildForm] hydrateFormFromSelectedChild', {
			selectedChildIndex,
			hasSel: !!sel,
			child_age_raw: sel?.child_age,
			child_age_type: sel?.child_age != null ? typeof sel.child_age : 'n/a',
			sel_keys: sel ? Object.keys(sel) : []
		});

		childName = sel?.name || '';
		// Convert numeric age to string for select element
		childAge = sel?.child_age ? String(sel.child_age) : '';
		console.log('[ParentAddChildForm] childAge after hydrate:', JSON.stringify(childAge));
		childEmail = (sel as any)?.child_email ?? '';

		// Load selected features and interface modes
		selectedFeatures = (sel as any)?.selected_features || [];
		selectedInterfaceModes = (sel as any)?.selected_interface_modes || [];
	}

	async function loadChildProfiles() {
		try {
			const profiles = await childProfileSync.getChildProfiles();
			childProfiles = profiles;
			console.log('[ParentAddChildForm] loadChildProfiles', {
				count: profiles?.length,
				profiles: profiles?.map((p) => ({ id: p.id, name: p.name, child_age: p.child_age }))
			});

			// If no profiles, show add form directly
			if (childProfiles.length === 0) {
				selectedChildIndex = -1;
				showForm = true;
				isEditing = true;
			} else {
				// Default selection: use current child from sync, or first child
				const currentChildId = childProfileSync.getCurrentChildId();
				if (currentChildId) {
					const index = childProfiles.findIndex((c) => c.id === currentChildId);
					selectedChildIndex = index !== -1 ? index : 0;
				} else {
					selectedChildIndex = 0;
				}
				// Persist default selection if we had to fall back to first child
				if (!currentChildId) {
					await childProfileSync.setCurrentChildId(childProfiles[selectedChildIndex].id);
				}
				hydrateFormFromSelectedChild();
				showForm = false; // Show grid + profile display
			}
		} catch (error) {
			console.error('Error loading child profiles:', error);
			toast.error($i18n.t('Failed to load profiles'));
		}
	}

	async function selectChild(index: number) {
		selectedChildIndex = index;
		hydrateFormFromSelectedChild();
		isEditing = false;
		showForm = false; // Keep grid + profile visible, don't open form

		await childProfileSync.setCurrentChildId(childProfiles[index].id);
		if (onChildSelected) {
			await onChildSelected(childProfiles[index], index);
		}
	}

	function startAddChild() {
		selectedChildIndex = -1;
		childName = '';
		childAge = '';
		childEmail = '';
		selectedFeatures = [];
		selectedInterfaceModes = [];
		isEditing = true;
		showForm = true;
	}

	function editSelectedProfile() {
		console.log('[ParentAddChildForm] editSelectedProfile', {
			selectedChildIndex,
			profile_child_age: childProfiles[selectedChildIndex]?.child_age
		});
		hydrateFormFromSelectedChild(); // Populate form with selected child's data
		console.log('[ParentAddChildForm] after hydrate in editSelectedProfile, childAge=', childAge);
		isEditing = true;
		showForm = true; // Switch to edit form view
	}

	async function cancelAddProfile() {
		if (childProfiles.length > 0) {
			showForm = false;
			isEditing = false;
			// Restore selection when cancelling from add (selectedChildIndex was -1)
			if (selectedChildIndex < 0) {
				selectedChildIndex = 0;
				hydrateFormFromSelectedChild();
				await childProfileSync.setCurrentChildId(childProfiles[0].id);
			}
		}
	}

	async function saveChildProfile() {
		// Basic validation
		if (!childName.trim()) {
			toast.error($i18n.t('Please enter a name for your child'));
			return;
		}

		if (!childAge) {
			toast.error($i18n.t('Please select an age range'));
			return;
		}

		if (!childEmail.trim()) {
			toast.error($i18n.t('Please enter an email for the child\'s account'));
			return;
		}

	// Convert string age to number for backend
	const numericAge = childAge ? parseInt(childAge, 10) : undefined;
	
	// Only include fields that have values to avoid sending undefined
	const formData: any = {
		name: childName.trim(),
		child_age: numericAge
	};
	
	// Add optional fields only if they have values
	if (childEmail.trim()) {
		formData.child_email = childEmail.trim();
	}
	if (selectedFeatures.length > 0) {
		formData.selected_features = selectedFeatures;
	}
	if (selectedInterfaceModes.length > 0) {
		formData.selected_interface_modes = selectedInterfaceModes;
	}

	// Debug logging
	console.log('[ParentAddChildForm] Saving with formData:', formData);
	console.log('[ParentAddChildForm] childAge string:', childAge, '→ numeric:', numericAge);
	console.log('[ParentAddChildForm] selectedFeatures:', selectedFeatures);
	console.log('[ParentAddChildForm] selectedInterfaceModes:', selectedInterfaceModes);

	try {
			if (selectedChildIndex === -1 || childProfiles.length === 0) {
				// Create new profile
				const newProfile = await childProfileSync.createChildProfile(formData);
				
				console.log('[ParentAddChildForm] Profile created:', newProfile);
				console.log('[ParentAddChildForm] generated_password:', newProfile.generated_password);
				
				// Check if a password was generated
				if (newProfile.generated_password) {
					// Show password modal
					generatedPassword = newProfile.generated_password;
					createdChildName = newProfile.name;
					createdChildEmail = newProfile.child_email || '';
					showPasswordModal = true;
					console.log('[ParentAddChildForm] Showing password modal');
				} else {
					console.log('[ParentAddChildForm] No password generated');
					toast.success($i18n.t('Child profile created successfully!'));
				}

				// Set as current before reload so loadChildProfiles picks it up
				await childProfileSync.setCurrentChildId(newProfile.id);

				// Reload profiles (will set selectedChildIndex from getCurrentChildId)
				await loadChildProfiles();

				showForm = false;
				isEditing = false;

				if (onProfileCreated) {
					await onProfileCreated(newProfile);
				}
				if (onProfileSaved) {
					await onProfileSaved(newProfile);
				}
			} else {
				// Update existing profile
				const profile = childProfiles[selectedChildIndex];
				const updatedProfile = await childProfileSync.updateChildProfile(profile.id, formData);
				toast.success($i18n.t('Child profile updated successfully!'));

				// Reload profiles (preserves selectedChildIndex via getCurrentChildId)
				await loadChildProfiles();

				showForm = false;
				isEditing = false;

				if (onProfileUpdated) {
					await onProfileUpdated(updatedProfile);
				}
				if (onProfileSaved) {
					await onProfileSaved(updatedProfile);
				}
			}
		} catch (error) {
			console.error('Error saving child profile:', error);
			toast.error($i18n.t('Failed to save profile. Please try again.'));
		}
	}

	async function deleteProfile(profileId: string, event: Event) {
		event.stopPropagation();

		if (!confirm('Are you sure you want to delete this child profile?')) {
			return;
		}

		try {
			await childProfileSync.deleteChildProfile(profileId);
			toast.success($i18n.t('Profile deleted successfully'));

			// Reload profiles - this will handle showForm state correctly
			await loadChildProfiles();

			if (onProfileDeleted) {
				await onProfileDeleted(profileId);
			}

			// Note: loadChildProfiles() already handles setting showForm correctly
			// - If childProfiles.length === 0, it sets showForm = true (show add form)
			// - If childProfiles.length > 0, it sets showForm = false (show grid)
		} catch (error) {
			console.error('Error deleting profile:', error);
			toast.error($i18n.t('Failed to delete profile'));
		}
	}

	let isLoading = true;

	onMount(async () => {
		await loadChildProfiles();
		isLoading = false;
	});
</script>

<div
	bind:this={mainPageContainer}
	class="w-full flex-1 min-h-0 overflow-y-auto"
	style="pointer-events: auto;"
>
	<div class="max-w-4xl mx-auto px-4 py-8">
		{#if isLoading}
			<!-- Loading state -->
			<div class="flex items-center justify-center py-12">
				<div class="text-center">
					<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mb-4"></div>
					<p class="text-gray-600 dark:text-gray-400">Loading profiles...</p>
				</div>
			</div>
		{:else}
			<!-- Child Selection Grid (shown when profiles exist) -->
			{#if childProfiles.length > 0}
			<div class="mb-8">
				<h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Select Your Child</h2>

				<div
					class="grid gap-4 mb-6"
					style="grid-template-columns: {getChildGridTemplate()}; max-width: 100%;"
				>
				{#each childProfiles as profile, i}
					<div class="relative group">
						<button
							type="button"
							on:click={() => selectChild(i)}
							class={`flex flex-col items-center justify-center w-full min-h-[80px] px-6 py-4 rounded-full border-2 transition-all duration-200 ${
								i === selectedChildIndex
									? 'border-blue-500 bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg ring-2 ring-blue-400/50 dark:ring-blue-500/50 scale-105'
									: 'border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
							}`}
							title="Select {profile.name}"
						>
							<div class="text-center">
								<div class="text-base font-semibold mb-1">{profile.name}</div>
							{#if profile.child_age}
								<div class="text-xs text-gray-500 dark:text-gray-400">
									Age {profile.child_age}
								</div>
							{/if}
							</div>
						</button>

						<!-- Delete button (shows on hover) -->
						<button
							type="button"
							on:click={(e) => deleteProfile(profile.id, e)}
							class="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600 z-10"
							title="Delete profile"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</button>
					</div>
				{/each}

					<!-- Add Child Button -->
					<button
						type="button"
						class="flex flex-col items-center justify-center w-full min-h-[80px] px-6 py-4 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200"
						on:click={startAddChild}
						title="Add another child"
					>
						<svg class="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 4v16m8-8H4"
							/>
						</svg>
						<span class="text-sm font-medium">Add Child</span>
					</button>
				</div>
			</div>
		{/if}

		<!-- Profile Display (read-only, shown alongside grid when child selected) -->
		{#if childProfiles.length > 0 && selectedChildIndex >= 0 && !showForm}
			{@const profile = childProfiles[selectedChildIndex]}
			{@const profileModes = profile?.selected_interface_modes ?? []}
			{@const profileFeatures = profile?.selected_features ?? []}
			<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-8">
				<div class="space-y-6">
					<div class="flex justify-between items-center mb-6">
						<h2 class="text-2xl font-bold text-gray-900 dark:text-white">Child Profile</h2>
						<button
							type="button"
							on:click={editSelectedProfile}
							class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200"
						>
							Edit Profile
						</button>
					</div>

					<div>
						<div class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Name</div>
						<div class="text-lg text-gray-900 dark:text-white">{profile?.name ?? childName}</div>
					</div>

				{#if profile?.child_age ?? childAge}
					<div>
						<div class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Age</div>
						<div class="text-lg text-gray-900 dark:text-white">{profile?.child_age ?? childAge} years old</div>
					</div>
				{/if}

					<!-- Interface Modes (always show section) -->
					<div>
						<div class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
							Interface Modes
						</div>
						{#if profileModes.length > 0}
							<div class="flex flex-wrap gap-2">
								{#each profileModes as modeId}
									{@const mode = getModeById(modeId)}
									<span
										class="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 rounded-full text-sm"
									>
										{#if mode?.icon}
											<span>{mode.icon}</span>
										{/if}
										{getModeDisplayName(modeId)}
									</span>
								{/each}
							</div>
						{:else}
							<div class="text-gray-500 dark:text-gray-400 text-sm">Not specified</div>
						{/if}
					</div>

					<!-- Content Features (always show section) -->
					<div>
						<div class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
							Content Features
						</div>
						{#if profileFeatures.length > 0}
							<div class="flex flex-wrap gap-2">
								{#each profileFeatures as featureId}
									{@const feature = CHILD_FEATURES.find((f) => f.id === featureId)}
									<span
										class="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-sm"
									>
										{#if feature?.icon}
											<span>{feature.icon}</span>
										{/if}
										{getFeatureDisplayName(featureId)}
									</span>
								{/each}
							</div>
						{:else}
							<div class="text-gray-500 dark:text-gray-400 text-sm">Not specified</div>
						{/if}
					</div>

					{#if profile?.child_email ?? childEmail}
						<div>
							<div class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
								Email for Child's Account
							</div>
							<div class="text-lg text-gray-900 dark:text-white">{profile?.child_email ?? childEmail}</div>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Add/Edit Form (shown when adding new or editing) -->
		{#if showForm}
			<div
				class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 relative z-10 isolate"
				style="pointer-events: auto; touch-action: manipulation;"
			>
				<!-- Editable form (add or edit) -->
					<form on:submit|preventDefault={saveChildProfile} class="space-y-6">
						<h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">
							{selectedChildIndex === -1 ? 'Add Child Profile' : 'Edit Child Profile'}
						</h2>

						<!-- Child Name -->
						<div>
							<label
								for="childName"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
							>
								Child's Name <span class="text-red-500">*</span>
							</label>
							<input
								type="text"
								id="childName"
								bind:value={childName}
								placeholder="Enter child's name"
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
								required
							/>
						</div>

						<!-- Child Age -->
						<div>
							<label
								for="childAge"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
							>
								Child's Age <span class="text-red-500">*</span>
							</label>
							<select
								id="childAge"
								bind:value={childAge}
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
								required
							>
								<option value="">Select age</option>
								{#each Array.from({ length: 13 }, (_, i) => i + 6) as age}
									<option value={String(age)}>{age} years old</option>
								{/each}
							</select>
						</div>

						<!-- Interface Mode Selection (how child inputs: voice, text, photo, buttons) -->
						<div>
							<InterfaceModeSelection
								childAge={childAge}
								bind:selectedModes={selectedInterfaceModes}
								onModesChange={(modes) => {
									selectedInterfaceModes = modes;
								}}
							/>
						</div>

						<!-- Feature Selection (what content: School Assignment, etc.) -->
						<div>
							<FeatureSelection
								bind:childAge
								selectedFeatures={selectedFeatures}
								onFeaturesChange={(features) => {
									selectedFeatures = features;
								}}
							/>
						</div>

						<!-- Child Email (Optional) -->
						<div>
							<label
								for="childEmail"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
							>
								Email for Child's Account <span class="text-red-500">*</span>
							</label>
							<input
								type="email"
								id="childEmail"
								bind:value={childEmail}
								placeholder="child@example.com"
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
								required
							/>
							<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
								Used for creating the child's account
							</p>
						</div>

						<!-- Save Button -->
						<div class="flex justify-end space-x-3 pt-6">
							{#if childProfiles.length > 0}
								<button
									type="button"
									on:click={cancelAddProfile}
									class="bg-gray-500 hover:bg-gray-600 text-white px-8 py-3 rounded-lg font-medium transition-all duration-200"
								>
									Cancel
								</button>
							{/if}
							<button
								type="submit"
								class="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
							>
								Save Profile
							</button>
						</div>
					</form>
			</div>
		{/if}
		{/if}
	</div>
</div>

<!-- Password Modal -->
<ChildPasswordModal
	bind:show={showPasswordModal}
	childName={createdChildName}
	childEmail={createdChildEmail}
	password={generatedPassword}
	on:close={() => {
		showPasswordModal = false;
		toast.success($i18n.t('Child profile created successfully!'));
	}}
/>
