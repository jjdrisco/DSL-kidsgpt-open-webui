<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { marked } from 'marked';

	import { onMount, getContext, tick, createEventDispatcher } from 'svelte';
	import { blur, fade } from 'svelte/transition';

	const dispatch = createEventDispatcher();

	import { getChatList } from '$lib/apis/chats';
	import { updateFolderById } from '$lib/apis/folders';

	import {
		config,
		user,
		models as _models,
		temporaryChatEnabled,
		selectedFolder,
		chats,
		currentChatPage
	} from '$lib/stores';
	import { sanitizeResponseContent, extractCurlyBraceWords } from '$lib/utils';
	import {
		isInterfaceModeEnabled,
		currentUserChildProfile
	} from '$lib/utils/interfaceModes';
	import { getSuggestionsForProfile } from '$lib/stores/suggestions';
	import { generateChildSuggestions } from '$lib/apis';
	import { WEBUI_API_BASE_URL, WEBUI_BASE_URL } from '$lib/constants';

	import Suggestions from './Suggestions.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import EyeSlash from '$lib/components/icons/EyeSlash.svelte';
	import MessageInputChild from './MessageInputChild.svelte';
	import FolderPlaceholder from './Placeholder/FolderPlaceholder.svelte';
	import FolderTitle from './Placeholder/FolderTitle.svelte';

	const i18n = getContext('i18n');

	export let createMessagePair: Function;
	export let stopResponse: Function;

	export let autoScroll = false;

	export let atSelectedModel: Model | undefined;
	export let selectedModels: [''];

	export let history;

	export let prompt = '';
	export let files = [];
	export let messageInput = null;

	export let selectedToolIds = [];
	export let selectedFilterIds = [];

	export let showCommands = false;

	export let imageGenerationEnabled = false;
	export let codeInterpreterEnabled = false;
	export let webSearchEnabled = false;

	export let onUpload: Function = (e) => {};
	export let onSelect = (e) => {};
	export let onChange = (e) => {};

	export let toolServers = [];

	let models = [];
	let selectedModelIdx = 0;

	$: if (selectedModels.length > 0) {
		selectedModelIdx = models.length - 1;
	}

	$: models = selectedModels.map((id) => $_models.find((m) => m.id === id));

	let generatedSuggestions: any[] = [];
	let loadingSuggestions = false;

	// Generate suggestions when profile or models change.
	// Depends on $currentUserChildProfile so block re-runs when profile loads.
	// Use atSelectedModel or resolved model when available; otherwise pass chat model (gpt-5.2-chat-latest).
	// Backend falls back to TASK_MODEL when chat model not found.
	$: profile = $currentUserChildProfile;
	
	// Reactive check for prompt_buttons mode (must depend on $currentUserChildProfile for reactivity)
	$: showPromptButtons = profile?.selected_interface_modes?.includes('prompt_buttons') ?? 
		(!profile?.selected_interface_modes || profile?.selected_interface_modes.length === 0);
	
	$: _debugSuggestions = console.log('[PlaceholderChild] suggestions block check', {
		selectedModels: selectedModels?.length ?? 0,
		modelsCount: $_models?.length ?? 0,
		enableSuggestion: $config?.features?.enable_suggestion_generation,
		hasProfile: !!profile,
		profileAge: profile?.child_age,
		profileFeatures: profile?.selected_features?.length ?? 0
	});
	$: if (
		selectedModels?.length > 0 &&
		$_models.length > 0 &&
		$config?.features?.enable_suggestion_generation !== false &&
		profile
	) {
		const modelId =
			atSelectedModel?.id ??
			models[selectedModelIdx]?.id ??
			$_models[0]?.id ??
			selectedModels[0];
		console.log('[PlaceholderChild] suggestions block RUNNING, calling API', {
			modelId,
			profileAge: profile.child_age,
			profileFeatures: profile.selected_features ?? []
		});
		loadingSuggestions = true;
		getSuggestionsForProfile(
			profile.child_age ?? null,
			profile.selected_features ?? [],
			modelId,
			localStorage.token ?? '',
			generateChildSuggestions
		)
			.then((suggestions) => {
				console.log('[PlaceholderChild] suggestions API result', {
					count: suggestions?.length ?? 0,
					suggestions: suggestions?.slice(0, 3)
				});
				generatedSuggestions = suggestions;
				loadingSuggestions = false;
			})
			.catch((err) => {
				console.error('[PlaceholderChild] suggestions API failed', err);
				generatedSuggestions = [];
				loadingSuggestions = false;
			});
	}
</script>

