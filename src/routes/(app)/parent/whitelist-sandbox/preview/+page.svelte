<script lang="ts">
	import { onMount } from 'svelte';
	import ChatPreview from '../_components/ChatPreview.svelte';
	import { initializeSandbox } from '../_state/sandbox';

	onMount(async () => {
		await initializeSandbox();
	});
</script>

<div
	class="flex w-full min-h-0 flex-col bg-gray-50 dark:bg-gray-900 h-[100dvh] max-h-[100dvh] md:h-screen md:max-h-[100dvh]"
>
	<div class="flex min-h-0 flex-1 flex-col">
		<ChatPreview showMobileBack={true} />
	</div>
</div>
