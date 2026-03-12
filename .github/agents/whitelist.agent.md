---
name: Whitelist
description: Agent for child whitelist enforcement features in this codebase.
---

## Key Files

- `backend/open_webui/utils/middleware.py` — enforcement pipeline inside `process_chat_payload()`. Child block starts around line 1418: profile lookup → system prompt injection → Step-1 rewrite/block call.
- `backend/open_webui/routers/openai.py` — output validation via `validate_response_against_whitelist()`. Guarded by `and not bypass_system_prompt` to avoid running on internal calls.
- `backend/open_webui/models/child_profiles.py` — ORM for `child_profile` table. Key methods: `get_child_profile_by_child_email()`, `get_current_child_profile()`, `update_selected_features()`.
- `backend/open_webui/routers/child_profiles.py` — REST router. `PATCH /child-profiles/{id}/whitelist` accepts `{ whitelist_items: list[str] }`. `GET /child-profiles/my-whitelist` lets a child user fetch their own whitelist (placed before path-param routes to avoid FastAPI shadowing).
- `src/routes/(app)/parent/whitelist-sandbox/+page.svelte` — parent UI to configure child whitelist. Auto-saves with 800ms debounce. Blocked message: "This question falls outside of the topics I can help with — please speak with a trusted adult or parent for help with this one!"
- `src/lib/apis/child-profiles/index.ts` — `updateChildProfileWhitelist()` and `getMyWhitelist()` TS clients.
- `src/lib/components/chat/Placeholder.svelte` — new-chat landing page. `onMount` fetches `getMyWhitelist()` for child users and maps items to suggestion prompts (`"Tell me about {item}"`), overriding model/config defaults.
- `src/lib/components/chat/Navbar.svelte` — chat top bar. Options dropdown, Controls/Knobs button, and Theme toggle are all wrapped in `{#if $user?.role !== 'child'}`.

## How It Works

1. User with `role="child"` sends a message.
2. `middleware.py` looks up their profile (email first, then `is_current` fallback).
3. Step-0: Injects system prompt from `selected_features`; locks model to `gpt-5.2-chat-latest`.
4. Step-1: Internal call to `generate_chat_completion(..., bypass_system_prompt=True)` asks the LLM to rewrite or block the prompt.
5. If blocked, `metadata["child_blocked"] = True` — `main.py` short-circuits and returns the blocked message.
6. If rewritten, the last user message is replaced before the real call proceeds.
7. On the new-chat landing page, `Placeholder.svelte` calls `GET /child-profiles/my-whitelist` in `onMount` and renders whitelist items as suggestion prompts.

## Child Profile Lookup Pattern

Children own no `child_profile` rows — profiles are owned by the parent (`user_id = parent.id`). Always look up via:

```python
profile = ChildProfiles.get_child_profile_by_child_email(user.parent_id, user.email)
if not profile:
    profile = ChildProfiles.get_current_child_profile(user.parent_id)
```

Never query by `user_id == child.id` — it returns nothing.

## Important Rules

- Internal Step-1 calls must use `bypass_system_prompt=True` to skip output validation in `openai.py`.
- Profile lookup uses email first; falls back to `is_current=True` on the parent's profiles.
- `selected_features` is a JSON list stored on the `child_profile` row.
- `/my-whitelist` route must appear before `/child-profiles/{profile_id}` in the router file or FastAPI will treat `my-whitelist` as a profile ID.
- Child users have no `selectedChildId` in the settings store — that is a parent-only concept. Use the `/my-whitelist` endpoint instead of any client-side `childProfileSync` lookup.
