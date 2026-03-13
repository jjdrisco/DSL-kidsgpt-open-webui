<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { flyAndScale } from '$lib/utils/transitions';
	import * as FocusTrap from 'focus-trap';

	export let show = true;
	export let onConsent: () => void = () => {};
	export let onDecline: () => void = () => {};
	export let consentVersion: string = '1.0.0';
	export let consentDate: string = new Date().toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
	export let studyId: string | null = null;

	let modalElement = null;
	let mounted = false;
	let focusTrap: FocusTrap.FocusTrap | null = null;
	let consentContent: string = '';
	let loading = false;

	async function fetchConsentText() {
		loading = true;
		try {
			const params = new URLSearchParams();
			if (studyId) params.set('study_id', studyId);
			const res = await fetch(`/api/v1/prolific/consent-text?${params.toString()}`);
			if (res.ok) {
				const data = await res.json();
				consentContent = data.content || '';
			}
		} catch (err) {
			console.error('[CONSENT MODAL] Failed to fetch consent text:', err);
			consentContent = '';
		} finally {
			loading = false;
		}
	}

	$: if (show) {
		fetchConsentText();
	}

	// Prevent closing the modal - it must be blocking
	const handleKeyDown = (event: KeyboardEvent) => {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
		}
	};

	const handleConsent = () => {
		onConsent();
	};

	const handleDecline = () => {
		onDecline();
	};

	onMount(() => {
		mounted = true;
	});

	$: if (show && modalElement) {
		try {
			focusTrap = FocusTrap.createFocusTrap(modalElement);
			focusTrap.activate();
			window.addEventListener('keydown', handleKeyDown);
			document.body.style.overflow = 'hidden';
		} catch (error) {
			console.error('[CONSENT MODAL] Error activating modal:', error);
		}
	} else if (!show && modalElement) {
		focusTrap?.deactivate();
		window.removeEventListener('keydown', handleKeyDown);
		document.body.style.overflow = 'unset';
	}

	onDestroy(() => {
		if (focusTrap) {
			focusTrap.deactivate();
		}
		window.removeEventListener('keydown', handleKeyDown);
		document.body.style.overflow = 'unset';
	});
</script>

{#if show}
	<!-- Blocking modal - cannot be dismissed by clicking outside -->
	<div
		bind:this={modalElement}
		aria-modal="true"
		role="dialog"
		aria-labelledby="consent-title"
		aria-describedby="consent-content"
		class="modal fixed top-0 right-0 left-0 bottom-0 bg-black/30 dark:bg-black/60 w-full h-screen max-h-[100dvh] p-3 flex justify-center z-[99999] overflow-y-auto overscroll-contain"
		in:fade={{ duration: 200 }}
	>
		<div
			class="m-auto max-w-full w-[56rem] mx-2 shadow-3xl min-h-fit scrollbar-hidden bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-4xl border border-white dark:border-gray-850"
			in:flyAndScale
		>
			<div class="p-8 max-h-[90vh] overflow-y-auto" id="consent-content">
				<div class="mb-4">
					<h2 id="consent-title" class="text-2xl font-bold dark:text-gray-100">
						Consent to Participate in Research (Information Sheet)
					</h2>
				</div>

				<div
					class="text-xs text-gray-600 dark:text-gray-400 mb-6 pb-4 border-b border-gray-300 dark:border-gray-700"
				>
					Version: {consentVersion} • Date: {consentDate}
				</div>

				<div class="space-y-6 text-base dark:text-gray-200 leading-relaxed">
					{#if loading}
						<div class="flex justify-center py-8">
							<div class="text-gray-500 dark:text-gray-400">Loading consent information...</div>
						</div>
					{:else if consentContent}
						{@html consentContent}
					{:else}
						<p class="text-gray-500 dark:text-gray-400">
							No consent information available for this study.
						</p>
					{/if}

					<div class="border-t border-gray-300 dark:border-gray-700 pt-6 mt-6">
						<p class="font-semibold mb-4 text-base">Do you consent to participate?</p>

						<div class="flex flex-col sm:flex-row gap-4">
							<button
								on:click={handleConsent}
								disabled={loading}
								class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
							>
								I Consent, Begin
							</button>
							<button
								on:click={handleDecline}
								disabled={loading}
								class="flex-1 bg-gray-300 hover:bg-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
							>
								I Do Not Consent
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
