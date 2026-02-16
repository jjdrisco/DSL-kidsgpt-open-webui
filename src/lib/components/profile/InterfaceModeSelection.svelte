<script lang="ts">
	import {
		INTERFACE_MODES,
		getAvailableModesForAge,
		getRecommendedModesForAge,
		getAutoSelectedModesForAge,
		validateModesForAge,
		type InterfaceMode
	} from '$lib/data/interfaceModes';

	export let childAge: string = '';
	export let selectedModes: string[] = [];
	export let onModesChange: ((modes: string[]) => void) | undefined = undefined;

	let availableModes: InterfaceMode[] = [];
	let recommendedModes: InterfaceMode[] = [];
	let autoSelectedModes: string[] = [];

	$: if (childAge) {
		const ageMatch = childAge.match(/(\d+)/);
		const age = ageMatch ? parseInt(ageMatch[1]) : 0;
		
		availableModes = getAvailableModesForAge(age);
		recommendedModes = getRecommendedModesForAge(age);
		autoSelectedModes = getAutoSelectedModesForAge(age);
		
		// Auto-select recommended modes if no modes are selected yet
		if (selectedModes.length === 0 && autoSelectedModes.length > 0) {
			selectedModes = [...autoSelectedModes];
			if (onModesChange) {
				onModesChange(selectedModes);
			}
		}
	}

	function toggleMode(modeId: string) {
		if (selectedModes.includes(modeId)) {
			selectedModes = selectedModes.filter((id) => id !== modeId);
		} else {
			// Validate before adding
			const ageMatch = childAge.match(/(\d+)/);
			const age = ageMatch ? parseInt(ageMatch[1]) : 0;
			const validation = validateModesForAge([...selectedModes, modeId], age);
			
			if (validation.valid) {
				selectedModes = [...selectedModes, modeId];
			}
		}
		
		if (onModesChange) {
			onModesChange(selectedModes);
		}
	}

	function isRecommended(modeId: string): boolean {
		return recommendedModes.some((m) => m.id === modeId);
	}

	function isSelected(modeId: string): boolean {
		return selectedModes.includes(modeId);
	}

	function isAutoSelected(modeId: string): boolean {
		return autoSelectedModes.includes(modeId);
	}
</script>

<div class="space-y-6">
	{#if childAge && availableModes.length > 0}
		<div class="mb-4">
			<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
				How Your Child Will Interact
			</h3>
			<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
				Choose how your child can input questions and interact with the AI. Recommended modes are marked with a star.
			</p>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			{#each availableModes as mode}
				{@const isRec = isRecommended(mode.id)}
				{@const isSel = isSelected(mode.id)}
				{@const isAuto = isAutoSelected(mode.id)}
				
				<div
					class={`border rounded-lg p-4 transition-all cursor-pointer ${
						isSel
							? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-200 dark:ring-blue-800'
							: 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
					}`}
					on:click={() => toggleMode(mode.id)}
					role="button"
					tabindex="0"
					on:keydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							toggleMode(mode.id);
						}
					}}
				>
					<div class="flex items-start justify-between">
						<div class="flex-1">
							<div class="flex items-center gap-2 mb-2">
								<span class="text-2xl">{mode.icon}</span>
								<h4 class="text-base font-semibold text-gray-900 dark:text-white">
									{mode.name}
								</h4>
								{#if isRec}
									<span
										class="text-yellow-500 text-sm"
										title="Recommended for this age group"
									>
										★
									</span>
								{/if}
								{#if isAuto}
									<span
										class="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded"
										title="Auto-selected for this age"
									>
										Auto
									</span>
								{/if}
							</div>
							<p class="text-sm text-gray-600 dark:text-gray-400">
								{mode.description}
							</p>
						</div>
						
						<div class="ml-4 flex items-center">
							<div
								class={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
									isSel
										? 'border-blue-500 bg-blue-500'
										: 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
								}`}
							>
								{#if isSel}
									<svg
										class="w-4 h-4 text-white"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M5 13l4 4L19 7"
										></path>
									</svg>
								{/if}
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>

		{#if selectedModes.length === 0}
			<div
				class="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
			>
				<p class="text-sm text-yellow-800 dark:text-yellow-200">
					<strong>Note:</strong> Please select at least one interface mode for your child.
				</p>
			</div>
		{/if}
	{:else if childAge}
		<div
			class="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
		>
			<p class="text-sm text-gray-600 dark:text-gray-400">
				No interface modes available for this age group yet.
			</p>
		</div>
	{:else}
		<div
			class="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
		>
			<p class="text-sm text-gray-600 dark:text-gray-400">
				Please select your child's age first to see available interface modes.
			</p>
		</div>
	{/if}
</div>
