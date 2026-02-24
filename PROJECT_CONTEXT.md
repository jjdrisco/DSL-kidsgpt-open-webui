# DSL-kidsgpt-open-webui – Project Context

Context export for continuing work on this project. Updated Feb 2026.

---

## Project Overview

**DSL-kidsgpt-open-webui** is a fork of Open WebUI customized for an academic research study on children and AI. It adds:

- **Survey workflow**: Assignment instructions → Child profile → Moderation scenarios → Exit survey → Completion
- **Child profiles**: Parents describe their child (research-only, not used to customize scenarios)
- **Moderation scenarios**: Parents review AI chat scenarios and make moderation decisions
- **Attention checks**: Built-in validation scenarios in the moderation flow

**Tech stack**: SvelteKit frontend, Python/FastAPI backend (Open WebUI fork).

---

## Survey Workflow (5 Steps)

| Step | Route                      | Description                                                        |
| ---- | -------------------------- | ------------------------------------------------------------------ |
| 0    | `/assignment-instructions` | Study instructions; user must confirm before continuing            |
| 1    | `/kids/profile`            | Parent describes their child (survey data, academic research only) |
| 2    | `/moderation-scenario`     | Review AI chat scenarios and make moderation decisions             |
| 3    | `/exit-survey`             | Final survey / exit questionnaire                                  |
| 4    | `/completion`              | Completion page                                                    |

**Workflow state**: Backend (`GET /api/v1/workflow/state`) is the source of truth. Response includes `next_route` and `progress_by_section` (has_child_profile, moderation_completed_count, moderation_total, exit_survey_completed).

---

## Key Files & Components

### Workflow & Navigation

| File                                             | Purpose                                                                                  |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `src/lib/utils/workflow.ts`                      | `getStepRoute`, `canAccessStep`, `isStepCompleted`, `getStepLabel`                       |
| `src/lib/apis/workflow/index.ts`                 | `getWorkflowState()`, `WorkflowStateResponse` type                                       |
| `src/lib/components/layout/SurveySidebar.svelte` | Sidebar for survey routes; step navigation; listens for `workflow-updated` and `storage` |
| `src/lib/components/layout/Sidebar.svelte`       | Main app sidebar; workflow section for interviewees; same listeners                      |
| `src/routes/(app)/+layout.svelte`                | Uses SurveySidebar on survey routes, main Sidebar elsewhere                              |

### Survey Routes

| Route                      | Component / Page                                                    |
| -------------------------- | ------------------------------------------------------------------- |
| `/assignment-instructions` | Assignment instructions page                                        |
| `/kids/profile`            | Child profile form; "Proceed to next step" → `/moderation-scenario` |
| `/moderation-scenario`     | Moderation scenario review                                          |
| `/exit-survey`             | Exit survey                                                         |
| `/completion`              | Completion page                                                     |

### Child Profile

| File                                                 | Purpose                                                                                             |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/lib/components/profile/ChildProfileForm.svelte` | Child profile form; `isStudyMode` prop gates study-specific fields; survey disclaimer               |
| `src/routes/(app)/kids/profile/+page.svelte`         | Wraps ChildProfileForm with `isStudyMode={true}`; `proceedToNextStep()` goes to moderation-scenario |

#### `isStudyMode` Prop

The `ChildProfileForm` component accepts `isStudyMode` (boolean, default `false`):

- **`true`** (from `/kids/profile`): Shows instructional banner + "How often does this child use the Internet?" question (reversed 8→1 scale, cross-reference attention check)
- **`false`** (from `/parent`, `/parent/child-profile`): Hides study-specific elements

The `child_internet_use_frequency` field (VARCHAR, nullable) is stored on the `child_profile` table (migration `t1u2v3w4x5y6`).

### Admin

| File                                                 | Purpose                                                           |
| ---------------------------------------------------- | ----------------------------------------------------------------- |
| `src/lib/components/admin/Settings.svelte`           | Admin settings; tabs from `allSettings` array; includes Scenarios |
| `src/lib/components/admin/Settings/Scenarios.svelte` | Scenario upload (JSON), attention-check upload, scenario list     |
| `src/routes/(app)/admin/settings/[tab]/+page.svelte` | Dynamic tab route; `/admin/settings/scenarios` works here         |

### Backend (Moderation & Workflow)

| File                                                 | Purpose                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| `backend/open_webui/routers/moderation_scenarios.py` | `POST /admin/scenarios/upload`, scenario CRUD, workflow state |
| `src/lib/apis/moderation/index.ts`                   | `uploadScenariosAdmin`, `listScenariosAdmin`, etc.            |

---

## Survey Route Detection

Survey/workflow routes use **SurveySidebar** (not main Sidebar):

```javascript
// In +layout.svelte and UserMenu.svelte
isSurveyOrWorkflowRoute =
	pathname.startsWith('/exit-survey') ||
	pathname.startsWith('/initial-survey') ||
	pathname.startsWith('/assignment-instructions') ||
	pathname.startsWith('/kids/profile') ||
	pathname.startsWith('/moderation-scenario') ||
	pathname === '/completion';
