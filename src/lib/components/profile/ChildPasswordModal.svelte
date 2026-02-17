<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let show = false;
	export let childName = '';
	export let childEmail = '';
	export let password = '';

	const dispatch = createEventDispatcher();

	function copyToClipboard() {
		navigator.clipboard.writeText(password).then(() => {
			alert('Password copied to clipboard!');
		});
	}

	function closeModal() {
		dispatch('close');
		show = false;
	}
</script>

{#if show}
	<div
		class="fixed inset-0 z-50 bg-black bg-opacity-50 overflow-y-auto"
		on:click|self={closeModal}
		role="dialog"
		aria-modal="true"
	>
		<div class="min-h-screen flex items-center justify-center p-4">
			<div
				class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-md w-full my-8"
				on:click|stopPropagation
			>
			<div class="mb-6">
				<div class="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full">
					<svg
						class="w-8 h-8 text-green-600 dark:text-green-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M5 13l4 4L19 7"
						/>
					</svg>
				</div>
				<h3 class="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
					Child Account Created
				</h3>
				<p class="text-center text-gray-600 dark:text-gray-400">
					Account for <strong>{childName}</strong> has been created successfully.
				</p>
			</div>

			<div class="space-y-4 mb-6">
				<div class="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 rounded">
					<div class="flex items-start">
						<svg
							class="w-6 h-6 text-yellow-400 mr-3 flex-shrink-0 mt-0.5"
							fill="currentColor"
							viewBox="0 0 20 20"
						>
							<path
								fill-rule="evenodd"
								d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
								clip-rule="evenodd"
							/>
						</svg>
						<div>
							<p class="font-semibold text-yellow-800 dark:text-yellow-300 mb-1">
								Important: Save This Password Now
							</p>
							<p class="text-sm text-yellow-700 dark:text-yellow-400">
								This password will <strong>not be visible again</strong>. Save it securely before
								closing this window.
							</p>
						</div>
					</div>
				</div>

				<div class="space-y-2">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
						Email / Username
					</label>
					<div
						class="px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg font-mono text-sm text-gray-900 dark:text-white break-all"
					>
						{childEmail}
					</div>
				</div>

				<div class="space-y-2">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
						Generated Password
					</label>
					<div
						class="px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg font-mono text-sm text-gray-900 dark:text-white break-all flex items-center justify-between"
					>
						<span>{password}</span>
						<button
							type="button"
							on:click={copyToClipboard}
							class="ml-2 p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
							title="Copy to clipboard"
						>
							<svg
								class="w-5 h-5 text-gray-600 dark:text-gray-300"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
								/>
							</svg>
						</button>
					</div>
				</div>
			</div>

			<div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
				<p class="text-sm text-blue-900 dark:text-blue-200">
					<strong>Note on monitoring:</strong> We encourage you to use the built-in transparency
					and oversight tools rather than directly monitoring the child's account. This approach
					respects their privacy while keeping them safe.
				</p>
				<p class="text-sm text-blue-900 dark:text-blue-200 mt-2">
					If you need to change the password later, please contact an administrator.
				</p>
			</div>

			<button
				type="button"
				on:click={closeModal}
				class="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
			>
				I've Saved the Password
			</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Ensure modal is above everything */
	div[role='dialog'] {
		z-index: 9999;
	}
</style>
