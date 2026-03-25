<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { getContext } from 'svelte';
	import { getAdminConfig, updateAdminConfig } from '$lib/apis/auths';
	import { getBackendConfig } from '$lib/apis';
	import { config } from '$lib/stores';
	import {
		uploadScenariosAdmin,
		listScenariosAdmin,
		getScenarioStatsAdmin,
		updateScenarioAdmin,
		getScenarioSetNames,
		setActiveScenarioSet,
		type ScenarioModel,
		type ScenarioStatsResponse
	} from '$lib/apis/moderation';

	const i18n = getContext('i18n');

	export let saveHandler: Function;

	// Study configuration (backed by admin config)
	let studyScenariosPerSession: number = 6;
	let studyCompletionCode: string = '';
	let studyConfigLoaded = false;
	let savingStudyConfig = false;

	async function loadStudyConfig() {
		try {
			const cfg = await getAdminConfig(localStorage.token);
			if (cfg) {
				studyScenariosPerSession = cfg.SCENARIOS_PER_SESSION ?? 6;
				studyCompletionCode = cfg.PROLIFIC_COMPLETION_CODE ?? '';
			}
			studyConfigLoaded = true;
		} catch (e: any) {
			console.error('Failed to load study config', e);
		}
	}

	async function saveStudyConfig() {
		savingStudyConfig = true;
		try {
			const current = await getAdminConfig(localStorage.token);
			if (!current) throw new Error('Could not load current admin config');
			const updated = await updateAdminConfig(localStorage.token, {
				...current,
				SCENARIOS_PER_SESSION: studyScenariosPerSession,
				PROLIFIC_COMPLETION_CODE: studyCompletionCode
			});
			if (updated) {
				// Refresh the global $config store so SCENARIOS_PER_SESSION is immediately
				// picked up by any page that reads $config.study.scenarios_per_session
				const freshConfig = await getBackendConfig();
				if (freshConfig) {
					config.set(freshConfig);
				}
				toast.success('Study configuration saved!');
			} else {
				toast.error('Failed to save study configuration');
			}
		} catch (e: any) {
			toast.error(`Failed to save study configuration: ${e.message || e}`);
		} finally {
			savingStudyConfig = false;
		}
	}

	// State
	let scenarios: ScenarioModel[] = [];
	let stats: ScenarioStatsResponse | null = null;
	let loading = false;

	// Filters
	let scenarioFilters = {
		is_active: undefined as boolean | undefined,
		trait: '',
		polarity: '',
		domain: '',
		page: 1,
		page_size: 50
	};

	// Pagination
	let scenarioTotal = 0;
	let scenarioActiveCount = 0;
	let scenarioInactiveCount = 0;

	// Upload state
	let uploadingScenarios = false;
	let deactivatePreviousScenarios = false;
	let scenarioSetName = 'pilot';

	// File input references
	let scenarioFileInput: HTMLInputElement;

	// Active set management
	let scenarioSetNames: (string | null)[] = [];
	let activeScenarioSet: string | null = null;
	let settingActiveSet = false;

	onMount(async () => {
		await loadStudyConfig();
		await loadStats();
		await loadSetNames();
		await loadScenarios();
	});

	async function loadStats() {
		try {
			stats = await getScenarioStatsAdmin(localStorage.token);
		} catch (error: any) {
			const d = error?.detail;
			const msg = Array.isArray(d)
				? d.map((e: any) => e?.msg || e).join('; ')
				: d || error?.message || String(error);
			toast.error(`Failed to load stats: ${msg}`);
		}
	}

	async function loadScenarios() {
		loading = true;
		try {
			const response = await listScenariosAdmin(localStorage.token, scenarioFilters);
			scenarios = response.scenarios;
			scenarioTotal = response.total;
			scenarioActiveCount = response.active_count;
			scenarioInactiveCount = response.inactive_count;
			await determineActiveSets();
		} catch (error: any) {
			const d = error?.detail;
			const msg = Array.isArray(d)
				? d.map((e: any) => e?.msg || e).join('; ')
				: d || error?.message || String(error);
			toast.error(`Failed to load scenarios: ${msg}`);
		} finally {
			loading = false;
		}
	}

	async function handleScenarioUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) {
			console.warn('No file selected for scenario upload');
			return;
		}

		console.log('Uploading scenario file:', file.name, 'Size:', file.size, 'bytes');
		uploadingScenarios = true;
		try {
			const result = await uploadScenariosAdmin(
				localStorage.token,
				file,
				scenarioSetName,
				'admin_upload',
				deactivatePreviousScenarios
			);
			let message = `Uploaded ${result.loaded} new scenarios. ${result.errors} errors.`;
			if (result.deactivated_count && result.deactivated_count > 0) {
				message += ` Deactivated ${result.deactivated_count} previous scenarios.`;
			}
			toast.success(message);
			if (result.error_details && result.error_details.length > 0) {
				console.warn('Upload errors:', result.error_details);
				// Show error details in console for debugging
				result.error_details.forEach((err: string, idx: number) => {
					console.warn(`Error ${idx + 1}:`, err);
				});
			}
			await loadStats();
			await loadScenarios();
		} catch (error: any) {
			console.error('Scenario upload error:', error);
			const detail = error?.detail;
			const errorMessage = Array.isArray(detail)
				? detail.map((e: any) => e?.msg || e).join('; ')
				: detail || error?.message || String(error);
			toast.error(`Failed to upload scenarios: ${errorMessage}`);
		} finally {
			uploadingScenarios = false;
			if (input) {
				input.value = ''; // Reset input
			}
		}
	}

	async function toggleScenarioActive(scenario: ScenarioModel) {
		try {
			await updateScenarioAdmin(localStorage.token, scenario.scenario_id, !scenario.is_active);
			toast.success(`Scenario ${scenario.is_active ? 'deactivated' : 'activated'}`);
			await loadStats();
			await loadScenarios();
		} catch (error: any) {
			toast.error(`Failed to update scenario: ${error.message || error}`);
		}
	}

	function truncateText(text: string, maxLength: number = 100): string {
		if (text.length <= maxLength) return text;
		return text.substring(0, maxLength) + '...';
	}

	function getUniqueValues(items: any[], field: string): string[] {
		const values = items.map((item) => item[field]).filter((v) => v);
		return [...new Set(values)].sort();
	}

	async function loadSetNames() {
		try {
			const scenarioResponse = await getScenarioSetNames(localStorage.token);
			scenarioSetNames = scenarioResponse.set_names;
		} catch (error: any) {
			const d = error?.detail;
			const msg = Array.isArray(d)
				? d.map((e: any) => e?.msg || e).join('; ')
				: d || error?.message || String(error);
			toast.error(`Failed to load set names: ${msg}`);
		}
	}

	async function determineActiveSets() {
		// Determine active set by checking which set_name has the most active scenarios
		try {
			const activeScenarios_ = scenarios.filter((s) => s.is_active);
			if (activeScenarios_.length > 0) {
				const setCounts = new Map<string | null, number>();
				activeScenarios_.forEach((s) => {
					const setName = s.set_name || null;
					setCounts.set(setName, (setCounts.get(setName) || 0) + 1);
				});
				let maxCount = 0;
				let maxSet: string | null = null;
				setCounts.forEach((count, setName) => {
					if (count > maxCount) {
						maxCount = count;
						maxSet = setName;
					}
				});
				activeScenarioSet = maxSet;
			}
		} catch (error: any) {
			console.error('Error determining active sets:', error);
		}
	}

	async function handleSetActiveScenarioSet() {
		settingActiveSet = true;
		try {
			const result = await setActiveScenarioSet(localStorage.token, activeScenarioSet);
			toast.success(
				`Activated ${result.activated} scenarios, deactivated ${result.deactivated} scenarios.`
			);
			await loadStats();
			await loadScenarios();
			await loadSetNames();
		} catch (error: any) {
			toast.error(`Failed to set active scenario set: ${error.message || error}`);
		} finally {
			settingActiveSet = false;
		}
	}
