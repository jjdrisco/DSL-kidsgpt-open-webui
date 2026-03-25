<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { childProfileSync } from '$lib/services/childProfileSync';
	import { updateChildProfileWhitelist } from '$lib/apis/child-profiles';

	let childName: string = 'Your Child';
	let childAge: string = '';
	let profileId: string | null = null;

	onMount(async () => {
		try {
			const profiles = await childProfileSync.getChildProfiles();
			const currentId = childProfileSync.getCurrentChildId();
			const match = currentId ? profiles.find((p) => p.id === currentId) : profiles[0];
			if (match?.name) childName = match.name;
			if (match?.child_age) childAge = match.child_age;
			if (match?.id) profileId = match.id;
			// Pre-populate whitelist from saved profile if available
			if (match?.selected_features && match.selected_features.length > 0) {
				features = [...match.selected_features];
				const matchingPreset = SUGGESTIONS.find(
					(s) => JSON.stringify(s.features) === JSON.stringify(features)
				);
				adoptedFrom = matchingPreset ? matchingPreset.label : '✏️ Custom / DIY';
			}
		} catch (e) {
			console.warn('[Sandbox] Could not load child profile:', e);
		}
	});

	// ─── Suggestion chips with feature bullets ─────────────────────────────────
	const SUGGESTIONS: { label: string; features: string[] }[] = [
		{
			label: '📚 School Assignment',
			features: [
				'Simple greetings and friendly conversation starters',
				'Math homework and problem-solving',
				'Science concepts and experiments',
				'History and geography questions',
				'Reading comprehension and analysis',
				'Essay writing and grammar help',
				'Study skills and exam preparation'
			]
		},
		{
			label: '💬 General Questions',
			features: [
				'Simple greetings and friendly conversation starters',
				'General knowledge and factual information',
				'Nature, animals, and the environment',
				'Space, planets, and astronomy',
				'How everyday things work',
				'Geography and world cultures'
			]
		},
		{
			label: '✍️ Creative Writing',
			features: [
				'Simple greetings and friendly conversation starters',
				'Story writing and storytelling',
				'Poetry and rhymes',
				'Character and world building',
				'Writing prompts and brainstorming',
				'Editing and improving writing'
			]
		},
		{
			label: '🚫 No Personal Advice',
			features: [
				'Simple greetings and friendly conversation starters',
				'Educational and factual questions only',
				'Science, math, and academic topics',
				'Creative and imaginative activities (age-appropriate)',
				'General knowledge and curiosity questions'
			]
		},
		{
			label: '✏️ Custom / DIY',
			features: []
		}
	];

	// ─── State ────────────────────────────────────────────────────────────────
	let features: string[] = [...SUGGESTIONS[0].features];
	let adoptedFrom: string = SUGGESTIONS[0].label;
	let expandedSuggestion: string | null = null;
	let newFeatureText: string = '';

	// True when the feature list has diverged from the adopted preset.
	$: adoptedFeatures = SUGGESTIONS.find((s) => s.label === adoptedFrom)?.features ?? [];
	$: isCustomized = JSON.stringify(features) !== JSON.stringify(adoptedFeatures);

	// ─── Auto-save status ─────────────────────────────────────────────────────
	type SaveStatus = 'idle' | 'saving' | 'saved';
	let saveStatus: SaveStatus = 'idle';
	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	let savedClearTimer: ReturnType<typeof setTimeout> | null = null;

	function scheduleSave() {
		if (!profileId) return;
		if (saveTimer) clearTimeout(saveTimer);
		if (savedClearTimer) clearTimeout(savedClearTimer);
		saveStatus = 'saving';
		saveTimer = setTimeout(persistWhitelist, 800);
	}

	async function persistWhitelist() {
		if (!profileId) return;
		try {
			const token = localStorage.getItem('token') ?? '';
			await updateChildProfileWhitelist(token, profileId, features);
			saveStatus = 'saved';
			savedClearTimer = setTimeout(() => (saveStatus = 'idle'), 2500);
		} catch (e) {
			console.error('[Sandbox] Failed to save whitelist:', e);
			saveStatus = 'idle';
		}
	}

	interface Message {
		role: 'user' | 'assistant';
		content: string;
	}

	let messages: Message[] = [];
	let inputText: string = '';
	let isLoading: boolean = false;
	let chatContainer: HTMLDivElement;
	let addInput: HTMLInputElement;

	// ─── System prompt auto-built from feature bullets ─────────────────────────
	$: systemPrompt = buildSystemPrompt(features);

	function buildSystemPrompt(featureList: string[]): string {
		if (featureList.length === 0) {
			return 'You are a safe and helpful AI assistant for a child. Be friendly and age-appropriate in all responses. Decline any topic that is not educational, creative, or factual in nature.';
		}
		const bulletList = featureList.map((f) => `• ${f}`).join('\n');
		return (
			`You are a safe and helpful AI assistant for a child. ` +
			`You are ONLY allowed to assist with the following approved topics and activities:\n\n` +
			`${bulletList}\n\n` +
			`For any topic, question, or request that is NOT on this approved list, politely decline ` +
			`and suggest the child speaks with a trusted adult or parent. ` +
			`Do not help with anything outside this whitelist under any circumstances. ` +
			`Keep all responses age-appropriate, positive, and encouraging.`
		);
	}

	// ─── Feature management ───────────────────────────────────────────────────
	function toggleSuggestion(label: string) {
		expandedSuggestion = expandedSuggestion === label ? null : label;
	}

	function adoptSuggestion(suggestion: { label: string; features: string[] }) {
		features = [...suggestion.features];
		adoptedFrom = suggestion.label;
		expandedSuggestion = null;
		scheduleSave();
	}

	function revertToPreset() {
		const preset = SUGGESTIONS.find((s) => s.label === adoptedFrom);
		if (!preset) return;
		features = [...preset.features];
		scheduleSave();
	}

	function removeFeature(index: number) {
		features = features.filter((_, i) => i !== index);
		scheduleSave();
	}

	function addFeature() {
		const trimmed = newFeatureText.trim();
		if (!trimmed) return;
		features = [...features, trimmed];
		newFeatureText = '';
		addInput?.focus();
		scheduleSave();
	}

	function handleAddKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addFeature();
		}
	}

	function updateFeature(index: number, value: string) {
		features = features.map((f, i) => (i === index ? value : f));
		scheduleSave();
	}

	// ─── Chat helpers ─────────────────────────────────────────────────────────
	function reset() {
		messages = [];
		inputText = '';
	}

	function scrollToBottom() {
		if (chatContainer) {
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}
	}

	// ─── LLM helper (single non-streaming call) ──────────────────────────────
	async function llmCall(sysprompt: string, userContent: string): Promise<string> {
		const res = await fetch('/api/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`
			},
			body: JSON.stringify({
				model: 'gpt-5.2-chat-latest',
				messages: [
					{ role: 'system', content: sysprompt },
					{ role: 'user', content: userContent }
				],
				stream: false,
				metadata: { sandbox_mode: true }
			})
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
		const data = await res.json();
		return data?.choices?.[0]?.message?.content ?? '';
	}

	async function sendMessage() {
		const text = inputText.trim();
		if (!text || isLoading) return;

		const newUserMsg: Message = { role: 'user', content: text };
		messages = [...messages, newUserMsg];
		inputText = '';
		isLoading = true;

		setTimeout(scrollToBottom, 50);

		console.log('[DEBUG] SYSTEM PROMPT:', systemPrompt);
		console.log('[DEBUG] ORIGINAL PROMPT:', text);

		try {
			// ── Step 1: Rewrite the child's prompt to fit the whitelist ────────────
			const ageClause = childAge ? `The child is ${childAge}. ` : '';
			const promptRewriteSystem =
				`You are a strict content-routing assistant for a children's AI. ` +
				ageClause +
				`Your job is to rewrite the child's message so it only addresses topics from the approved whitelist below, ` +
				`and so that the phrasing and vocabulary are appropriate for a child of that age. ` +
				`If the message is already on-topic, return it unchanged or lightly reworded for clarity. ` +
				`If the message cannot be redirected to any approved topic, respond with exactly: [BLOCKED]\n\n` +
				`Approved whitelist:\n${features.map((f) => `• ${f}`).join('\n')}\n\n` +
				`Return ONLY the rewritten message (or [BLOCKED]). Do not add explanations.`;

			const rewrittenPrompt = await llmCall(promptRewriteSystem, text);
			console.log('[DEBUG] REWRITTEN PROMPT:', rewrittenPrompt);

			if (rewrittenPrompt.trim() === '[BLOCKED]') {
				console.log('[DEBUG] PROMPT BLOCKED — not sending to provider');
				const blockedMsg =
					"I'm only able to help with the topics on your child's approved whitelist. " +
					'This question falls outside of the topics I can help with — please speak with a trusted adult or parent for help with this one!';
				messages = [...messages, { role: 'assistant', content: blockedMsg }];
				return;
			}

			// ── Step 2: Send the rewritten prompt to the main model ───────────────
			const historyBeforeCurrent = messages.slice(0, -1); // exclude the just-added user msg
			const apiMessages = [
				{ role: 'system', content: systemPrompt },
				...historyBeforeCurrent.map((m) => ({ role: m.role, content: m.content })),
				{ role: 'user', content: rewrittenPrompt }
			];

			console.log('[DEBUG] PROMPT TO PROVIDER:', rewrittenPrompt);

			const mainRes = await fetch('/api/chat/completions', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`
				},
				body: JSON.stringify({
					model: 'gpt-5.2-chat-latest',
					messages: apiMessages,
					stream: false,
					metadata: { sandbox_mode: true }
				})
			});

			if (!mainRes.ok) {
				const errText = await mainRes.text();
				console.error('[DEBUG] API error:', mainRes.status, errText);
				toast.error(`API error: ${mainRes.status}`);
				messages = [...messages, { role: 'assistant', content: `[Error ${mainRes.status}]` }];
				return;
			}

			const mainData = await mainRes.json();
			const providerResponse = mainData?.choices?.[0]?.message?.content ?? '[No response content]';
			console.log('[DEBUG] PROVIDER RESPONSE / FINAL RESPONSE:', providerResponse);

			messages = [...messages, { role: 'assistant', content: providerResponse }];
		} catch (err) {
			console.error('[DEBUG] Fetch error:', err);
			toast.error('Failed to reach the API. Is the backend running?');
			messages = [...messages, { role: 'assistant', content: '[Network error — check backend]' }];
		} finally {
			isLoading = false;
			setTimeout(scrollToBottom, 50);
		}
	}

	function handleChatKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}
</script>

<div class="flex w-full h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
	<!-- ── Left: Whitelist Builder ──────────────────────────────────────────── -->
	<div
		class="w-1/2 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto"
	>
		<!-- Header -->
		<div
			class="px-6 py-5 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-4"
		>
			<div>
				<h1 class="text-xl font-bold text-gray-900 dark:text-white">{childName}'s Whitelist</h1>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
					Define what topics and content your child's AI can discuss.
				</p>
			</div>
			<div class="shrink-0 mt-1.5 text-xs font-medium min-w-[56px] text-right">
				{#if saveStatus === 'saving'}
					<span class="text-gray-400 dark:text-gray-500">Saving…</span>
				{:else if saveStatus === 'saved'}
					<span class="text-green-500 dark:text-green-400">Saved ✓</span>
				{:else}
					<span class="text-gray-300 dark:text-gray-600">Auto-save on</span>
				{/if}
			</div>
		</div>

		<!-- Quick suggestions -->
		<div class="px-6 pt-5">
			<p
				class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3"
			>
				Quick suggestions
			</p>
			<div class="space-y-2">
				{#each SUGGESTIONS.filter(s => s.features.length > 0) as suggestion}
					{@const isAdopted = adoptedFrom === suggestion.label && !isCustomized}
					{@const isExpanded = expandedSuggestion === suggestion.label}
					<div
						class="rounded-lg border transition
							{isAdopted
							? 'border-blue-500 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/20'
							: isCustomized
								? 'border-gray-200 dark:border-gray-700 opacity-50'
								: 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}"
					>
						<button
							type="button"
							on:click={() => toggleSuggestion(suggestion.label)}
							class="w-full flex items-center justify-between px-4 py-2.5 text-left"
						>
							<span class="text-sm font-medium {isAdopted ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200'}">
								{suggestion.label}
								{#if isAdopted}
									<span class="ml-1.5 text-xs font-normal text-blue-500 dark:text-blue-400">(active)</span>
								{/if}
							</span>
							<span class="text-gray-400 dark:text-gray-500 text-xs transition-transform {isExpanded ? 'rotate-180' : ''}">
								&#9662;
							</span>
						</button>

						{#if isExpanded}
							<div class="px-4 pb-3 border-t border-gray-100 dark:border-gray-700/50 pt-2">
								<ul class="space-y-1 mb-3">
									{#each suggestion.features as feature}
										<li class="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
											<span class="text-gray-300 dark:text-gray-600 mt-0.5 shrink-0">&#8226;</span>
											<span>{feature}</span>
										</li>
									{/each}
								</ul>
								<button
									type="button"
									disabled={isAdopted}
									on:click={() => adoptSuggestion(suggestion)}
									class="w-full py-1.5 rounded-md text-xs font-medium transition
										{isAdopted
										? 'bg-blue-100 dark:bg-blue-900/30 text-blue-400 dark:text-blue-500 cursor-default'
										: 'bg-blue-600 text-white hover:bg-blue-700'}"
								>
									{isAdopted ? 'Currently Active' : 'Adopt'}
								</button>
							</div>
						{/if}
					</div>
				{/each}
			</div>
			{#if isCustomized && adoptedFeatures.length > 0}
				<button
					type="button"
					on:click={revertToPreset}
					class="mt-2 text-xs text-blue-500 dark:text-blue-400 hover:underline"
				>
					Revert to {adoptedFrom}
				</button>
			{/if}
		</div>

		<!-- Feature bullet list -->
		<div class="px-6 pt-5 flex flex-col flex-1">
			<p
				class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3"
			>
				Approved Features
			</p>

			<ul class="space-y-2 mb-4">
				{#each features as feature, i}
					<li class="flex items-center gap-2 group">
						<span class="text-blue-500 dark:text-blue-400 text-sm mt-0.5 shrink-0">•</span>
						<input
							type="text"
							value={feature}
							on:input={(e) => updateFeature(i, (e.target as HTMLInputElement).value)}
							class="flex-1 text-sm bg-transparent border-b border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none text-gray-800 dark:text-gray-100 py-0.5 transition"
						/>
						<button
							type="button"
							on:click={() => removeFeature(i)}
							class="text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-500 opacity-0 group-hover:opacity-100 transition text-base leading-none shrink-0"
							aria-label="Remove"
						>
							×
						</button>
					</li>
				{/each}
			</ul>

			<!-- Add a new feature -->
			<div class="flex items-center gap-2 mb-2">
				<span class="text-gray-300 dark:text-gray-600 text-sm shrink-0">+</span>
				<input
					bind:this={addInput}
					bind:value={newFeatureText}
					on:keydown={handleAddKeydown}
					type="text"
					placeholder="Add a feature or topic…"
					class="flex-1 text-sm bg-transparent border-b border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none text-gray-800 dark:text-gray-100 py-0.5 placeholder-gray-400 dark:placeholder-gray-600 transition"
				/>
				<button
					type="button"
					on:click={addFeature}
					disabled={!newFeatureText.trim()}
					class="text-xs px-2.5 py-1 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-700 transition shrink-0"
				>
					Add
				</button>
			</div>
		</div>
	</div>

	<!-- ── Right: Chat Tester ───────────────────────────────────────────────── -->
	<div class="w-1/2 flex flex-col bg-white dark:bg-gray-850">
		<!-- Header -->
		<div
			class="px-6 py-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between"
		>
			<div>
				<h2 class="text-xl font-bold text-gray-900 dark:text-white">Chat Preview</h2>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
					Test how the AI responds to your child using the whitelist above.
				</p>
			</div>
			<button
				type="button"
				on:click={reset}
				class="shrink-0 px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition"
			>
				Reset Chat
			</button>
		</div>

		<!-- Message history -->
		<div bind:this={chatContainer} class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
			{#if messages.length === 0}
				<div
					class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm italic"
				>
					No messages yet. Type something below to test the whitelist.
				</div>
			{/if}

			{#each messages as msg}
				<div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
					<div
						class="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
							{msg.role === 'user'
							? 'bg-blue-600 text-white rounded-br-sm'
							: 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-sm'}"
					>
						{msg.content}
					</div>
				</div>
			{/each}

			{#if isLoading}
				<div class="flex justify-start">
					<div class="bg-gray-100 dark:bg-gray-700 rounded-2xl rounded-bl-sm px-4 py-3">
						<span class="flex gap-1">
							<span
								class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
								style="animation-delay: 0ms"
							/>
							<span
								class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
								style="animation-delay: 150ms"
							/>
							<span
								class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
								style="animation-delay: 300ms"
							/>
						</span>
					</div>
				</div>
			{/if}
		</div>

		<!-- Input bar -->
		<div class="px-4 py-4 border-t border-gray-200 dark:border-gray-700">
			<div class="flex items-end gap-2">
				<textarea
					bind:value={inputText}
					on:keydown={handleChatKeydown}
					rows={2}
					placeholder="Type a message as the child would… (Enter to send)"
					class="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white text-sm px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
				/>
				<button
					type="button"
					on:click={sendMessage}
					disabled={isLoading || !inputText.trim()}
					class="shrink-0 h-10 px-5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
				>
					Send
				</button>
			</div>
		</div>
	</div>
</div>