```

---

## Recent Changes (Latest Sessions)

1. **Cross-reference attention check** – `child_internet_use_frequency` field added (migration `t1u2v3w4x5y6`); reversed 8→1 scale in child profile, forward 1→8 in exit survey.
2. **`isStudyMode` prop** – Gates study-specific UI (instructional banner, internet use question) behind `isStudyMode` prop on `ChildProfileForm`; only `/kids/profile` passes `true`.
3. **Moderation flow simplified** – Now 2-step (Highlight → Assess); steps 3-4 and moderation panel disabled. `childAccomplish`, `assistantDoing`, `wouldShowChild` removed; `would_show_child` column dropped (migration `84b2215f7772`).
4. **Restored Scenarios admin tab** – Lost in refactor; added back to `Settings.svelte`.
5. **Child profile → moderation** – "Proceed to next step" always goes to `/moderation-scenario` (removed `getUserType` branching).
6. **Child profile text** – Disclaimer: "This survey asks you to describe your child. This information will not be used to customize the scenarios you will be shown and will only be used in the context of academic research."
7. **Removed Add Profile button** – Removed from child profile page; removed `addNewProfile` function.
8. **Sidebar workflow refresh** – SurveySidebar and Sidebar listen for `workflow-updated` and `storage` to refetch workflow state.
9. **Exit Survey access** – `canAccessStep(3)` only allows access when `moderation_total > 0` and `moderation_completed_count >= moderation_total` (or exit survey already completed).

---

## Workflow API Contract

```typescript
// GET /api/v1/workflow/state
interface WorkflowStateResponse {
	next_route: string; // e.g. '/kids/profile', '/moderation-scenario'
	substep: string | null;
	progress_by_section: {
		has_child_profile: boolean;
		moderation_completed_count: number;
		moderation_total: number;
		exit_survey_completed: boolean;
	};
}
```

---

## How to Run

```bash
# Backend (port 8080)
# IMPORTANT: Must run from backend directory so Python finds open_webui package
cd backend
./start.sh
# Or manually:
#   export HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1
#   uvicorn open_webui.main:app --host 0.0.0.0 --port 8080 --forwarded-allow-ips '*'

# Frontend (port 5173)
# From project root:
npm run dev
```

**Common error**: `ModuleNotFoundError: No module named 'open_webui'` happens when uvicorn is run from the project root. Always `cd backend` first (or use `./backend/start.sh`).

---

## Git & Branch

- **Main development branch**: `dev`
- **Current feature branch**: `feature/whitelist-enforcement`
- **Remote**: https://github.com/jjdrisco/DSL-kidsgpt-open-webui

---

## Useful Locations

- **Scenario JSON format**: `child_llm_scenarios.json` (sample), `docs/SCENARIO_SYSTEM.md`
- **Workflow rules**: `src/lib/utils/workflow.ts` – `canAccessStep`, `isStepCompleted`
- **Event for sidebar refresh**: `window.dispatchEvent(new Event('workflow-updated'))` + `storage`
- **User types**: `getUserType()` (interviewee, parent, child) – used for main Sidebar workflow visibility

---

## Things to Watch

1. **Backend timing** – Sidebar refetches on events; backend must persist state before user proceeds.
2. **`moderation_total === 0`** – Exit Survey is blocked until at least one scenario is assigned and completed.
3. **Scenarios admin** – Accessible at `/admin/settings/scenarios`; requires admin role.
