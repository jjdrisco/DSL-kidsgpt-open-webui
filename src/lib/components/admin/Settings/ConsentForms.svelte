<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { toast } from 'svelte-sonner';
	import {
		getConsentForms,
		createConsentForm,
		updateConsentForm,
		deleteConsentForm,
		type ConsentFormModel
	} from '$lib/apis/consent-forms';

	const i18n = getContext('i18n');

	export let saveHandler: Function = () => {};

	let forms: ConsentFormModel[] = [];
	let loading = true;

	// Edit/create state
	let editing: ConsentFormModel | null = null;
	let creating = false;

	// Form fields
	let formSlug = '';
	let formStudyIds = '';
	let formVersion = '1.0.0';
	let formTitle = '';
	let formPiName = '';
	let formIrbNumber = '';
	let formBodyHtml = '';
	let formIsActive = true;

	// Preview
	let showPreview = false;

	function resetFormFields() {
		formSlug = '';
		formStudyIds = '';
		formVersion = '1.0.0';
		formTitle = '';
		formPiName = '';
		formIrbNumber = '';
		formBodyHtml = '';
		formIsActive = true;
		showPreview = false;
	}

	function populateFormFields(form: ConsentFormModel) {
		formSlug = form.slug;
		formStudyIds = form.study_ids.join(', ');
		formVersion = form.version;
		formTitle = form.title;
		formPiName = form.pi_name ?? '';
		formIrbNumber = form.irb_number ?? '';
		formBodyHtml = form.body_html;
		formIsActive = form.is_active;
		showPreview = false;
	}

	function parseStudyIds(input: string): string[] {
		return input
			.split(',')
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
	}

	async function loadForms() {
		loading = true;
		try {
			forms = await getConsentForms(localStorage.token);
		} catch (err: any) {
			toast.error(`Failed to load consent forms: ${err}`);
		} finally {
			loading = false;
		}
	}

	async function handleCreate() {
		try {
			const result = await createConsentForm(localStorage.token, {
				slug: formSlug,
				study_ids: parseStudyIds(formStudyIds),
				version: formVersion,
				title: formTitle,
				pi_name: formPiName || null,
				irb_number: formIrbNumber || null,
				body_html: formBodyHtml,
				is_active: formIsActive
			});
			if (result) {
				toast.success('Consent form created');
				creating = false;
				resetFormFields();
				await loadForms();
			}
		} catch (err: any) {
			toast.error(`Failed to create: ${err}`);
		}
	}

	async function handleUpdate() {
		if (!editing) return;
		try {
			const result = await updateConsentForm(localStorage.token, editing.id, {
				slug: formSlug,
				study_ids: parseStudyIds(formStudyIds),
				version: formVersion,
				title: formTitle,
				pi_name: formPiName || null,
				irb_number: formIrbNumber || null,
				body_html: formBodyHtml,
				is_active: formIsActive
			});
			if (result) {
				toast.success('Consent form updated');
				editing = null;
				resetFormFields();
				await loadForms();
			}
		} catch (err: any) {
			toast.error(`Failed to update: ${err}`);
		}
	}

	async function handleDeactivate(form: ConsentFormModel) {
		try {
			await deleteConsentForm(localStorage.token, form.id);
			toast.success('Consent form deactivated');
			await loadForms();
		} catch (err: any) {
			toast.error(`Failed to deactivate: ${err}`);
		}
	}

	async function handleReactivate(form: ConsentFormModel) {
		try {
			await updateConsentForm(localStorage.token, form.id, { is_active: true });
			toast.success('Consent form reactivated');
			await loadForms();
		} catch (err: any) {
			toast.error(`Failed to reactivate: ${err}`);
		}
	}

	function startEdit(form: ConsentFormModel) {
		creating = false;
		editing = form;
		populateFormFields(form);
	}

	function startCreate() {
		editing = null;
		creating = true;
		resetFormFields();
	}

	function cancelEdit() {
		editing = null;
		creating = false;
		resetFormFields();
	}

	function formatDate(timestamp: number): string {
		return new Date(timestamp * 1000).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	onMount(() => {
		loadForms();
	});
</script>

<div class="flex flex-col h-full justify-between text-sm">
	<div class="overflow-y-scroll scrollbar-hidden h-full pr-1.5 space-y-4">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-medium">{$i18n.t('Consent Forms')}</h3>
			{#if !creating && !editing}
				<button
					class="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
					on:click={startCreate}
				>
					+ {$i18n.t('New Consent Form')}
				</button>
			{/if}
		</div>

		<!-- Editor / Creator -->
		{#if creating || editing}
			<div class="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
				<div class="flex items-center justify-between mb-2">
					<h4 class="font-semibold text-base">
						{creating ? $i18n.t('Create Consent Form') : $i18n.t('Edit Consent Form')}
					</h4>
					<button
						class="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
						on:click={cancelEdit}
					>
						{$i18n.t('Cancel')}
					</button>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
					<div>
						<label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
							>{$i18n.t('Slug')}</label
						>
						<input
							type="text"
							bind:value={formSlug}
							placeholder="e.g. ucsd-parental-ai-study"
							class="w-full px-3 py-2 text-sm rounded-lg bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 outline-none"
						/>
					</div>
					<div>
						<label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
							>{$i18n.t('Version')}</label
						>
						<input
							type="text"
							bind:value={formVersion}
							placeholder="1.0.0"
							class="w-full px-3 py-2 text-sm rounded-lg bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 outline-none"
						/>
					</div>
				</div>

				<div>
					<label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
						>{$i18n.t('Title')}</label
					>
					<input
						type="text"
						bind:value={formTitle}
						placeholder="Study title"
						class="w-full px-3 py-2 text-sm rounded-lg bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 outline-none"
					/>
				</div>

				<div>
					<label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
						>{$i18n.t('Study IDs')} ({$i18n.t('comma-separated')})</label
					>
					<input
						type="text"
						bind:value={formStudyIds}
						placeholder="69d6b9879ae5dcb4c0752010, abc123..."
						class="w-full px-3 py-2 text-sm rounded-lg bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 outline-none font-mono"
					/>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
					<div>
						<label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
							>{$i18n.t('PI Name')}</label
						>
						<input
							type="text"
							bind:value={formPiName}
							placeholder="Principal Investigator"
							class="w-full px-3 py-2 text-sm rounded-lg bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 outline-none"
						/>
					</div>
					<div>
						<label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
							>{$i18n.t('IRB Number')}</label
						>
						<input
							type="text"
							bind:value={formIrbNumber}
							placeholder="Optional"
							class="w-full px-3 py-2 text-sm rounded-lg bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 outline-none"
						/>
					</div>
				</div>

				<div>
					<div class="flex items-center justify-between mb-1">
						<label class="block text-xs font-medium text-gray-600 dark:text-gray-400"
							>{$i18n.t('Consent HTML')}</label
						>
						<button
							type="button"
							class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
							on:click={() => (showPreview = !showPreview)}
						>
							{showPreview ? $i18n.t('Edit') : $i18n.t('Preview')}
						</button>
					</div>
					{#if showPreview}
						<div
							class="w-full min-h-[200px] max-h-[400px] overflow-y-auto px-4 py-3 text-sm rounded-lg bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 prose dark:prose-invert max-w-none"
						>
							{@html formBodyHtml}
						</div>
					{:else}
						<textarea
							bind:value={formBodyHtml}
							placeholder="<div>Consent form HTML content...</div>"
							rows="12"
							class="w-full px-3 py-2 text-sm rounded-lg bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 outline-none font-mono resize-y"
						/>
					{/if}
				</div>

				<div class="flex items-center gap-2">
					<input type="checkbox" bind:checked={formIsActive} id="form-is-active" />
					<label for="form-is-active" class="text-sm text-gray-700 dark:text-gray-300"
						>{$i18n.t('Active')}</label
					>
				</div>

				<div class="flex justify-end gap-2 pt-2">
					<button
						class="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
						on:click={cancelEdit}
					>
						{$i18n.t('Cancel')}
					</button>
					{#if creating}
						<button
							class="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
							on:click={handleCreate}
						>
							{$i18n.t('Create')}
						</button>
					{:else}
						<button
							class="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
							on:click={handleUpdate}
						>
							{$i18n.t('Save Changes')}
						</button>
					{/if}
				</div>
			</div>
		{/if}

		<!-- List of consent forms -->
		{#if loading}
			<div class="flex justify-center py-8">
				<div class="text-gray-500 dark:text-gray-400">{$i18n.t('Loading...')}</div>
			</div>
		{:else if forms.length === 0}
			<div class="text-center py-8 text-gray-500 dark:text-gray-400">
				{$i18n.t('No consent forms found. Create one to get started.')}
			</div>
		{:else}
			<div class="space-y-3">
				{#each forms as form (form.id)}
					<div
						class="border rounded-xl p-4 {form.is_active
							? 'border-gray-200 dark:border-gray-700'
							: 'border-gray-200/50 dark:border-gray-700/50 opacity-60'}"
					>
						<div class="flex items-start justify-between">
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-1">
									<h4 class="font-semibold text-base truncate">{form.title}</h4>
									{#if form.is_active}
										<span
											class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
										>
											Active
										</span>
									{:else}
										<span
											class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
										>
											Inactive
										</span>
									{/if}
								</div>
								<div class="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
									<div>
										<span class="font-medium">Slug:</span>
										<span class="font-mono">{form.slug}</span>
										&bull; <span class="font-medium">Version:</span>
										{form.version}
									</div>
									<div>
										<span class="font-medium">Study IDs:</span>
										<span class="font-mono">{form.study_ids.join(', ')}</span>
									</div>
									{#if form.pi_name}
										<div>
											<span class="font-medium">PI:</span>
											{form.pi_name}
											{#if form.irb_number}
												&bull; <span class="font-medium">IRB:</span> {form.irb_number}
											{/if}
										</div>
									{/if}
									<div>
										<span class="font-medium">Updated:</span>
										{formatDate(form.updated_at)}
									</div>
								</div>
							</div>
							<div class="flex items-center gap-1 ml-3 shrink-0">
								<button
									class="px-2.5 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
									on:click={() => startEdit(form)}
								>
									{$i18n.t('Edit')}
								</button>
								{#if form.is_active}
									<button
										class="px-2.5 py-1 text-xs rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
										on:click={() => handleDeactivate(form)}
									>
										{$i18n.t('Deactivate')}
									</button>
								{:else}
									<button
										class="px-2.5 py-1 text-xs rounded-lg border border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
										on:click={() => handleReactivate(form)}
									>
										{$i18n.t('Reactivate')}
									</button>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
