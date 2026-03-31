<script lang="ts">
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { toast } from 'svelte-sonner';
	import { showSidebar } from '$lib/stores';
	import MenuLines from '$lib/components/icons/MenuLines.svelte';
	import { childProfileSync } from '$lib/services/childProfileSync';
	import { getChildAccounts } from '$lib/apis/users';
	import { getChildChats } from '$lib/apis/chats';
	import {
		getChatTopicsCache,
		updateChatTopicsCache,
		updateChildProfileWhitelist
	} from '$lib/apis/child-profiles';
	import type { ChildProfile } from '$lib/apis/child-profiles';

	// ─── Types ────────────────────────────────────────────────────────────────
	interface ExtractedTopic {
		topic: string;
		detail: string;
		subtopics: string[];
		frequency: number;
	}

	interface TopicCache {
		lastProcessedAt: number;
		processedChatIds: string[];
		blockedTopics: ExtractedTopic[];
		discussedTopics: ExtractedTopic[];
		extractedAt: number;
	}

	// Known blocked message pattern (fallback for chats before the blocked flag)
	const BLOCKED_MSG_PREFIX = "I'm only able to help with the topics on your approved list";

	// ─── State ────────────────────────────────────────────────────────────────
	let profiles: ChildProfile[] = [];
	let childAccounts: any[] = [];
	let selectedProfileId: string | null = null;
	let selectedChildUserId: string | null = null;
	let blockedTopics: ExtractedTopic[] = [];
	let discussedTopics: ExtractedTopic[] = [];
	let expandedBlocked: Set<number> = new Set();
	let expandedDiscussed: Set<number> = new Set();
	let isLoading = false;
	let loadingMessage = '';
	let hasNoChats = false;
	let hasNoChildAccount = false;
	let whitelist: string[] = [];

	$: selectedProfile = profiles.find((p) => p.id === selectedProfileId) ?? null;

	// ─── Init ─────────────────────────────────────────────────────────────────
	async function refreshWhitelist() {
		if (!selectedProfileId) return;
		await childProfileSync.syncFromBackend();
		const fresh = await childProfileSync.getChildProfiles();
		const match = fresh.find((p) => p.id === selectedProfileId);
		whitelist = match?.selected_features ?? [];
	}

	onMount(async () => {
		try {
			await childProfileSync.syncFromBackend();
			profiles = await childProfileSync.getChildProfiles();
			const token = localStorage.getItem('token') ?? '';
			childAccounts = (await getChildAccounts(token)) ?? [];

			const currentId = childProfileSync.getCurrentChildId();
			const match = currentId ? profiles.find((p) => p.id === currentId) : profiles[0];
			if (match) {
				selectedProfileId = match.id;
				whitelist = match.selected_features ?? [];
				await loadTopicsForProfile(match);
			}
		} catch (e) {
			console.warn('[ChatTopics] Init error:', e);
		}
	});

	// ─── Profile selection ────────────────────────────────────────────────────
	async function onProfileChange() {
		const profile = profiles.find((p) => p.id === selectedProfileId);
		if (!profile) return;
		whitelist = profile.selected_features ?? [];
		expandedBlocked = new Set();
		expandedDiscussed = new Set();
		await loadTopicsForProfile(profile);
	}

	// ─── Load topics for a profile ────────────────────────────────────────────
	async function loadTopicsForProfile(profile: ChildProfile) {
		hasNoChats = false;
		hasNoChildAccount = false;
		blockedTopics = [];
		discussedTopics = [];

		const childAccount = childAccounts.find(
			(a: any) => a.email === profile.child_email
		);
		if (!childAccount) {
			hasNoChildAccount = true;
			selectedChildUserId = null;
			return;
		}
		selectedChildUserId = childAccount.id;

		isLoading = true;
		loadingMessage = 'Loading cached topics...';

		try {
			const token = localStorage.getItem('token') ?? '';
			let cache: TopicCache | null = await getChatTopicsCache(token, profile.id);

			// Invalidate old cache format (had `topics` instead of `blockedTopics`/`discussedTopics`)
			if (cache && !('blockedTopics' in cache)) {
				cache = null;
			}

			const since = cache?.lastProcessedAt ?? 0;
			const chats = await getChildChats(token, childAccount.id, since);

			const processedIds = new Set(cache?.processedChatIds ?? []);
			const newChats = (chats ?? []).filter((c: any) => !processedIds.has(c.id));

			if (!cache && (!chats || chats.length === 0)) {
				hasNoChats = true;
				isLoading = false;
				return;
			}

			if (newChats.length === 0 && cache) {
				blockedTopics = cache.blockedTopics ?? [];
				discussedTopics = cache.discussedTopics ?? [];
				isLoading = false;
				return;
			}

			// Separate blocked vs. successful user messages
			loadingMessage = 'Analyzing chat topics...';
			const { blocked, discussed } = classifyUserMessages(newChats);

			let newBlockedTopics: ExtractedTopic[] = [];
			let newDiscussedTopics: ExtractedTopic[] = [];

			if (blocked.length > 0) {
				loadingMessage = 'Extracting blocked topics...';
				newBlockedTopics = await extractTopics(blocked, 'blocked');
			}
			if (discussed.length > 0) {
				loadingMessage = 'Extracting discussed topics...';
				newDiscussedTopics = await extractTopics(discussed, 'discussed');
			}

			// Merge with existing cache
			if (cache?.blockedTopics && cache.blockedTopics.length > 0 && newBlockedTopics.length > 0) {
				loadingMessage = 'Merging topics...';
				blockedTopics = await mergeTopics(cache.blockedTopics, newBlockedTopics);
			} else {
				blockedTopics = [...(cache?.blockedTopics ?? []), ...newBlockedTopics];
			}

			if (cache?.discussedTopics && cache.discussedTopics.length > 0 && newDiscussedTopics.length > 0) {
				discussedTopics = await mergeTopics(cache.discussedTopics, newDiscussedTopics);
			} else {
				discussedTopics = [...(cache?.discussedTopics ?? []), ...newDiscussedTopics];
			}

			// Save updated cache
			const allProcessedIds = [
				...(cache?.processedChatIds ?? []),
				...newChats.map((c: any) => c.id)
			];
			const maxUpdatedAt = Math.max(
				since,
				...newChats.map((c: any) => c.updated_at ?? 0)
			);

			const updatedCache: TopicCache = {
				lastProcessedAt: maxUpdatedAt,
				processedChatIds: allProcessedIds,
				blockedTopics,
				discussedTopics,
				extractedAt: Date.now()
			};

			await updateChatTopicsCache(token, profile.id, updatedCache);
		} catch (e) {
			console.error('[ChatTopics] Error loading topics:', e);
			toast.error('Failed to load chat topics');
		} finally {
			isLoading = false;
		}
	}

	// ─── Classify messages as blocked or discussed ───────────────────────────
	function classifyUserMessages(chats: any[]): { blocked: string[]; discussed: string[] } {
		const blocked: string[] = [];
		const discussed: string[] = [];

		for (const chat of chats) {
			const history = chat.chat?.history ?? {};
			const messagesMap = history.messages ?? {};
			let currentId = history.currentId;

			// Walk the parentId chain from currentId back to root
			const chain: any[] = [];
			while (currentId && messagesMap[currentId]) {
				chain.unshift(messagesMap[currentId]);
				currentId = messagesMap[currentId].parentId;
			}

			for (let j = 0; j < chain.length; j++) {
				const msg = chain[j];
				if (msg.role !== 'user' || typeof msg.content !== 'string' || !msg.content.trim()) continue;

				// Check if the next message (assistant response) was a block
				const next = chain[j + 1];
				const wasBlocked =
					next &&
					next.role === 'assistant' &&
					(next.blocked === true ||
						(typeof next.content === 'string' &&
							next.content.startsWith(BLOCKED_MSG_PREFIX)));

				if (wasBlocked) {
					blocked.push(msg.content.trim());
				} else {
					discussed.push(msg.content.trim());
				}
			}
		}

		return { blocked, discussed };
	}

	// ─── LLM helper (non-streaming call) ─────────────────────────────────────
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
				stream: false
			})
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
		const data = await res.json();
		return data?.choices?.[0]?.message?.content ?? '';
	}

	function parseJsonResponse(text: string): any {
		let cleaned = text.trim();
		if (cleaned.startsWith('```')) {
			cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
		}
		return JSON.parse(cleaned);
	}

	// ─── Topic extraction ─────────────────────────────────────────────────────
	async function extractTopics(userMessages: string[], category: 'blocked' | 'discussed'): Promise<ExtractedTopic[]> {
		const context = category === 'blocked'
			? 'These are messages that were BLOCKED by the whitelist filter. The child tried to discuss these topics but was not allowed.'
			: 'These are messages that were successfully answered. The child discussed these topics within the whitelist.';

		const sysprompt = `You are analyzing a child's chat messages to extract discussion topics for their parent.
${context}

ABSTRACTION RULES:
- Match the abstraction level to the volume of discussion. If the child discussed many related sub-topics, group them under a broader category. If the child only touched on a subject briefly, keep the topic specific.
- Think of topics as things a parent could whitelist: "Math", "Creative writing", "Space and astronomy" — not overly generic ("School") or overly specific ("Question about multiplying fractions on Tuesday").
- Topics with many messages should be broader; topics with few messages should be more specific.

For each topic provide:
- "topic": a label at the appropriate abstraction level (3-8 words)
- "detail": 1-2 sentence summary of what was discussed (do NOT quote exact messages)
- "subtopics": optional list of more specific sub-topics if this is a broad category
- "frequency": number of related messages

Return ONLY valid JSON: { "topics": [{ "topic": string, "detail": string, "subtopics": string[], "frequency": number }] }`;

		const content = userMessages.map((m, i) => `[${i + 1}] ${m}`).join('\n');
		const raw = await llmCall(sysprompt, content);

		try {
			const parsed = parseJsonResponse(raw);
			return (parsed.topics ?? []).map((t: any) => ({
				topic: t.topic ?? 'Unknown',
				detail: t.detail ?? '',
				subtopics: Array.isArray(t.subtopics) ? t.subtopics : [],
				frequency: t.frequency ?? 0
			}));
		} catch (e) {
			console.error('[ChatTopics] Failed to parse extraction response:', raw);
			toast.error('Failed to parse topic extraction results');
			return [];
		}
	}

	// ─── Topic merging ────────────────────────────────────────────────────────
	async function mergeTopics(
		existing: ExtractedTopic[],
		newTopics: ExtractedTopic[]
	): Promise<ExtractedTopic[]> {
		const sysprompt = `You have an existing list of discussion topics and newly extracted topics from recent chats.
Merge them into a single consolidated list:
- If a new topic overlaps with an existing one, update the existing topic's detail, subtopics, and frequency (add the new frequency to the old).
- If a new topic is genuinely novel, add it as a new entry.
- Re-level abstraction: if an existing specific topic now has enough volume to be broader (or vice versa), adjust accordingly.
- Do NOT remove existing topics — they represent real past activity.

Return ONLY valid JSON in the same format: { "topics": [{ "topic": string, "detail": string, "subtopics": string[], "frequency": number }] }`;

		const content = `EXISTING TOPICS:\n${JSON.stringify(existing, null, 2)}\n\nNEW TOPICS:\n${JSON.stringify(newTopics, null, 2)}`;
		const raw = await llmCall(sysprompt, content);

		try {
			const parsed = parseJsonResponse(raw);
			return (parsed.topics ?? []).map((t: any) => ({
				topic: t.topic ?? 'Unknown',
				detail: t.detail ?? '',
				subtopics: Array.isArray(t.subtopics) ? t.subtopics : [],
				frequency: t.frequency ?? 0
			}));
		} catch (e) {
			console.error('[ChatTopics] Failed to parse merge response:', raw);
			return [...existing, ...newTopics];
		}
	}

	// ─── Actions ──────────────────────────────────────────────────────────────
	function toggleBlocked(index: number) {
		const next = new Set(expandedBlocked);
		if (next.has(index)) next.delete(index);
		else next.add(index);
		expandedBlocked = next;
	}

	function toggleDiscussed(index: number) {
		const next = new Set(expandedDiscussed);
		if (next.has(index)) next.delete(index);
		else next.add(index);
		expandedDiscussed = next;
	}

	function isOnWhitelist(topicLabel: string): boolean {
		const topicLower = topicLabel.toLowerCase();
		return whitelist.some((item) => {
			const itemLower = item.toLowerCase();
			return itemLower === topicLower || itemLower.includes(topicLower) || topicLower.includes(itemLower);
		});
	}

	async function addToWhitelist(topicLabel: string) {
		console.log('[ChatTopics] addToWhitelist called, selectedProfileId:', selectedProfileId, 'topic:', topicLabel);
		if (!selectedProfileId) {
			toast.error('No profile selected');
			return;
		}
		try {
			const token = localStorage.getItem('token') ?? '';
			await refreshWhitelist();
			console.log('[ChatTopics] Current whitelist after refresh:', whitelist);
			const updated = [...whitelist, topicLabel];
			console.log('[ChatTopics] Saving updated whitelist:', updated);
			await updateChildProfileWhitelist(token, selectedProfileId, updated);
			whitelist = updated;
			console.log('[ChatTopics] Whitelist saved successfully');
			toast.success(`Added "${topicLabel}" to whitelist`);
		} catch (e) {
			console.error('[ChatTopics] Error adding to whitelist:', e);
			toast.error('Failed to add to whitelist');
		}
	}

	async function removeFromWhitelist(topicLabel: string) {
		if (!selectedProfileId) return;
		try {
			const token = localStorage.getItem('token') ?? '';
			await refreshWhitelist();
			const topicLower = topicLabel.toLowerCase();
			const updated = whitelist.filter((item) => {
				const itemLower = item.toLowerCase();
				return !(itemLower === topicLower || itemLower.includes(topicLower) || topicLower.includes(itemLower));
			});
			await updateChildProfileWhitelist(token, selectedProfileId, updated);
			whitelist = updated;
			toast.success(`Removed "${topicLabel}" from whitelist`);
		} catch (e) {
			console.error('[ChatTopics] Error removing from whitelist:', e);
			toast.error('Failed to remove from whitelist');
		}
	}

	async function refreshTopics() {
		if (!selectedProfileId || !selectedChildUserId) return;
		const token = localStorage.getItem('token') ?? '';
		await updateChatTopicsCache(token, selectedProfileId, {
			lastProcessedAt: 0,
			processedChatIds: [],
			blockedTopics: [],
			discussedTopics: [],
			extractedAt: 0
		});
		const profile = profiles.find((p) => p.id === selectedProfileId);
		if (profile) {
			expandedBlocked = new Set();
			expandedDiscussed = new Set();
			await loadTopicsForProfile(profile);
		}
	}
