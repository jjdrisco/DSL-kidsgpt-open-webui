# Parent-Child Chat Navigation Unification

**Status**: Planned (not yet implemented)  
**Created**: 2026-02-15

## Problem

Parents and children use different chat routes and UIs:

- **Parent at `/`** → Renders `Chat.svelte` (adult chat), Sidebar links to `/` and `/c/[id]`
- **Child at `/kids/chat`** → Renders `ChildChat.svelte` (kids UI), Sidebar links to `/kids/chat` and `/kids/chat/[id]`

Parents never see the ChildChat UI or /kids/chat routes, so they cannot preview what their child will experience.

## Solution

Route parents to `/kids/chat` and ChildChat, and use `/kids/chat` paths for parent navigation throughout the app, so parents see the same UI and URLs as their selected child.

## Key Files

| File | Purpose |
|------|---------|
| `src/routes/(app)/+page.svelte` | Root route – parents currently see Chat; change to redirect to /kids/chat |
| `src/lib/components/layout/Sidebar.svelte` | `getMainChatPath` / `getChatPath` – extend to parent |
| `src/lib/components/layout/Sidebar/ChatItem.svelte` | Hardcoded `href="/c/{id}"` – must use /kids/chat/[id] for parent/child |
| `src/routes/(app)/c/[id]/+page.svelte` | Add parent redirect to /kids/chat/[id] |
| `src/lib/components/chat/ChildChat.svelte` | Update mainPath/chatPath for parent |
| `src/routes/(app)/kids/profile/preview/+page.svelte` | "Choose and Next Step" – change to navigate to /kids/chat |

## Implementation Steps

### 1. Root route: redirect parents to /kids/chat

For `userType === 'parent'` with profiles, replace `showChat = true` with:

```javascript
goto('/kids/chat');
return;
```

### 2. Sidebar: use /kids/chat paths for parents

```javascript
const getMainChatPath = () =>
  ($user?.role === 'child' || $user?.role === 'parent') ? '/kids/chat' : '/';
const getChatPath = (id: string) =>
  ($user?.role === 'child' || $user?.role === 'parent') ? `/kids/chat/${id}` : `/c/${id}`;
```

### 3. ChatItem: role-aware href

```svelte
href={($user?.role === 'child' || $user?.role === 'parent') ? `/kids/chat/${id}` : `/c/${id}`}
```

### 4. /c/[id] route: redirect parents

```javascript
if (userType === 'child' || userType === 'parent') {
  goto(`/kids/chat/${$page.params.id}`);
  return;
}
```

### 5. ChildChat: use /kids/chat for parents

Update all `mainPath` and `chatPath` logic to treat parent like child:

- `mainPath = ($user?.role === 'child' || $user?.role === 'parent') ? '/kids/chat' : '/'`
- `chatPath = ($user?.role === 'child' || $user?.role === 'parent') ? /kids/chat/${id} : /c/${id}`

### 6. kids/profile/preview: navigate to /kids/chat

Change "Choose and Next Step" from `window.location.href = '/'` to `window.location.href = '/kids/chat'`.

### 7. Layout shortcut (optional)

For `NEW_TEMPORARY_CHAT`, consider `goto($user?.role === 'parent' ? '/kids/chat' : '/')`.

## Out of Scope (follow-up)

- SearchModal, ChatsModal, Placeholder/ChatList: role-aware links
- Notes visibility on /kids/chat