</script>

<form
	class="flex flex-col h-full justify-between space-y-3 text-sm"
	on:submit|preventDefault={async () => {
		saveHandler();
	}}
>
	<div class="space-y-3 overflow-y-scroll scrollbar-hidden h-full">
		<!-- Study Configuration -->
		<div
			class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
		>
			<h3 class="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-3">
				Study Configuration
			</h3>
			<div class="space-y-3">
				<div class="flex flex-col gap-1">
					<label
						class="text-xs font-medium text-gray-700 dark:text-gray-300"
						for="scenariosPerSession"
					>
						Scenarios per session
					</label>
					<input
						id="scenariosPerSession"
						type="number"
						min="1"
						max="50"
						bind:value={studyScenariosPerSession}
						class="w-24 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
					/>
					<span class="text-xs text-gray-500 dark:text-gray-400"
						>Number of scenarios shown to each participant per session (default: 6)</span
					>
				</div>
				<div class="flex flex-col gap-1">
					<label class="text-xs font-medium text-gray-700 dark:text-gray-300" for="completionCode">
						Prolific completion code
					</label>
					<input
						id="completionCode"
						type="text"
						placeholder="e.g. C4CEBIWM"
						bind:value={studyCompletionCode}
						class="w-48 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm font-mono"
					/>
					<span class="text-xs text-gray-500 dark:text-gray-400"
						>Prolific completion code shown to participants when they finish the study</span
					>
				</div>
				<button
					type="button"
					on:click={saveStudyConfig}
					disabled={savingStudyConfig || !studyConfigLoaded}
					class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors"
				>
					{savingStudyConfig ? 'Saving...' : 'Save study configuration'}
				</button>
			</div>
		</div>

		<!-- Scenarios -->
		<div class="space-y-4">
			<!-- Statistics -->
			{#if stats}
				<div
					class="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
				>
					<div>
						<div class="text-xs text-gray-500 dark:text-gray-400">Total Scenarios</div>
						<div class="text-lg font-semibold">{stats.total_scenarios}</div>
					</div>
					<div>
						<div class="text-xs text-gray-500 dark:text-gray-400">Active</div>
						<div class="text-lg font-semibold text-green-600 dark:text-green-400">
							{stats.active_scenarios}
						</div>
					</div>
					<div>
						<div class="text-xs text-gray-500 dark:text-gray-400">Total Assignments</div>
						<div class="text-lg font-semibold">{stats.total_assignments}</div>
					</div>
					<div>
						<div class="text-xs text-gray-500 dark:text-gray-400">Completed</div>
						<div class="text-lg font-semibold">{stats.total_completed}</div>
					</div>
				</div>
			{/if}

			<!-- Active Set Management -->
			<div
				class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
			>
				<div class="mb-2 text-sm font-medium">Active Scenario Set</div>
				<div class="mb-2">
					<label class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
						>Select Active Set</label
					>
					<select
						bind:value={activeScenarioSet}
						class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
						disabled={settingActiveSet}
					>
						<option value={null}>All sets active</option>
						{#each scenarioSetNames as setName}
							{#if setName !== null}
								<option value={setName}>{setName}</option>
							{/if}
						{/each}
					</select>
				</div>
				<p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
					Selecting a set will activate all scenarios with that set name and deactivate all others.
				</p>
				<button
					type="button"
					class="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
					on:click={handleSetActiveScenarioSet}
					disabled={settingActiveSet}
				>
					{settingActiveSet ? 'Updating...' : 'Apply Active Set'}
				</button>
			</div>

			<!-- Upload Section -->
			<div>
				<div class="mb-2 text-sm font-medium">Upload Scenarios</div>
				<div class="mb-2">
					<label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Set Name</label>
					<input
						type="text"
						bind:value={scenarioSetName}
						placeholder="e.g., pilot, scaled, v1"
						class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
						disabled={uploadingScenarios}
					/>
				</div>
				<label class="flex items-center space-x-2 mb-2">
					<input type="checkbox" bind:checked={deactivatePreviousScenarios} />
					<span class="text-xs">Deactivate previous scenarios with same set name</span>
				</label>
				<input
					bind:this={scenarioFileInput}
					type="file"
					accept=".json"
					hidden
					on:change={handleScenarioUpload}
					disabled={uploadingScenarios}
				/>
				<button
					type="button"
					class="flex rounded-md py-2 px-3 w-full hover:bg-gray-200 dark:hover:bg-gray-800 transition disabled:opacity-50"
					on:click={() => scenarioFileInput?.click()}
					disabled={uploadingScenarios}
				>
					<div class="self-center mr-3">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 16 16"
							fill="currentColor"
							class="w-4 h-4"
						>
							<path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3Z" />
							<path
								fill-rule="evenodd"
								d="M13 6H3v6a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6ZM8.75 7.75a.75.75 0 0 0-1.5 0v2.69L6.03 9.22a.75.75 0 0 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.06 0l2.5-2.5a.75.75 0 1 0-1.06-1.06l-1.22 1.22V7.75Z"
								clip-rule="evenodd"
							/>
						</svg>
					</div>
					<div class="self-center text-sm font-medium">
						{uploadingScenarios ? 'Uploading...' : 'Upload Scenarios JSON'}
					</div>
				</button>
				<div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
					JSON format should match Persona_generation/random_50_subset.json structure
				</div>
			</div>

			<!-- Filters -->
			<div class="grid grid-cols-1 md:grid-cols-4 gap-2">
				<div>
					<select
						bind:value={scenarioFilters.is_active}
						on:change={loadScenarios}
						class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
					>
						<option value={undefined}>All Status</option>
						<option value={true}>Active Only</option>
						<option value={false}>Inactive Only</option>
					</select>
				</div>
				<div>
					<select
						bind:value={scenarioFilters.trait}
						on:change={loadScenarios}
						class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
					>
						<option value="">All Traits</option>
						{#each getUniqueValues(scenarios, 'trait') as trait}
							<option value={trait}>{trait}</option>
						{/each}
					</select>
				</div>
				<div>
					<select
						bind:value={scenarioFilters.polarity}
						on:change={loadScenarios}
						class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
					>
						<option value="">All Polarity</option>
						{#each getUniqueValues(scenarios, 'polarity') as polarity}
							<option value={polarity}>{polarity}</option>
						{/each}
					</select>
				</div>
				<div>
					<select
						bind:value={scenarioFilters.domain}
						on:change={loadScenarios}
						class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
					>
						<option value="">All Domains</option>
						{#each getUniqueValues(scenarios, 'domain') as domain}
							<option value={domain}>{domain}</option>
						{/each}
					</select>
				</div>
			</div>

			<!-- Scenarios Table -->
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 dark:border-gray-700">
							<th class="text-left py-2 px-2">ID</th>
							<th class="text-left py-2 px-2">Prompt</th>
							<th class="text-left py-2 px-2">Response</th>
							<th class="text-left py-2 px-2">Trait</th>
							<th class="text-left py-2 px-2">Polarity</th>
							<th class="text-center py-2 px-2">Assigned</th>
							<th class="text-center py-2 px-2">Completed</th>
							<th class="text-center py-2 px-2">Status</th>
							<th class="text-center py-2 px-2">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#if loading}
							<tr>
								<td colspan="9" class="text-center py-4 text-gray-500">Loading...</td>
							</tr>
						{:else if scenarios.length === 0}
							<tr>
								<td colspan="9" class="text-center py-4 text-gray-500">No scenarios found</td>
							</tr>
						{:else}
							{#each scenarios as scenario}
								<tr
									class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
								>
									<td class="py-2 px-2 font-mono text-xs"
										>{truncateText(scenario.scenario_id, 12)}</td
									>
									<td class="py-2 px-2 max-w-xs truncate" title={scenario.prompt_text}>
										{truncateText(scenario.prompt_text, 50)}
									</td>
									<td class="py-2 px-2 max-w-xs truncate" title={scenario.response_text}>
										{truncateText(scenario.response_text, 50)}
									</td>
									<td class="py-2 px-2">{scenario.trait || '-'}</td>
									<td class="py-2 px-2">{scenario.polarity || '-'}</td>
									<td class="py-2 px-2 text-center">{scenario.n_assigned}</td>
									<td class="py-2 px-2 text-center">{scenario.n_completed}</td>
									<td class="py-2 px-2 text-center">
										<span
											class="px-2 py-1 text-xs rounded {scenario.is_active
												? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
												: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'}"
										>
											{scenario.is_active ? 'Active' : 'Inactive'}
										</span>
									</td>
									<td class="py-2 px-2 text-center">
										<button
											type="button"
											class="text-xs px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
											on:click={() => toggleScenarioActive(scenario)}
										>
											{scenario.is_active ? 'Deactivate' : 'Activate'}
										</button>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>

			<!-- Pagination -->
			{#if scenarioTotal > scenarioFilters.page_size}
				<div class="flex justify-between items-center">
					<div class="text-sm text-gray-500">
						Showing {(scenarioFilters.page - 1) * scenarioFilters.page_size + 1} to
						{Math.min(scenarioFilters.page * scenarioFilters.page_size, scenarioTotal)} of
						{scenarioTotal}
					</div>
					<div class="flex space-x-2">
						<button
							type="button"
							class="px-3 py-1 text-sm border rounded disabled:opacity-50"
							disabled={scenarioFilters.page === 1}
							on:click={() => {
								scenarioFilters.page--;
								loadScenarios();
							}}
						>
							Previous
						</button>
						<button
							type="button"
							class="px-3 py-1 text-sm border rounded disabled:opacity-50"
							disabled={scenarioFilters.page * scenarioFilters.page_size >= scenarioTotal}
							on:click={() => {
								scenarioFilters.page++;
								loadScenarios();
							}}
						>
							Next
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
</form>
