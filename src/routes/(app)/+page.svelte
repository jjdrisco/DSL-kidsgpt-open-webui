<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { user } from '$lib/stores';
    import { getUserType } from '$lib/utils';
    import { getWorkflowState } from '$lib/apis/workflow';
    import { getChatList, createNewChat } from '$lib/apis/chats';
    import { models, settings } from '$lib/stores';

    onMount(async () => {
        if (!$user) {
            goto('/auth');
            return;
        }

        const userType = await getUserType($user);
        
        // For interviewees, use workflow state (don't show chat interface)
        if (userType === 'interviewee') {
            const assignmentCompleted = localStorage.getItem('assignmentCompleted') === 'true';
            if (assignmentCompleted) {
                goto('/completion');
                return;
            }
            
            // Get workflow state from backend
            try {
                const workflowState = await getWorkflowState(localStorage.token);
                goto(workflowState.next_route || '/assignment-instructions');
            } catch (error) {
                goto('/assignment-instructions');
            }
            return;
        }
        
        // For all other users (parent, child, admin), show chat interface
        // Try to get the most recent chat, or create a new one
        try {
            const chatList = await getChatList(localStorage.token, 1);
            
            if (chatList && chatList.length > 0) {
                // Navigate to the most recent chat
                goto(`/c/${chatList[0].id}`);
            } else {
                // If no chats exist and we have models, create a new one
                if ($models && $models.length > 0) {
                    const selectedModels = [$models[0].id];
                    const newChat = await createNewChat(
                        localStorage.token,
                        {
                            id: `temp-${Date.now()}`,
                            title: 'New Chat',
                            models: selectedModels,
                            system: $settings?.system ?? undefined,
                            params: {},
                            history: { currentId: null, messages: [] },
                            messages: [],
                            tags: [],
                            timestamp: Date.now()
                        },
                        null
                    );
                    
                    if (newChat && newChat.id) {
                        goto(`/c/${newChat.id}`);
                    } else {
                        // Fallback: show parent route for parent users, or root for others
                        if (userType === 'parent') {
                            goto('/parent');
                        } else {
                            // For child/admin, try parent route as fallback
                            goto('/parent');
                        }
                    }
                } else {
                    // No models available, use type-specific routes
                    if (userType === 'parent') {
                        goto('/parent');
                    } else if (userType === 'admin') {
                        goto('/admin/users');
                    } else {
                        goto('/parent');
                    }
                }
            }
        } catch (error) {
            console.error('Error navigating to chat:', error);
            // Fallback based on user type
            if (userType === 'parent') {
                goto('/parent');
            } else if (userType === 'admin') {
                goto('/admin/users');
            } else {
                goto('/parent');
            }
        }
    });

</script>

