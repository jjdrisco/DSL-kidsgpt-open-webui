<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { showSidebar, user } from '$lib/stores';
	import { get } from 'svelte/store';
	import MenuLines from '$lib/components/icons/MenuLines.svelte';
	import AssignmentTimeTracker from '$lib/components/assignment/AssignmentTimeTracker.svelte';
	import HighlightDemo from '$lib/components/assignment/HighlightDemo.svelte';
	import {
		getWorkflowState,
		markInstructionsComplete,
		getCurrentAttempt
	} from '$lib/apis/workflow';

	// State to track if Start button was clicked
	let startButtonClicked: boolean = false;
	// State to track if instructions have been read (loaded from backend)
	let instructionsCompleted: boolean = false;
	// State for ready modal
	let showReadyModal: boolean = false;

	// Assignment time tracking
	let trackingEnabled: boolean = false;
	$: sessionId = $user?.current_session_id || 'unknown';
	let attemptNumber: number = 1;

	async function fetchInstructionsStatus() {
		try {
			const token = (typeof window !== 'undefined' && localStorage.token) || '';
			if (token) {
				const state = await getWorkflowState(token);
				instructionsCompleted = state?.progress_by_section?.instructions_completed || false;
				if (instructionsCompleted) {
					trackingEnabled = true;
				}
			}
		} catch (e) {
			console.warn('Failed to fetch workflow state:', e);
		}
	}

	onMount(async () => {
		await fetchInstructionsStatus();

		try {
			const token = (typeof window !== 'undefined' && localStorage.token) || '';
			if (token) {
				const attemptData = await getCurrentAttempt(token);
				attemptNumber = attemptData.current_attempt || 1;
			}
		} catch (e) {
			console.warn('Failed to get current attempt number', e);
		}

		const handleWorkflowUpdate = () => {
			fetchInstructionsStatus();
		};
		window.addEventListener('workflow-updated', handleWorkflowUpdate);

		// Default open sidebar on wide screens (md and up)
		try {
			if (typeof window !== 'undefined' && window.innerWidth >= 768) {
				showSidebar.set(true);
			}
		} catch (e) {}

		return () => {
			window.removeEventListener('workflow-updated', handleWorkflowUpdate);
		};
	});

	function startAssignment() {
		startButtonClicked = true;
		goto('/kids/profile');
	}

	async function handleMarkInstructionsComplete() {
		try {
			const token = (typeof window !== 'undefined' && localStorage.token) || '';
			if (token) {
				await markInstructionsComplete(token);
				instructionsCompleted = true;
				trackingEnabled = true;
				showReadyModal = true;
				window.dispatchEvent(new Event('workflow-updated'));
			}
		} catch (e) {
			console.error('Failed to mark instructions complete:', e);
		}
	}

	function proceedToTasks() {
		instructionsCompleted = true;
		showReadyModal = false;
		goto('/kids/profile');
	}

	function cancelReady() {
		showReadyModal = false;
	}
</script>

<svelte:head>
	<title>Assignment Instructions</title>
</svelte:head>

<div
	class="flex flex-col w-full h-screen max-h-[100dvh] transition-width duration-200 ease-in-out {$showSidebar
		? 'md:max-w-[calc(100%-260px)]'
		: ''} max-w-full"
>
	<nav
		class="px-2.5 pt-1.5 pb-2 backdrop-blur-xl w-full drag-region bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800"
	>
		<div class="flex items-center justify-between">
			<div class="flex items-center">
				<div class="{$showSidebar ? 'md:hidden' : ''} flex flex-none items-center self-end">
					<button
						id="sidebar-toggle-button"
						class="cursor-pointer p-1.5 flex rounded-xl hover:bg-gray-100 dark:hover:bg-gray-850 transition"
						on:click={() => {
							showSidebar.set(!$showSidebar);
						}}
						aria-label="Toggle Sidebar"
					>
						<div class="m-auto self-center">
							<MenuLines />
						</div>
					</button>
				</div>

				<div class="flex w-full">
					<div class="flex items-center text-xl font-semibold">Instructions</div>
				</div>
			</div>

			<!-- Navigation Buttons -->
			{#if instructionsCompleted}
				<div class="flex items-center space-x-2">
					<button
						on:click={() => goto('/kids/profile')}
						class="px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white"
					>
						<span>Next Task</span>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"
							></path>
						</svg>
					</button>
				</div>
			{/if}
		</div>
	</nav>

	<div class="flex-1 max-h-full overflow-y-auto bg-gray-50 dark:bg-gray-900">
		<div class="max-w-4xl mx-auto px-4 py-8">
			<!-- Header -->
			<div class="text-center mb-12">
				<p class="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
					In this survey, you'll complete three tasks to help us understand what moderation
					strategies would be most effective for children's conversations with AI.
				</p>
			</div>

			<!-- Task Steps (condensed) -->
			<p class="text-gray-600 dark:text-gray-300 mb-4">
				This study has three consecutive tasks: create a child profile, review example AI responses,
				and finally complete a short exit survey. When reviewing, highlight anything that stands out
				to you — positive or negative — and explain why. If a scenario isn’t relevant, simply click <em
					>Skip</em
				> and move on.
			</p>

			<!-- Highlighting Demo Animation -->
			<HighlightDemo />

			<!-- Help Videos Notice (trimmed) -->
			<div
				class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-8"
			>
				<p class="text-blue-700 dark:text-blue-300">
					📹 Tutorial videos are available via the help button on task pages.
				</p>
			</div>

			<!-- Important Notes (brief) -->
			<div
				class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 mb-8"
			>
				<p class="text-yellow-700 dark:text-yellow-300">
					⚠️ This survey contains attention‑check questions; please read everything carefully.
				</p>
			</div>

			<!-- Done Button -->
			<div class="text-center mt-8">
				{#if !instructionsCompleted}
					<button
						on:click={handleMarkInstructionsComplete}
						class="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-8 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
					>
						I've Read the Instructions
					</button>
					<p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
						Click when you're ready to proceed
					</p>
				{:else}
					<div
						class="text-green-600 dark:text-green-400 flex items-center justify-center space-x-2"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 13l4 4L19 7"
							></path>
						</svg>
						<span class="font-medium">Instructions Read</span>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Ready Modal -->
	{#if showReadyModal}
		<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
		<div
			class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
			on:click={cancelReady}
		>
			<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
			<div
				class="bg-white dark:bg-gray-800 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl"
				on:click|stopPropagation
			>
				<div class="text-center mb-6">
					<div
						class="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4"
					>
						<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							></path>
						</svg>
					</div>
					<h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Ready to Begin?</h3>
					<p class="text-gray-600 dark:text-gray-400">Have you read all the instructions?</p>
				</div>

				<div class="flex flex-col space-y-3">
					<button
						on:click={proceedToTasks}
						class="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
					>
						Yes, I'm Ready
					</button>
					<button
						on:click={cancelReady}
						class="px-6 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
					>
						No, Let me re-read
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Assignment Time Tracker -->
	{#if trackingEnabled}
		<AssignmentTimeTracker
			userId={get(user)?.id || ''}
			{sessionId}
			{attemptNumber}
			enabled={trackingEnabled}
		/>
	{/if}
</div>
