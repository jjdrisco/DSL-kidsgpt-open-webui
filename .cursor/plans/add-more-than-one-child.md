# Plan: Add "Add Another Child" Functionality

## Overview

Restore the ability for parents to add more than one child in the ChildProfileForm. The form already has multi-child support (child selection grid, delete, switching between profiles) but there is no visible "Add Child" button when one or more children already exist. Parents with an existing child cannot add another without this entry point.

## Current State

**What exists:**
- `ChildProfileForm` has `childProfiles` array and multi-child selection grid
- `getChildGridTemplate()` reserves `(childProfiles.length + 1)` columns (suggesting space for an add slot)
- Child selection buttons show each profile; delete button on hover
- `saveChildProfile` already handles creating new profiles when `selectedChildIndex === -1` or `childProfiles.length === 0`
- `cancelAddProfile` returns from add-form to selection when `childProfiles.length > 0`

**What's missing:**
- No visible "Add Child" or "+" button when `childProfiles.length > 0`
- No way to trigger `showForm = true`, `isEditing = true`, `selectedChildIndex = -1` (add-new mode) from the UI

## Implementation Plan

### 1. Add "Add Child" Button to Child Selection Section

**File:** [`src/lib/components/profile/ChildProfileForm.svelte`](src/lib/components/profile/ChildProfileForm.svelte)

**Location:** Inside the child selection grid div, after the `{#each childProfiles as c, i}` block. Use the extra column already reserved by `getChildGridTemplate()`.

Add a function to start adding a new child:

```typescript
function startAddChild() {
	selectedChildIndex = -1;
	childName = '';
	childAge = '';
	childGender = '';
	childCharacteristics = '';
	childEmail = '';
	selectedFeatures = [];
	selectedInterfaceModes = [];
	selectedSubCharacteristics = [];
	// Reset research fields if showResearchFields
	isEditing = true;
	showForm = true;
}
```

Add an "Add Child" button/card in the grid:

```svelte
<!-- After the {#each} block, inside the same grid -->
<button
	type="button"
	class="flex flex-col items-center justify-center w-full min-h-[80px] px-6 py-4 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200"
	on:click={startAddChild}
	title="Add another child"
>
	<svg class="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
	</svg>
	<span class="text-sm font-medium">Add Child</span>
</button>
```

### 2. Placement Options

**Option A: In the grid (recommended)**  
Add the button as the last item in the grid. The grid template already uses `childProfiles.length + 1` columns, so there is space. The button would appear as an extra "card" next to existing child buttons.

**Option B: Below the grid**  
Add a separate "Add another child" button below the child selection grid, e.g. next to or under "Select Your Profile".

**Option C: In the profile header**  
When viewing a profile (read-only), add "Add Child" next to the "Edit" button. Less discoverable when the grid is shown.

**Recommendation:** Option A keeps the flow consistent and uses the existing grid layout.

### 3. Scope: Parent vs Survey Workflow

**Parent add-child flow** (`/parent`, `/parent/child-profile`): Enable "Add Child" so parents can add multiple children.

**Survey workflow** (`/kids/profile`): Optional. The survey may target one child. If multiple children are allowed in the survey, enable the button; otherwise add a prop like `allowAddChild: boolean = true` and pass `false` from kids/profile.

### 4. Files to Modify

1. **ChildProfileForm.svelte**
   - Add `startAddChild()` function
   - Add "Add Child" button in the child selection grid
   - Optionally add `allowAddChild` prop (default `true`) if survey workflow should hide it

### 5. Edge Cases

- **Empty profiles:** When `childProfiles.length === 0`, the grid is hidden and the form is shown directly. No change needed.
- **After adding:** When a new child is saved, `childProfiles` is updated, `selectedChildIndex` points to the new child, and `showForm` is set to false. The grid shows the new child. Flow is correct.
- **Cancel:** When adding and user cancels, `cancelAddProfile` runs and returns to the grid with the previously selected child.

### 6. Testing Checklist

- [ ] With one child, "Add Child" button appears in the grid
- [ ] Clicking "Add Child" opens the form with empty fields
- [ ] Saving creates a new child and updates the grid
- [ ] Cancel returns to the grid without creating a child
- [ ] Grid layout remains correct with 2, 3, 4+ children plus Add button
- [ ] Works in both parent flow and (if enabled) survey flow

## Related Code References

- `getChildGridTemplate()`: Uses `(childProfiles?.length || 0) + 1` — the +1 is for the Add slot
- `ensureAtLeastOneChild()`: No-op, allows empty child list
- Comment at line 462: "No profiles: go directly to the child survey form (single child)"
- `docs/PROJECT_CONTINUATION_GUIDE.md`: "Replaced the multi-tab parent dashboard with a single 'Add Child View'"
