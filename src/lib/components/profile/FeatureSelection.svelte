<script lang="ts">
	import {
		getAvailableFeatures,
		validateFeaturesForAge,
		type ChildFeature
	} from '$lib/data/childFeatures';
	import { getAgeGroupFromValue } from '$lib/utils/ageGroups';

	export let childAge: string | number = '';
	export let selectedFeatures: string[] = [];
	export let onFeaturesChange: ((features: string[]) => void) | undefined = undefined;

	let availableFeatures: ChildFeature[] = [];
	let autoSelectedFeatureIds: string[] = [];
	let ageGroupLabel: string = '';
	let lastAppliedAge: number | null = null;

	$: if (childAge) {
		// Parse age (could be string from select or number from profile)
		const age = typeof childAge === 'number' ? childAge : parseInt(childAge, 10);
		
		if (!isNaN(age)) {
			availableFeatures = getAvailableFeatures(age);
			
			const ageGroup = getAgeGroupFromValue(age);
			ageGroupLabel = ageGroup?.label || '';

			// Auto-selected features: School Assignment when available
			autoSelectedFeatureIds = availableFeatures.some((f) => f.id === 'school_assignment')
				? ['school_assignment']
				: [];

			// Only overwrite selection when AGE changes - not on every reactive run.
			// This prevents re-renders from blocking button clicks.
			if (lastAppliedAge !== age) {
				lastAppliedAge = age;
				if (autoSelectedFeatureIds.length > 0) {
					selectedFeatures = [...autoSelectedFeatureIds];
					onFeaturesChange?.(selectedFeatures);
				} else {
					selectedFeatures = [];
					onFeaturesChange?.(selectedFeatures);
				}
			}
		} else {
			lastAppliedAge = null;
		}
	} else {
		lastAppliedAge = null;
	}

	function toggleFeature(featureId: string) {
		let next: string[];
		if (selectedFeatures.includes(featureId)) {
			next = selectedFeatures.filter((id) => id !== featureId);
		} else {
			const age = typeof childAge === 'number' ? childAge : parseInt(childAge, 10);
			if (!isNaN(age)) {
				const validation = validateFeaturesForAge([...selectedFeatures, featureId], age);
				if (validation.valid) {
					next = [...selectedFeatures, featureId];
				} else {
					return;
				}
			} else {
				return;
			}
		}
		selectedFeatures = next;
		onFeaturesChange?.(next);
	}

	function isAutoSelected(featureId: string): boolean {
		return autoSelectedFeatureIds.includes(featureId);
	}

	function isSelected(featureId: string): boolean {
		return selectedFeatures.includes(featureId);
	}
</script>

<div class="space-y-6">
	{#if childAge && availableFeatures.length > 0}
		<div class="mb-4">
			<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
				Select Features for {ageGroupLabel}
			</h3>
			<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
				Choose which features your child can use. Pre-selected features for this age are marked with a star.
			</p>
		</div>

		<div class="space-y-4">
			{#each availableFeatures as feature}
				{@const isAuto = isAutoSelected(feature.id)}
				{@const isSel = selectedFeatures.includes(feature.id)}
				
				<button
					type="button"
					class={`w-full text-left border rounded-lg p-4 transition-all cursor-pointer ${
						isSel
							? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-200 dark:ring-blue-800'
							: 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
					}`}
					on:click={() => toggleFeature(feature.id)}
				>
					<div class="flex items-start justify-between">
						<div class="flex-1">
							<div class="flex items-center gap-2 mb-2">
								{#if feature.icon}
									<span class="text-2xl">{feature.icon}</span>
								{/if}
								<h4 class="text-base font-semibold text-gray-900 dark:text-white">
									{feature.name}
								</h4>
								{#if isAuto}
									<span
										class="text-yellow-500 text-sm"
										title="Pre-selected for this age"
									>
										★
									</span>
								{/if}
							</div>
							<p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
								{feature.description}
							</p>
							
							{#if feature.capabilities && feature.capabilities.length > 0}
								<div class="mt-3 space-y-2">
									<p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
										Capabilities:
									</p>
									<div class="flex flex-wrap gap-2">
										{#each feature.capabilities as capability}
											<span
												class="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
											>
												{capability.name}
											</span>
										{/each}
									</div>
								</div>
							{/if}
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
				</button>
			{/each}
		</div>

		{#if selectedFeatures.length === 0}
			<div
				class="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
			>
				<p class="text-sm text-yellow-800 dark:text-yellow-200">
					<strong>Note:</strong> Please select at least one feature for your child.
				</p>
			</div>
		{/if}
	{:else if childAge}
		<div
			class="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
		>
			<p class="text-sm text-gray-600 dark:text-gray-400">
				No features available for this age group yet. More features will be added soon!
			</p>
		</div>
	{:else}
		<div
			class="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
		>
			<p class="text-sm text-gray-600 dark:text-gray-400">
				Please select your child's age first to see available features.
			</p>
		</div>
	{/if}
</div>
