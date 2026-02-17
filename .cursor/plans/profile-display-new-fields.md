# Plan: Add Interface Modes and Features to Profile Information Display

## Overview

Add the new fields `selected_interface_modes` and `selected_features` to the read-only Profile Information display in ChildProfileForm. Parents should see what interface modes and content features they configured when viewing a child's profile (before clicking Edit).

## Current State

**Profile Information section** (read-only, lines ~708-790 in ChildProfileForm.svelte) displays:
- Name
- Age
- Gender
- Characteristics & Interests (if showPersonalityTraits)
- Research fields (if showResearchFields): Only Child, Child Has Used AI Tools, Contexts of AI Use, Parent LLM Monitoring Level

**Missing from display:**
- Selected Interface Modes (e.g., Voice Input, Text Input, Photo Upload, Prompt Buttons)
- Selected Features (e.g., School Assignment)

## Implementation Plan

### 1. Add Helper Functions for Display Labels

**File:** [`src/lib/components/profile/ChildProfileForm.svelte`](src/lib/components/profile/ChildProfileForm.svelte)

Add helper functions to map IDs to human-readable labels:

```typescript
// Import at top
import { CHILD_FEATURES } from '$lib/data/childFeatures';
import { INTERFACE_MODES } from '$lib/data/interfaceModes';

function getFeatureDisplayNames(ids: string[] | undefined): string {
  if (!ids || ids.length === 0) return 'Not specified';
  return ids
    .map((id) => CHILD_FEATURES.find((f) => f.id === id)?.name ?? id)
    .join(', ');
}

function getInterfaceModeDisplayNames(ids: string[] | undefined): string {
  if (!ids || ids.length === 0) return 'Not specified';
  return ids
    .map((id) => INTERFACE_MODES.find((m) => m.id === id)?.name ?? id)
    .join(', ');
}
```

### 2. Add Interface Modes Display Block

**Location:** Inside the Profile Information `div.space-y-4` block, after Gender and before Characteristics & Interests.

```svelte
<div>
  <div class="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
    Interface Modes
  </div>
  <p class="text-gray-900 dark:text-white">
    {getInterfaceModeDisplayNames(childProfiles[selectedChildIndex]?.selected_interface_modes)}
  </p>
</div>

<div>
  <div class="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
    Content Features
  </div>
  <p class="text-gray-900 dark:text-white">
    {getFeatureDisplayNames(childProfiles[selectedChildIndex]?.selected_features)}
  </p>
</div>
```

### 3. Optional: Rich Display with Icons

For a richer display (optional enhancement), show each mode/feature as a pill or badge with icon:

```svelte
<!-- Interface Modes - with icons -->
<div>
  <div class="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
    Interface Modes
  </div>
  <div class="flex flex-wrap gap-2">
    {#each (childProfiles[selectedChildIndex]?.selected_interface_modes ?? []) as modeId}
      {@const mode = INTERFACE_MODES.find((m) => m.id === modeId)}
      {#if mode}
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 text-sm">
          <span>{mode.icon}</span>
          <span>{mode.name}</span>
        </span>
      {/if}
    {/each}
    {#if !childProfiles[selectedChildIndex]?.selected_interface_modes?.length}
      <span class="text-gray-500 dark:text-gray-400">Not specified</span>
    {/if}
  </div>
</div>

<!-- Content Features - with icons -->
<div>
  <div class="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
    Content Features
  </div>
  <div class="flex flex-wrap gap-2">
    {#each (childProfiles[selectedChildIndex]?.selected_features ?? []) as featureId}
      {@const feature = CHILD_FEATURES.find((f) => f.id === featureId)}
      {#if feature}
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200 text-sm">
          <span>{feature.icon ?? '📋'}</span>
          <span>{feature.name}</span>
        </span>
      {/if}
    {/each}
    {#if !childProfiles[selectedChildIndex]?.selected_features?.length}
      <span class="text-gray-500 dark:text-gray-400">Not specified</span>
    {/if}
  </div>
</div>
```

### 4. Placement in Layout

Insert the two new blocks between **Gender** and **Characteristics & Interests**:

```
1. Name
2. Age
3. Gender
4. Interface Modes      <-- NEW
5. Content Features     <-- NEW
6. Characteristics & Interests (conditional)
7. Research fields (conditional)
```

### 5. Handle Legacy Profiles

Profiles created before these fields existed may have `selected_interface_modes` and `selected_features` as `undefined` or `null`. The helpers and template should handle this:
- `ids ?? []` or `ids || []` for safe iteration
- Display "Not specified" when empty

## Files to Modify

1. **ChildProfileForm.svelte**
   - Add imports for CHILD_FEATURES and INTERFACE_MODES
   - Add helper functions (or use inline logic)
   - Add two new display blocks in the Profile Information section

## Testing Checklist

- [ ] Profile with interface modes and features displays them correctly in read-only view
- [ ] Profile with no modes/features (legacy) shows "Not specified"
- [ ] Profile with partial data handles missing arrays gracefully
- [ ] Display order matches layout plan (after Gender, before Characteristics)
- [ ] Dark mode styling works for new elements
- [ ] Labels "Interface Modes" and "Content Features" are clear to parents
