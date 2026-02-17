<script lang="ts">
	import { page } from '$app/stores';

	import ChildChat from '$lib/components/chat/ChildChat.svelte';
</script>

<ChildChat chatIdProp={$page.params.id} />
