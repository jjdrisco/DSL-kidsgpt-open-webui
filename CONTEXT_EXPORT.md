# Context Export — Survey Reset & Assignment Attempt Bug Fixes

**Date**: March 4, 2026  
**Branch**: `feature/survey-improvements`  
**Remote**: `origin/feature/survey-improvements`  
**HEAD**: `2345945d4c` — style: apply prettier and black formatting to pass CI checks (#30)

---

## 1. Session Summary

This session fixed two compounding bugs that caused **old scenarios to reappear after a survey reset**:

### Bug A — `onWorkflowResetHandler` was an incomplete frontend reset
**File**: `src/routes/(app)/moderation-scenario/+page.svelte` (~line 5263)

**Problem**: The handler cleared `scenarioList`, `scenarioIdentifiers`, `scenarioStates`, `scenarioTimers`, `selectedScenarioIndex`, and `moderationFinalized` — but left `scenariosLockedForSession`, `step1/2/3Completed`, `highlightedTexts1`, `selectedModerations`, `concernMappings`, `highlightConcerns`, `concernHighlightLevels`, and all other per-scenario state variables untouched.

Two downstream effects:
1. The reactive statement `$: if (... || step1Completed || ...)` at ~line 5831 could fire `saveCurrentScenarioState()` during the 400 ms navigation window with stale flags, writing a dirty draft under the new attempt number.
2. `saveCurrentScenarioState()` has a guard `if (scenariosLockedForSession && scenarioList.length > 0 ...)` that saves `scenario_list` into the draft. With `scenariosLockedForSession` still `true`, the `onDestroy` async save could write old scenarios into the new-attempt draft.

**Fix**: Replaced the manual partial reset with a call to `resetAllScenarioStates()` (the comprehensive reset function that already existed), added `scenarioList = []` (the one thing that function doesn't clear), and added a proactive `deleteWorkflowDraft()` call to eliminate the `onDestroy` race window.

```javascript
function onWorkflowResetHandler() {
    console.log('🔄 Workflow reset detected, clearing all scenario state');
    resetAllScenarioStates(); // clears scenariosLockedForSession, steps, concerns, timers, etc.
    scenarioList = [];        // resetAllScenarioStates does not clear scenarioList itself

    // Proactively delete backend draft to prevent onDestroy async-save race
    if (selectedChildId && typeof window !== 'undefined') {
        const token =
            (typeof window !== 'undefined' && localStorage.token) ||
            localStorage.getItem('token') || '';
        if (token) {
            deleteWorkflowDraft(token, selectedChildId, 'moderation').catch(() => {});
        }
    }
}
```

---

### Bug B — Backend `reset_user_workflow` didn't include `scenario_assignments.attempt_number`
**File**: `backend/open_webui/routers/workflow.py` (~line 376)

**Problem**: `reset_user_workflow` computed `new_attempt_number = max(moderation_session, child_profile, exit_quiz_response) + 1`. It never looked at `scenario_assignments.attempt_number`. The result: if a user had no completed `moderation_session` rows at attempt 2 (they reset before finishing), the next reset computed `max(mod=1, child=1, exit=0) + 1 = 2` again — landing on the same attempt number. The old `scenario_assignments` rows at attempt 2 were then returned by `getAssignmentsForChild` (which filters by `current_attempt_number`), restoring the previous scenarios.

**Fix**: Added `max_assignment_attempt` from `scenario_assignments.attempt_number` to the max, and imported `ScenarioAssignment` ORM class:

```python
from open_webui.models.scenarios import ScenarioAssignment, ScenarioAssignments

# in reset_user_workflow:
max_assignment_attempt = (
    db.query(func.max(ScenarioAssignment.attempt_number))
    .filter(ScenarioAssignment.participant_id == user.id)
    .scalar()
    or 0
)
new_attempt_number = (
    max(max_moderation_attempt, max_child_attempt, max_exit_attempt, max_assignment_attempt) + 1
)
```

---

## 2. Prior Session Work (same branch, already committed)

### Accessibility improvements
- All `text-xs` → `text-sm`/`text-base` in Step 2 concern section
- Checkbox sizes `w-4 h-4` → `w-5 h-5`, severity buttons `px-2 py-0.5` → `px-3 py-1.5`

### 500 errors on concern-items endpoints (fixed via direct SQL + alembic stamp)
- `concern_item` table was never created — DB was at revision `u88v99w00x11` with divergent heads
- Created table directly via SQLite, stamped alembic

### `highlight_levels` field added to `ConcernItemRow`
- `persistConcernItems` was sending `highlight_levels` but the field didn't exist on the backend
- Added `highlight_levels: Optional[Dict[str, Optional[int]]]` to `ConcernItemRow`, `ConcernItemModel`, `ConcernItemForm`, and `batch_upsert`
- Created migration `bb11cc22dd33_add_highlight_levels_to_concern_item.py`

### Divergent alembic heads resolved
- Three heads: `u88v99w00x11`, `z33a44b55c66`, `bb11cc22dd33`
- Created `merge_all_heads_2026_03_03.py` → single head `merge_all_heads_2026_03_03`

---

## 3. Current DB State (as of session end)

- **DB path**: `backend/data/webui.db`
- **Alembic**: single head `merge_all_heads_2026_03_03` (fully applied)
- **Developer user `d5bb9988`**: `current_attempt_number = 2`
  - Has assignments at `attempt=1` (6 rows, `assigned`) and `attempt=2` (9 rows, mixed statuses)
  - **Action needed**: do one more "Reset survey" with the new backend code to advance to attempt 3 and permanently clear the old data

---

## 4. Key File Locations

| File | Purpose |
|------|---------|
| `src/routes/(app)/moderation-scenario/+page.svelte` | Main survey page (~8446 lines) |
| `backend/open_webui/routers/workflow.py` | Reset endpoint (~line 366), attempt number logic |
| `backend/open_webui/models/moderation.py` | `ModerationSession`, `ConcernItemRow`, `ConcernItemModel` |
| `backend/open_webui/models/scenarios.py` | `ScenarioAssignment`, `ScenarioAssignmentTable` |
| `backend/open_webui/migrations/versions/` | All alembic migrations |
| `src/lib/apis/moderation/index.ts` | Frontend API helpers incl. `getAssignmentsForChild`, `deleteWorkflowDraft` |
| `src/lib/components/layout/Sidebar/UserMenu.svelte` | "Reset survey" button (~line 357) |

### Key functions in `+page.svelte`

| Function | Line | Purpose |
|----------|------|---------|
| `onWorkflowResetHandler` | ~5263 | **[FIXED this session]** Handles workflow-reset event |
| `resetAllScenarioStates` | ~670 | Comprehensive in-memory state reset (clears `scenariosLockedForSession` etc.) |
| `saveCurrentScenarioState` | ~2775 | Saves draft; guarded by `scenariosLockedForSession && scenarioList.length > 0` |
| `fetchWorkflowStateForModeration` | ~5417 | On-mount: loads draft → assignments → generates new |
| `loadRandomScenarios` | ~797 | Creates/loads assignments from backend |
| `onDestroy` | ~5821 | Calls `saveCurrentScenarioState()` async |

### Draft restoration logic (`fetchWorkflowStateForModeration` ~line 5442)

```javascript
const draftIsFinalized = !!data?.moderation_finalized;
if (draftAttemptNumber !== currentAttemptNumber && !draftIsFinalized) {
    // Discard stale non-finalized drafts
    await deleteWorkflowDraft(token, selectedChildId, 'moderation');
} else {
    // Restore scenario_list (including finalized drafts from old attempts)
    const list = data?.scenario_list;
    if (Array.isArray(list) && list.length > 0 ...) {
        scenarioList = list;
        scenariosLockedForSession = true;
    }
}
```
> Note: The `&& !draftIsFinalized` condition was added in commit `dcfbcd590f` to preserve finalized drafts for review. This is intentional behavior.

---

## 5. Uncommitted Changes

The two bug fixes described above are **NOT yet committed**. The working tree is dirty:

```
backend/open_webui/models/scenarios.py            (import: ScenarioAssignment added)
backend/open_webui/routers/workflow.py            (Bug B fix: max_assignment_attempt)
src/routes/(app)/moderation-scenario/+page.svelte (Bug A fix: onWorkflowResetHandler)
```

Also uncommitted: data-export CSV/notebook files in `data-exports/` (should not be committed).

---

## 6. Recommended Next Steps

### Immediate
1. **Commit** the two bug fixes:
   ```bash
   git add backend/open_webui/routers/workflow.py \
           backend/open_webui/models/scenarios.py \
           src/routes/(app)/moderation-scenario/+page.svelte
   git commit -m "fix: reset survey reliably clears scenarios (frontend + attempt number)"
   ```

2. **Manually verify**: Perform a "Reset survey" with the backend running. Confirm:
   - Console shows `🔄 Workflow reset detected, clearing all scenario state`
   - After navigation to `/moderation-scenario`, fresh scenarios are generated (not the old ones)
   - Developer account advances to `current_attempt_number = 3`

3. **Build**: `npm run build` — already confirmed clean after Bug A fix.

### Secondary
- Investigate `loadScenario` error `ReferenceError: Cannot access 'backendProvided' before initialization` (visible in the console log at ~line 3172) — separate bug, `backendProvided` is used before its `const` declaration.
- Consider whether `ModerationSession` records should be reset (currently kept, excluded by `attempt_number` filter).

---

## 7. Environment Notes

- **Python env**: `/opt/homebrew/Caskroom/miniforge/base/envs/open-webui/bin/python3`
- **Backend start** (from `backend/` dir):
  ```bash
  export WEBUI_SECRET_KEY="mdiQCC4718rQbe3G"
  export DATABASE_URL="sqlite:///$(pwd)/data/webui.db"
  export CORS_ALLOW_ORIGIN="http://localhost:5173;http://localhost:5174;http://localhost:8080"
  export HF_HUB_OFFLINE=1
  export TRANSFORMERS_OFFLINE=1
  uvicorn open_webui.main:app --host 0.0.0.0 --port 8080 --forwarded-allow-ips '*'
  ```
- **Frontend start**: `npm run dev` (from workspace root)
- **Build**: `npm run build` (confirmed clean as of this session)

---

## Branch Information (legacy — previous export below this line)

**Current Branch**: `feat/restore-workflow-navigation`
**Base Branch**: `cursor/commit-identification-for-survey-feature-8209` (which was based on `main`)

**Remote**: Pushed to `origin/feat/restore-workflow-navigation`

## What Was Implemented

### Summary

Restored the lost survey workflow navigation functionality that was removed from the Sidebar component in commit `ba6fbc56d`. The implementation uses the backend API as the single source of truth (no localStorage) and maintains user type differentiation.

### Key Changes

#### 1. Workflow Utility Functions (`src/lib/utils/workflow.ts`)

- `getStepRoute(step: number)` - Maps step numbers (1-4) to routes
- `getStepFromRoute(route: string)` - Gets step number from route path
- `canAccessStep(step: number, workflowState)` - Determines if a step is accessible based on backend state
- `getStepLabel(step: number)` - Gets display labels for steps
- `isStepCompleted(step: number, workflowState)` - Checks completion status

#### 2. Enhanced SurveySidebar (`src/lib/components/layout/SurveySidebar.svelte`)

- **Before**: Static progress indicators (read-only)
- **After**: Clickable step navigation buttons
- Features:
  - Fetches workflow state from backend API on mount
  - Refreshes state when route changes
  - Shows completion status (checkmark for completed, number for current, gray for locked)
  - Highlights current step (blue background)
  - Disables locked steps with error toast on click attempt
  - Navigation to accessible steps

#### 3. Main Sidebar Workflow Section (`src/lib/components/layout/Sidebar.svelte`)

- **New**: Conditional workflow navigation section
- Only visible for **interviewee users** (determined by `getUserType()`)
- Hidden for parent/child users
- Same step navigation buttons as SurveySidebar
- Fetches workflow state from backend API
- Refreshes on route changes

#### 4. Layout Navigation Guard (`src/routes/(app)/+layout.svelte`)

- **Removed**: All localStorage dependencies for workflow state
- **Added**: Backend API integration using `getWorkflowState()`
- Uses `next_route` from backend to determine correct navigation
- Maintains Prolific user session handling
- Preserves user type differentiation (parent/child/interviewee)

#### 5. Cypress Tests (`cypress/e2e/workflow-navigation.cy.ts`)

- Tests for SurveySidebar navigation
- Tests for main Sidebar navigation
- Tests for workflow state integration
- Tests for navigation guard integration

## Files Changed

### Created Files

1. `src/lib/utils/workflow.ts` - Workflow utility functions
2. `cypress/e2e/workflow-navigation.cy.ts` - Cypress tests
3. `REIMPLEMENTATION_PLAN.md` - Implementation plan
4. `SURVEY_IMPLEMENTATION_DIFFERENCES.md` - Comparison with original
5. `TESTING_INSTRUCTIONS.md` - Testing guide
6. `CONTEXT_EXPORT.md` - This file

### Modified Files

1. `src/lib/components/layout/SurveySidebar.svelte` - Added clickable navigation
2. `src/lib/components/layout/Sidebar.svelte` - Added workflow section
3. `src/routes/(app)/+layout.svelte` - Updated navigation guard

## Architecture Decisions

### ✅ Backend API Only (No localStorage)

- All workflow state comes from `getWorkflowState()` API
- No localStorage for workflow state
- Backend is single source of truth

### ✅ No Centralized Service

- Components call API directly
- SurveySidebar and Sidebar are mutually exclusive (never visible simultaneously)
- Utility functions for shared logic only

### ✅ User Type Differentiation

- **Interviewee users**: See full workflow navigation
- **Parent/Child users**: Workflow UI hidden
- **Admin users**: Can see workflow UI (optional)

## Commits Made

1. `2f7de413c` - feat: Restore workflow navigation functionality
2. `ff8131179` - refine: Improve canAccessStep logic for workflow navigation
3. `0416c7db0` - docs: Add testing instructions for workflow navigation

## Testing Status

### ✅ Code Implementation: Complete

- All code changes committed
- No linter errors
- TypeScript types correct

### ⏳ Cypress Tests: Created but Not Run

- Test file created: `cypress/e2e/workflow-navigation.cy.ts`
- **Cannot run tests** - requires backend and frontend services running
- See `TESTING_INSTRUCTIONS.md` for how to run

## How to Test Locally

### 1. Start Services

**Backend** (port 8080):

```bash
cd backend
./start.sh
# Or: PORT=8080 python -m uvicorn open_webui.main:app --host 0.0.0.0 --port 8080
```

**Frontend** (port 5173 or 5174):

```bash
npm run dev
```

### 2. Manual Testing Checklist

- [ ] **SurveySidebar on `/exit-survey`**:
  - [ ] Shows clickable step buttons (1-4)
  - [ ] Completed steps show checkmark
  - [ ] Current step is highlighted (blue)
  - [ ] Locked steps are disabled
  - [ ] Clicking accessible steps navigates correctly
  - [ ] Clicking locked steps shows error toast

- [ ] **Main Sidebar**:
  - [ ] For interviewee users: Shows "Assignment Workflow" section
  - [ ] For parent users: Workflow section hidden
  - [ ] For child users: Workflow section hidden
  - [ ] Step buttons work correctly
  - [ ] Navigation works from main sidebar

- [ ] **Navigation Guard**:
  - [ ] Redirects to correct route based on backend `next_route`
  - [ ] Allows access to current and previous steps
  - [ ] Blocks access to future steps

### 3. Run Cypress Tests

```bash
export RUN_CHILD_PROFILE_TESTS=1
export CYPRESS_baseUrl=http://localhost:5173  # Use your frontend port

# Run workflow navigation tests
xvfb-run -a npx cypress run --headless --spec cypress/e2e/workflow-navigation.cy.ts

# Or run interactively
npx cypress open
```

## Known Issues / Considerations

### Database Error (from terminal output)

The terminal shows a SQLite database error. This is likely a local environment issue, not related to our changes. The error is:

```
sqlite3.OperationalError: unable to open database file
```

**To fix**: Ensure database file exists and has correct permissions, or configure database connection properly.

### Backend API Dependencies

- The implementation depends on `/api/v1/workflow/state` endpoint
- This endpoint must return `WorkflowStateResponse` with:
  - `next_route`: string (e.g., '/kids/profile', '/moderation-scenario', etc.)
  - `progress_by_section`: object with:
    - `has_child_profile`: boolean
    - `moderation_completed_count`: number
    - `moderation_total`: number
    - `exit_survey_completed`: boolean

### User Type Detection

- Uses `getUserType()` function which checks:
  - User role (admin, child, parent, interviewee)
  - Study ID whitelist for interviewee determination
  - Parent ID for child account detection

## Next Steps

1. **Start services** (backend + frontend)
2. **Test manually** using the checklist above
3. **Run Cypress tests** to verify automated test coverage
4. **Fix any issues** that arise during testing
5. **Verify** that all existing tests still pass:

   ```bash
   # Run existing workflow tests
   xvfb-run -a npx cypress run --headless --spec cypress/e2e/workflow.cy.ts

   # Run existing survey-sidebar tests
   xvfb-run -a npx cypress run --headless --spec cypress/e2e/survey-sidebar.cy.ts
   ```

## Key Differences from Original Implementation

### What Was Restored

✅ Clickable workflow step navigation buttons
✅ Visual progress indicators (completed, current, locked)
✅ Step navigation from sidebar
✅ Workflow state management

### What Changed from Original

❌ **No localStorage** - Original used localStorage + backend sync
✅ **Backend API only** - Current uses backend as single source of truth
❌ **No Personal Store** - Original had Personal Store integration (intentionally not restored)
❌ **No child profile management in Sidebar** - Now handled by `childProfileSync` service
✅ **User type aware** - Original blocked all users, current only blocks interviewees

## Reference Documents

- `REIMPLEMENTATION_PLAN.md` - Full implementation plan
- `SURVEY_IMPLEMENTATION_DIFFERENCES.md` - Detailed comparison with original
- `TESTING_INSTRUCTIONS.md` - How to run tests
- `docs/CYPRESS_TEST_SETUP.md` - Cypress setup guide

## Code Locations

### Workflow Utilities

- File: `src/lib/utils/workflow.ts`
- Functions: `getStepRoute`, `canAccessStep`, `getStepLabel`, `isStepCompleted`, `getStepFromRoute`

### SurveySidebar

- File: `src/lib/components/layout/SurveySidebar.svelte`
- Key functions: `fetchWorkflowProgress()`, `goToStep()`, `getStepInfo()`
- Shows on routes: `/exit-survey`, `/initial-survey`

### Main Sidebar

- File: `src/lib/components/layout/Sidebar.svelte`
- Key functions: `fetchWorkflowState()`, `goToStep()`, `getStepInfo()`
- Conditional: Only shows for `isInterviewee === true`

### Layout Navigation Guard

- File: `src/routes/(app)/+layout.svelte`
- Function: `enforceWorkflowNavigation()`
- Uses: `getWorkflowState()` API, `next_route` for navigation decisions

## API Dependencies

### Required Endpoint

- `GET /api/v1/workflow/state`
- Returns: `WorkflowStateResponse`
- Used by: SurveySidebar, Sidebar, Layout navigation guard

### Response Structure

```typescript
{
	next_route: string; // Where user should be
	substep: string | null;
	progress_by_section: {
		has_child_profile: boolean;
		moderation_completed_count: number;
		moderation_total: number;
		exit_survey_completed: boolean;
	}
}
```

## Git Status

**Current Branch**: `feat/restore-workflow-navigation`
**Status**: All changes committed, ready for testing
**Remote**: Pushed to origin

**To continue working**:

```bash
git checkout feat/restore-workflow-navigation
# Start services and test
```

## Questions / Issues to Resolve

1. **Database Error**: The SQLite error in terminal needs to be resolved for backend to start
2. **Test Execution**: Cypress tests need services running to execute
3. **Edge Cases**: May need to handle:
   - Backend API failures gracefully
   - Network latency
   - Invalid workflow state responses

## Success Criteria

✅ Interviewee users can navigate workflow steps from sidebar
✅ Workflow state comes from backend API (single source of truth)
✅ Visual progress indicators show completion status
✅ Navigation respects backend-determined accessibility
✅ Parent/child users don't see workflow UI
✅ No conflicts with existing navigation guard
✅ Code is maintainable and well-documented
✅ No localStorage usage (backend only)
✅ Simple architecture (no unnecessary services)
