---
name: survey-sidebar
description: Survey sidebar navigation and workflow step gating — use when working on sidebar visibility, step access control, progress indicators, or workflow state integration.
tools: Read, Grep, Glob
model: sonnet
---

## Key Files

- `src/lib/components/layout/SurveySidebar.svelte` — Sidebar UI; fetches workflow state, renders 5 step buttons (0–4) with progress indicators, listens for `workflow-updated` events.
- `src/lib/utils/workflow.ts` — Pure logic: `canAccessStep()`, `isStepCompleted()`, `getStepRoute()`, `getStepFromRoute()`, `getStepLabel()`.
- `src/lib/apis/workflow/index.ts` — API client: `getWorkflowState(token)` returns `WorkflowStateResponse` with `next_route` and `progress_by_section`.
- `backend/open_webui/routers/workflow.py` — `GET /workflow/state` endpoint; computes `next_route` and `progress_by_section` from DB (single source of truth).
- `src/routes/(app)/+layout.svelte` — `enforceWorkflowNavigation()` (line ~321) redirects users away from steps they haven't unlocked; uses same `getWorkflowState` API.

## How It Works

1. On mount and on every route change, `SurveySidebar` calls `getWorkflowState(token)` to fetch the backend-computed workflow state.
2. It also listens for the `workflow-updated` DOM event (dispatched by pages after state-changing actions like submitting a form or clicking "Done").
3. For each of the 5 steps, `getStepInfo()` calls `canAccessStep()` and `isStepCompleted()` from `workflow.ts` to determine clickability and visual state.
4. `canAccessStep()` uses `next_route` and `progress_by_section` fields. Step 4 (Completion) always falls through to an explicit all-conditions check — it is excluded from the generic `next_route` and `isCompleted` early returns.
5. Visual indicators: green circle = completed, blue = current, yellow = moderation in progress, gray = locked.
6. `enforceWorkflowNavigation()` in the layout provides server-side gating — if a user navigates directly to a locked step, they are redirected to `next_route`.

## Important Rules

- Step 4 (Completion) must never short-circuit through the `next_route` match or `isCompleted` early returns in `canAccessStep()` — it always requires all four flags: `instructions_completed`, `has_child_profile`, `moderation_finalized`, `exit_survey_completed`.
- Backend `next_route` stays at `/moderation-scenario` until `moderation_finalized` is true, even if all individual scenario decisions exist.
- `moderation_finalized` is stored in the `workflow_draft` table (key `"moderation"`, field `moderation_finalized`), not derived from session counts.
- Step 1 (Child Profile) is intentionally non-clickable while on the instructions page (`onInstructionsPage` guard in sidebar template).
- All step access changes must be mirrored between `canAccessStep()` (sidebar) and `enforceWorkflowNavigation()` (layout redirect) to stay consistent.
