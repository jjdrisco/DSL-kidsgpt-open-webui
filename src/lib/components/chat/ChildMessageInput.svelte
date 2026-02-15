<script lang="ts">
	import { onMount } from 'svelte';
	import { getCurrentChildProfile, isFeatureEnabled } from '$lib/utils/childFeatures';
	import { CHILD_FEATURES } from '$lib/data/childFeatures';

	export let onSendMessage: ((message: string, files?: File[]) => void) | undefined = undefined;
	export let disabled: boolean = false;

	let childProfile = getCurrentChildProfile();
	let promptText = '';
	let selectedFeature = '';
	let availableFeatures: typeof CHILD_FEATURES = [];
	let showPhotoUpload = false;
	let photoFile: File | null = null;
	let photoPreview: string | null = null;

	$: if (childProfile) {
		availableFeatures = CHILD_FEATURES.filter((f) =>
			childProfile?.selected_features?.includes(f.id)
		);
		
		// Auto-select first feature if only one is available
		if (availableFeatures.length === 1) {
			selectedFeature = availableFeatures[0].id;
		}
	}

	$: if (selectedFeature) {
		const feature = CHILD_FEATURES.find((f) => f.id === selectedFeature);
		showPhotoUpload = feature?.capabilities.some((c) => c.id === 'photo_upload') ?? false;
	}

	function handlePhotoUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file && file.type.startsWith('image/')) {
			photoFile = file;
			const reader = new FileReader();
			reader.onload = (e) => {
				photoPreview = e.target?.result as string;
			};
			reader.readAsDataURL(file);
		}
	}

	function removePhoto() {
		photoFile = null;
		photoPreview = null;
	}

	function handleSend() {
		if (!promptText.trim() && !photoFile) return;
		if (!onSendMessage) return;

		const files = photoFile ? [photoFile] : undefined;
		onSendMessage(promptText.trim(), files);
		
		// Reset
		promptText = '';
		photoFile = null;
		photoPreview = null;
	}

	function handlePromptClick(prompt: string) {
		promptText = prompt;
	}

	onMount(() => {
		childProfile = getCurrentChildProfile();
	});
</script>

<div class="space-y-4">
	<!-- Reminder that AI is not human -->
	<div
		class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
	>
		<p class="text-sm text-blue-900 dark:text-blue-200 flex items-center gap-2">
			<span class="text-lg">🤖</span>
			<span>
				<strong>Remember:</strong> I'm an AI assistant, not a human. I can help with your
				schoolwork, but I'm a computer program.
			</span>
		</p>
	</div>

	<!-- Feature Selection (if multiple features) -->
	{#if availableFeatures.length > 1}
		<div>
			<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
				What would you like help with?
			</label>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
				{#each availableFeatures as feature}
					<button
						type="button"
						class={`p-4 rounded-lg border-2 transition-all text-left ${
							selectedFeature === feature.id
								? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
								: 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
						}`}
						on:click={() => {
							selectedFeature = feature.id;
						}}
					>
						<div class="flex items-center gap-2">
							{#if feature.icon}
								<span class="text-2xl">{feature.icon}</span>
							{/if}
							<span class="font-medium text-gray-900 dark:text-white">{feature.name}</span>
						</div>
					</button>
				{/each}
			</div>
		</div>
	{:else if availableFeatures.length === 1}
		{@const feature = availableFeatures[0]}
		<div
			class="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
		>
			<div class="flex items-center gap-2">
				{#if feature.icon}
					<span class="text-2xl">{feature.icon}</span>
				{/if}
				<span class="font-medium text-gray-900 dark:text-white">{feature.name}</span>
			</div>
		</div>
		{@const _ = (selectedFeature = feature.id)}
	{/if}

	<!-- School Assignment Feature Interface -->
	{#if selectedFeature === 'school_assignment'}
		<div class="space-y-4">
			<!-- Photo Upload Section -->
			{#if showPhotoUpload}
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						📷 Take a picture of your assignment
					</label>
					<div class="space-y-3">
						{#if photoPreview}
							<div class="relative">
								<img
									src={photoPreview}
									alt="Assignment preview"
									class="w-full max-w-md rounded-lg border border-gray-300 dark:border-gray-600"
								/>
								<button
									type="button"
									on:click={removePhoto}
									class="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
									aria-label="Remove photo"
								>
									<svg
										class="w-4 h-4"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M6 18L18 6M6 6l12 12"
										></path>
									</svg>
								</button>
							</div>
						{:else}
							<label
								class="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
							>
								<div class="flex flex-col items-center justify-center pt-5 pb-6">
									<svg
										class="w-10 h-10 mb-3 text-gray-400"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
										></path>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
										></path>
									</svg>
									<p class="mb-2 text-sm text-gray-500 dark:text-gray-400">
										<span class="font-semibold">Click to upload</span> or take a photo
									</p>
								</div>
								<input
									type="file"
									class="hidden"
									accept="image/*"
									capture="environment"
									on:change={handlePhotoUpload}
								/>
							</label>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Prompt Suggestions -->
			<div>
				<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
					Ask a question about your assignment
				</label>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
					<button
						type="button"
						class="p-3 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition text-sm"
						on:click={() => handlePromptClick("Can you help me understand this problem?")}
					>
						💡 Help me understand this problem
					</button>
					<button
						type="button"
						class="p-3 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition text-sm"
						on:click={() => handlePromptClick("What steps should I take to solve this?")}
					>
						📝 What steps should I take?
					</button>
					<button
						type="button"
						class="p-3 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition text-sm"
						on:click={() => handlePromptClick("Can you check if my answer is correct?")}
					>
						✅ Check if my answer is correct
					</button>
					<button
						type="button"
						class="p-3 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition text-sm"
						on:click={() => handlePromptClick("I need help with this math problem")}
					>
						🔢 Help with math problem
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Text Input -->
	<div>
		<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
			{#if selectedFeature === 'school_assignment'}
				Type your question here
			{:else}
				What would you like to ask?
			{/if}
		</label>
		<textarea
			bind:value={promptText}
			placeholder="Type your question here..."
			class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
			rows="3"
			disabled={disabled}
		></textarea>
	</div>

	<!-- Send Button -->
	<button
		type="button"
		on:click={handleSend}
		disabled={disabled || (!promptText.trim() && !photoFile)}
		class="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
	>
		<svg
			class="w-5 h-5"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
			></path>
		</svg>
		Send
	</button>
</div>
