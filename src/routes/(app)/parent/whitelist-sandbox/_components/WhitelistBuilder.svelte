<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		SUGGESTIONS,
		childName,
		features,
		activeChip,
		newFeatureText,
		isCustomized,
		saveStatus,
		applyChip,
		resetToPreset,
		removeFeature,
		updateFeature,
		setNewFeatureText,
		addFeature
	} from '../_state/sandbox';

	export let showMobileCta: boolean = false;
	export let previewPath: string = '/parent/whitelist-sandbox/preview';
	export let splitPanel: boolean = false;

	let addInput: HTMLInputElement;

	function handleAddKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addFeature(() => addInput?.focus());
		}
	}
</script>

<section
	class="flex w-full min-h-0 flex-col bg-white dark:bg-gray-800 {splitPanel
		? 'h-full border-r border-gray-200 dark:border-gray-700'
		: 'h-full'}"
>
	<div
		class="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-3"
	>
		<div class="min-w-0">
			<h1 class="text-xl font-bold text-gray-900 dark:text-white break-words">{$childName}'s Whitelist</h1>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				Define what topics and content your child's AI can discuss. Use a suggestion chip or add
				features as you see fit.
			</p>
		</div>
		<div class="shrink-0 mt-1.5 text-xs font-medium min-w-[56px] text-right">
			{#if $saveStatus === 'saving'}
				<span class="text-gray-400 dark:text-gray-500">Saving…</span>
			{:else if $saveStatus === 'saved'}
				<span class="text-green-500 dark:text-green-400">Saved ✓</span>
			{:else}
				<span class="text-gray-300 dark:text-gray-600">Auto-save on</span>
			{/if}
		</div>
	</div>

	<div class="min-h-0 flex-1 overflow-y-auto">
		<div
			class="px-4 sm:px-6 {showMobileCta
				? 'pt-8 pb-10'
				: 'pt-5 pb-4'}"
		>
			<p class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-4">
				Quick suggestions
			</p>
			<div class="flex flex-wrap gap-x-3 gap-y-3 sm:gap-x-3.5 sm:gap-y-3.5">
				{#each SUGGESTIONS as suggestion}
					{@const isActive = $activeChip === suggestion.label}
					{@const locked = $isCustomized && !isActive}
					<button
						type="button"
						disabled={$isCustomized}
						class="px-4 py-2.5 rounded-full text-sm font-medium border transition leading-snug
							{isActive && !$isCustomized
							? 'bg-blue-600 text-white border-blue-600'
							: isActive && $isCustomized
								? 'bg-transparent text-blue-500 border-blue-400 opacity-60 cursor-not-allowed'
								: locked
									? 'bg-white dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 opacity-40 cursor-not-allowed'
									: 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'}"
						on:click={() => !$isCustomized && applyChip(suggestion)}
					>
						{suggestion.label}
					</button>
				{/each}
			</div>

			{#if $isCustomized}
				<button
					type="button"
					on:click={resetToPreset}
					class="mt-3 text-xs text-blue-500 dark:text-blue-400 hover:underline"
				>
					↩ Reset to quick options
				</button>
			{/if}

			<div class="flex flex-col {showMobileCta ? 'pt-11' : 'pt-7'}">
				<p class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">
					Approved Features
				</p>

				<ul class="space-y-2 {showMobileCta ? 'mb-8' : 'mb-4'}">
					{#each $features as feature, i}
						<li class="flex items-center gap-2 group">
							<span class="text-blue-500 dark:text-blue-400 text-sm mt-0.5 shrink-0">•</span>
							<input
								type="text"
								value={feature}
								on:input={(e) => updateFeature(i, (e.target as HTMLInputElement).value)}
								class="flex-1 min-w-0 text-sm bg-transparent border-b border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none text-gray-800 dark:text-gray-100 py-1 transition"
							/>
							<button
								type="button"
								on:click={() => removeFeature(i)}
								class="text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition text-base leading-none shrink-0"
								aria-label="Remove"
							>
								×
							</button>
						</li>
					{/each}
				</ul>

				<div class="flex items-center gap-2 {showMobileCta ? 'mb-4' : 'mb-2'}">
					<span class="text-gray-300 dark:text-gray-600 text-sm shrink-0">+</span>
					<input
						bind:this={addInput}
						bind:value={$newFeatureText}
						on:input={(e) => setNewFeatureText((e.target as HTMLInputElement).value)}
						on:keydown={handleAddKeydown}
						type="text"
						placeholder="Add a feature or topic…"
						class="flex-1 min-w-0 text-sm bg-transparent border-b border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none text-gray-800 dark:text-gray-100 py-1 placeholder-gray-400 dark:placeholder-gray-600 transition"
					/>
					<button
						type="button"
						on:click={() => addFeature(() => addInput?.focus())}
						disabled={!$newFeatureText.trim()}
						class="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-700 transition shrink-0 min-h-9"
					>
						Add
					</button>
				</div>
			</div>
		</div>
	</div>

	{#if showMobileCta}
		<div class="px-4 sm:px-6 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700 md:hidden">
			<button
				type="button"
				class="w-full min-h-11 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
				on:click={() => goto(previewPath)}
			>
				Continue to Chat Preview
			</button>
		</div>
	{/if}
</section>
