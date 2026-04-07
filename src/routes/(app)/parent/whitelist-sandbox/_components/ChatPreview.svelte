<script lang="ts">
	import { goto } from '$app/navigation';
	import { afterUpdate } from 'svelte';
	import { get } from 'svelte/store';
	import { messages, inputText, isLoading, setInputValue, sendMessage, resetChat } from '../_state/sandbox';

	export let showMobileBack: boolean = false;
	export let builderPath: string = '/parent/whitelist-sandbox';

	let chatContainer: HTMLDivElement;
	/** Avoid scroll-on-every-update (was freezing the tab via tick() in a reactive that always re-ran). */
	let lastScrollKey = '';

	afterUpdate(() => {
		if (!chatContainer) return;
		const key = `${get(messages).length}:${get(isLoading)}`;
		if (key === lastScrollKey) return;
		lastScrollKey = key;
		chatContainer.scrollTop = chatContainer.scrollHeight;
	});

	function handleChatKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}
</script>

<section class="flex h-full min-h-0 w-full flex-col bg-white dark:bg-gray-850">
	<div
		class="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3"
	>
		<div class="min-w-0">
			<h2 class="text-xl font-bold text-gray-900 dark:text-white">Chat Preview</h2>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				Test how the AI responds to your child using the whitelist above.
			</p>
			{#if showMobileBack}
				<button
					type="button"
					class="mt-2 text-sm text-blue-500 dark:text-blue-400 hover:underline md:hidden text-left"
					on:click={() => goto(builderPath)}
				>
					← Back to Whitelist Builder
				</button>
			{/if}
		</div>
		<button
			type="button"
			on:click={resetChat}
			class="shrink-0 px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition min-h-9"
		>
			Reset Chat
		</button>
	</div>

	<div bind:this={chatContainer} class="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 min-h-0">
		{#if $messages.length === 0}
			<div class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm italic">
				No messages yet. Type something below to test the whitelist.
			</div>
		{/if}

		{#each $messages as msg}
			<div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
				<div
					class="max-w-[88%] sm:max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words
						{msg.role === 'user'
						? 'bg-blue-600 text-white rounded-br-sm'
						: 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-sm'}"
				>
					{msg.content}
				</div>
			</div>
		{/each}

		{#if $isLoading}
			<div class="flex justify-start">
				<div class="bg-gray-100 dark:bg-gray-700 rounded-2xl rounded-bl-sm px-4 py-3">
					<span class="flex gap-1">
						<span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
						<span
							class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
							style="animation-delay: 150ms"
						></span>
						<span
							class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
							style="animation-delay: 300ms"
						></span>
					</span>
				</div>
			</div>
		{/if}
	</div>

	<div class="px-4 py-4 border-t border-gray-200 dark:border-gray-700">
		<div class="flex items-end gap-2">
			<textarea
				bind:value={$inputText}
				on:input={(e) => setInputValue((e.target as HTMLTextAreaElement).value)}
				on:keydown={handleChatKeydown}
				rows={2}
				placeholder="Type a message as the child would… (Enter to send)"
				class="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white text-sm px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
			></textarea>
			<button
				type="button"
				on:click={sendMessage}
				disabled={$isLoading || !$inputText.trim()}
				class="shrink-0 h-10 px-5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
			>
				Send
			</button>
		</div>
	</div>
</section>
