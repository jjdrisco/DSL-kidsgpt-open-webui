<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	import { user } from '$lib/stores';
	import { getUserType } from '$lib/utils';

	import Chat from '$lib/components/chat/Chat.svelte';

	let showChat = false;

	onMount(async () => {
		if (!$user) {
			goto('/auth');
			return;
		}

		const userType = await getUserType($user, [], {
			mayFetchWhitelist: $user?.role === 'admin'
		});

		if (userType === 'child' || userType === 'parent') {
			goto(`/kids/chat/${$page.params.id}`);
			return;
		}

		showChat = true;
	});
</script>

{#if showChat}
	<Chat chatIdProp={$page.params.id} />
{/if}