<div class="m-auto w-full max-w-6xl px-2 @2xl:px-20 translate-y-6 py-24 text-center">
	{#if $temporaryChatEnabled}
		<Tooltip
			content={$i18n.t("This chat won't appear in history and your messages will not be saved.")}
			className="w-full flex justify-center mb-0.5"
			placement="top"
		>
			<div class="flex items-center gap-2 text-gray-500 text-base my-2 w-fit">
				<EyeSlash strokeWidth="2.5" className="size-4" />{$i18n.t('Temporary Chat')}
			</div>
		</Tooltip>
	{/if}

	<div
		class="w-full text-3xl text-gray-800 dark:text-gray-100 text-center flex items-center gap-4 font-primary"
	>
		<div class="w-full flex flex-col justify-center items-center">
			{#if $selectedFolder}
				<FolderTitle
					folder={$selectedFolder}
					onUpdate={async (folder) => {
						await chats.set(await getChatList(localStorage.token, $currentChatPage));
						currentChatPage.set(1);
					}}
					onDelete={async () => {
						await chats.set(await getChatList(localStorage.token, $currentChatPage));
						currentChatPage.set(1);

						selectedFolder.set(null);
					}}
				/>
			{:else}
				<div class="flex flex-row justify-center gap-3 @sm:gap-3.5 w-fit px-5 max-w-xl">
					<div class="flex shrink-0 justify-center">
						<div class="flex -space-x-4 mb-0.5" in:fade={{ duration: 100 }}>
							{#each models as model, modelIdx}
								<Tooltip
									content={(models[modelIdx]?.info?.meta?.tags ?? [])
										.map((tag) => tag.name.toUpperCase())
										.join(', ')}
									placement="top"
								>
									<button
										aria-hidden={models.length <= 1}
										aria-label={$i18n.t('Get information on {{name}} in the UI', {
											name: models[modelIdx]?.name
										})}
										on:click={() => {
											selectedModelIdx = modelIdx;
										}}
									>
									<img
										src={`${WEBUI_BASE_URL}/static/favicon.png`}
										class=" size-9 @sm:size-10 rounded-full border-[1px] border-gray-100 dark:border-none"
										aria-hidden="true"
										draggable="false"
									/>
									</button>
								</Tooltip>
							{/each}
						</div>
					</div>

					<div
						class=" text-3xl @sm:text-3xl line-clamp-1 flex items-center"
						in:fade={{ duration: 100 }}
					>
						<Tooltip
							content="AI Smith GPT Kids"
							placement="top"
							className=" flex items-center "
						>
							<span class="line-clamp-1">
								AI Smith GPT Kids
							</span>
						</Tooltip>
					</div>
				</div>

				<div class="flex mt-1 mb-2">
					<div in:fade={{ duration: 100, delay: 50 }}>
						{#if models[selectedModelIdx]?.info?.meta?.description ?? null}
							<Tooltip
								className=" w-fit"
								content={marked.parse(
									sanitizeResponseContent(
										models[selectedModelIdx]?.info?.meta?.description ?? ''
									).replaceAll('\n', '<br>')
								)}
								placement="top"
							>
								<div
									class="mt-0.5 px-2 text-sm font-normal text-gray-500 dark:text-gray-400 line-clamp-2 max-w-xl markdown"
								>
									{@html marked.parse(
										sanitizeResponseContent(
											models[selectedModelIdx]?.info?.meta?.description ?? ''
										).replaceAll('\n', '<br>')
									)}
								</div>
							</Tooltip>

							{#if models[selectedModelIdx]?.info?.meta?.user}
								<div class="mt-0.5 text-sm font-normal text-gray-400 dark:text-gray-500">
									By
									{#if models[selectedModelIdx]?.info?.meta?.user.community}
										<a
											href="https://openwebui.com/m/{models[selectedModelIdx]?.info?.meta?.user
												.username}"
											>{models[selectedModelIdx]?.info?.meta?.user.name
												? models[selectedModelIdx]?.info?.meta?.user.name
												: `@${models[selectedModelIdx]?.info?.meta?.user.username}`}</a
										>
									{:else}
										{models[selectedModelIdx]?.info?.meta?.user.name}
									{/if}
								</div>
							{/if}
						{/if}
					</div>
				</div>
			{/if}

		<div class="text-base font-normal @md:max-w-3xl w-full py-3 {atSelectedModel ? 'mt-2' : ''}">
			<MessageInputChild
				bind:this={messageInput}
				{history}
				{selectedModels}
				bind:files
				bind:prompt
				bind:autoScroll
				bind:selectedToolIds
				bind:selectedFilterIds
				bind:imageGenerationEnabled
				bind:codeInterpreterEnabled
				bind:webSearchEnabled
				bind:atSelectedModel
				bind:showCommands
				{toolServers}
				{stopResponse}
				{createMessagePair}
				placeholder={$i18n.t('How can I help you today?')}
				{onChange}
				{onUpload}
				on:submit={(e) => {
					dispatch('submit', e.detail);
				}}
			/>
		</div>
		</div>
	</div>

	{#if $selectedFolder}
		<div
			class="mx-auto px-4 md:max-w-3xl md:px-6 font-primary min-h-62"
			in:fade={{ duration: 200, delay: 200 }}
		>
			<FolderPlaceholder folder={$selectedFolder} />
		</div>
	{:else}
		{#if showPromptButtons}
			<div class="mx-auto max-w-2xl font-primary mt-2" in:fade={{ duration: 200, delay: 200 }}>
				<div class="mx-5">
					{#if loadingSuggestions}
						<div class="text-sm text-gray-500 dark:text-gray-400">
							{$i18n.t('Generating suggestions...')}
						</div>
					{/if}
					<Suggestions
						suggestionPrompts={generatedSuggestions}
						inputValue={prompt}
						{onSelect}
					/>
				</div>
			</div>
		{/if}
	{/if}
</div>