</script>

<svelte:head>
	<title>Chat Topics - Parent View</title>
</svelte:head>

<div
	class="flex flex-col w-full h-screen max-h-[100dvh] transition-width duration-200 ease-in-out {$showSidebar
		? 'md:max-w-[calc(100%-260px)]'
		: ''} max-w-full"
>
	<!-- Navbar -->
	<nav
		class="px-2.5 pt-1.5 pb-2 backdrop-blur-xl w-full drag-region bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800"
	>
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<div class="{$showSidebar ? 'md:hidden' : ''} flex flex-none items-center self-end">
					<button
						id="sidebar-toggle-button"
						class="cursor-pointer p-1.5 flex rounded-xl hover:bg-gray-100 dark:hover:bg-gray-850 transition"
						on:click={() => ($showSidebar = !$showSidebar)}
					>
						<div class="m-auto self-center">
							<MenuLines />
						</div>
					</button>
				</div>
				<h1 class="text-lg font-semibold text-gray-800 dark:text-gray-200">Chat Topics</h1>
			</div>

			<div class="flex items-center gap-2">
				<button
					class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-500 dark:text-gray-400 text-sm font-medium"
					on:click={refreshTopics}
					disabled={isLoading}
					title="Re-analyze all chats from scratch"
				>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
						class="w-4 h-4 {isLoading ? 'animate-spin' : ''}">
						<path fill-rule="evenodd"
							d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H4.598a.75.75 0 00-.75.75v3.634a.75.75 0 001.5 0v-2.033l.312.311a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm-9.624-2.848a5.5 5.5 0 019.201-2.466l.312.311H12.77a.75.75 0 000 1.5h3.634a.75.75 0 00.75-.75V3.537a.75.75 0 00-1.5 0v2.033l-.312-.311A7 7 0 003.63 8.397a.75.75 0 001.449.39z"
							clip-rule="evenodd" />
					</svg>
					{isLoading ? 'Analyzing…' : 'Re-analyze'}
				</button>
			</div>
		</div>
	</nav>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
		<!-- Child selector -->
		{#if profiles.length > 1}
			<div class="flex items-center gap-2">
				<label for="child-select" class="text-sm font-medium text-gray-600 dark:text-gray-400">Child:</label>
				<select
					id="child-select"
					class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200"
					bind:value={selectedProfileId}
					on:change={onProfileChange}
				>
					{#each profiles as profile}
						<option value={profile.id}>{profile.name}</option>
					{/each}
				</select>
			</div>
		{/if}

		<!-- Loading -->
		{#if isLoading}
			<div class="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
				<svg class="animate-spin h-8 w-8 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
				</svg>
				<p class="text-sm">{loadingMessage}</p>
			</div>

		{:else if hasNoChildAccount}
			<div class="text-center py-16 text-gray-500 dark:text-gray-400">
				<p class="text-lg font-medium">No child account linked</p>
				<p class="text-sm mt-2">Create a child account for {selectedProfile?.name ?? 'this child'} to see their chat topics.</p>
			</div>

		{:else if hasNoChats}
			<div class="text-center py-16 text-gray-500 dark:text-gray-400">
				<p class="text-lg font-medium">No chats yet</p>
				<p class="text-sm mt-2">{selectedProfile?.name ?? 'Your child'} hasn't had any conversations yet.</p>
			</div>

		{:else}
			<!-- Blocked Topics Section -->
			{#if blockedTopics.length > 0}
				<div>
					<h2 class="text-sm font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-2">
						Blocked Topics
					</h2>
					<p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
						Your child tried to discuss these topics but they were blocked by the whitelist. You can add them if appropriate.
					</p>
					<div class="space-y-2">
						{#each blockedTopics as topic, i}
							<div class="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 overflow-hidden">
								<button
									class="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-red-50 dark:hover:bg-red-950/30 transition"
									on:click={() => toggleBlocked(i)}
								>
									<div class="flex items-center gap-3 min-w-0">
										<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
											class="w-4 h-4 text-gray-400 transition-transform flex-shrink-0 {expandedBlocked.has(i) ? 'rotate-90' : ''}">
											<path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
										</svg>
										<span class="font-medium text-gray-800 dark:text-gray-200 truncate">{topic.topic}</span>
									</div>
									<div class="flex items-center gap-2 flex-shrink-0">
										<span class="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300">
											{topic.frequency} blocked
										</span>
										{#if isOnWhitelist(topic.topic)}
											<span title="Added to whitelist" class="text-green-500">
												<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
													<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" />
												</svg>
											</span>
										{/if}
									</div>
								</button>

								{#if expandedBlocked.has(i)}
									<div transition:slide={{ duration: 200 }} class="px-4 pb-4 pt-1 border-t border-red-200/50 dark:border-red-900/30">
										<p class="text-sm text-gray-600 dark:text-gray-400 mb-3">{topic.detail}</p>

										{#if topic.subtopics && topic.subtopics.length > 0}
											<div class="flex flex-wrap gap-1.5 mb-3">
												{#each topic.subtopics as sub}
													<span class="text-xs px-2 py-1 rounded-lg bg-red-100/50 dark:bg-red-900/20 text-red-700 dark:text-red-300">{sub}</span>
												{/each}
											</div>
										{/if}

										{#if isOnWhitelist(topic.topic)}
											<div class="flex items-center gap-2">
												<span class="text-xs text-green-600 dark:text-green-400">Added to whitelist</span>
												<button
													class="text-xs px-2 py-1 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition"
													on:click|stopPropagation={() => removeFromWhitelist(topic.topic)}
												>
													Remove
												</button>
											</div>
										{:else}
											<button
												class="text-sm px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition"
												on:click|stopPropagation={() => addToWhitelist(topic.topic)}
											>
												+ Add to Whitelist
											</button>
										{/if}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Discussed Topics Section -->
			{#if discussedTopics.length > 0}
				<div>
					<h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
						Discussed Topics
					</h2>
					<p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
						Topics your child successfully discussed within the current whitelist.
					</p>
					<div class="space-y-2">
						{#each discussedTopics as topic, i}
							<div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 overflow-hidden">
								<button
									class="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition"
									on:click={() => toggleDiscussed(i)}
								>
									<div class="flex items-center gap-3 min-w-0">
										<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
											class="w-4 h-4 text-gray-400 transition-transform flex-shrink-0 {expandedDiscussed.has(i) ? 'rotate-90' : ''}">
											<path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
										</svg>
										<span class="font-medium text-gray-800 dark:text-gray-200 truncate">{topic.topic}</span>
									</div>
									<div class="flex items-center gap-2 flex-shrink-0">
										<span class="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-300">
											{topic.frequency} msg{topic.frequency !== 1 ? 's' : ''}
										</span>
									</div>
								</button>

								{#if expandedDiscussed.has(i)}
									<div transition:slide={{ duration: 200 }} class="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-gray-700">
										<p class="text-sm text-gray-600 dark:text-gray-400 mb-3">{topic.detail}</p>
										{#if topic.subtopics && topic.subtopics.length > 0}
											<div class="flex flex-wrap gap-1.5">
												{#each topic.subtopics as sub}
													<span class="text-xs px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{sub}</span>
												{/each}
											</div>
										{/if}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Nothing at all -->
			{#if blockedTopics.length === 0 && discussedTopics.length === 0}
				<div class="text-center py-16 text-gray-500 dark:text-gray-400">
					<p class="text-lg font-medium">No topics found</p>
					<p class="text-sm mt-2">Select a child to see their discussion topics.</p>
				</div>
			{/if}
		{/if}
	</div>
</div>
