<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { user, settings } from '$lib/stores';
	import { currentUserChildProfile, loadChildProfileForCurrentUser } from '$lib/utils/interfaceModes';
	import { childProfileSync } from '$lib/services/childProfileSync';
	import type { ChildProfile } from '$lib/apis/child-profiles';

	let childProfiles: ChildProfile[] = [];
	let switching = false;

	onMount(async () => {
		if ($user?.role === 'parent') {
			try {
				childProfiles = await childProfileSync.getChildProfiles();
			} catch (e) {
				console.warn('[ParentPreviewBanner] failed to load child profiles', e);
			}
		}
	});

	async function switchChild(profileId: string) {
		if (switching || profileId === $currentUserChildProfile?.id) return;
		switching = true;
		try {
			// setCurrentChildId handles: selectedChildId update + system prompt sync to backend + settings store
			await childProfileSync.setCurrentChildId(profileId);
			// Reload the child profile into the store so UI updates reactively
			await loadChildProfileForCurrentUser();
		} catch (e) {
			console.error('[ParentPreviewBanner] failed to switch child', e);
		} finally {
			switching = false;
		}
	}

	function exitPreview() {
		goto('/parent');
	}
</script>

{#if $user?.role === 'parent' && $currentUserChildProfile}
	<div
		class="w-full flex items-center justify-between gap-3 px-4 py-2 text-sm
		       bg-blue-50 dark:bg-blue-950/40
		       border-b border-blue-200 dark:border-blue-800
		       text-blue-800 dark:text-blue-200
		       shrink-0 z-10"
	>
		<!-- Left: label + child info -->
		<div class="flex items-center gap-2 min-w-0">
			<span class="font-semibold whitespace-nowrap">Preview Mode</span>
			<span class="text-blue-500 dark:text-blue-400">·</span>
			<span class="truncate">
				Viewing as <strong>{$currentUserChildProfile.name}</strong>
				{#if $currentUserChildProfile.child_age}
					(age {$currentUserChildProfile.child_age})
				{/if}
			</span>
		</div>

		<!-- Right: child switcher + exit button -->
		<div class="flex items-center gap-2 shrink-0">
			{#if childProfiles.length > 1}
				<select
					class="text-xs rounded-lg border border-blue-300 dark:border-blue-700
					       bg-white dark:bg-gray-800 text-blue-800 dark:text-blue-200
					       px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400
					       disabled:opacity-50"
					value={$currentUserChildProfile.id}
					disabled={switching}
					on:change={(e) => switchChild(e.currentTarget.value)}
				>
					{#each childProfiles as profile}
						<option value={profile.id}>{profile.name}</option>
					{/each}
				</select>
			{/if}

			<button
				type="button"
				class="text-xs font-medium rounded-lg px-3 py-1 transition
				       bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800
				       text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700"
				on:click={exitPreview}
			>
				Exit Preview
			</button>
		</div>
	</div>
{/if}
