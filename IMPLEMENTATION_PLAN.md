# Child Feature Selection and Interface Design - Implementation Plan

## Overview
This document outlines the implementation plan for allowing parents to select features for their children based on age groups, with recommendations, and implementing a child-friendly chat interface.

## Completed Components

### 1. Feature Definitions System (`src/lib/data/childFeatures.ts`)
- ✅ Created age group definitions (9-11, 12-14, 15-17, 18+)
- ✅ Created feature definitions with capabilities
- ✅ Implemented "School Assignment" feature for ages 9-11 with:
  - Photo upload capability
  - Academic questions capability
- ✅ Added helper functions for:
  - Getting recommended features by age
  - Getting available features by age
  - Validating features for age appropriateness

### 2. Feature Selection UI (`src/lib/components/profile/FeatureSelection.svelte`)
- ✅ Created interactive feature selection component
- ✅ Shows recommended features with star indicators
- ✅ Displays feature capabilities
- ✅ Validates feature selection based on age
- ✅ Visual feedback for selected features

### 3. Integration with Child Profile Form
- ✅ Added `selected_features` field to `ChildProfile` and `ChildProfileForm` interfaces
- ✅ Integrated feature selection into onboarding flow
- ✅ Added validation to require at least one feature
- ✅ Persists selected features to backend

## Remaining Implementation Tasks

### 4. School Assignment Feature Implementation
**Location**: New component or modification to chat interface
**Requirements**:
- Photo upload interface (camera or file picker)
- Academic question handling
- Restrict to school assignment context only
- Age-appropriate UI with visual cues

**Files to create/modify**:
- `src/lib/components/chat/ChildChatInterface.svelte` (new)
- `src/lib/components/chat/SchoolAssignmentFeature.svelte` (new)
- Modify `src/lib/components/chat/Chat.svelte` to detect child user and show child interface

### 5. Child-Friendly Chat Interface
**Requirements**:
- Scaffolded input (not blank text box)
- Visual cues and prompts
- Buttons for common actions
- Reminder that AI is not human
- Age-appropriate tone and diction
- Error prevention (stop if AI is unsure)

**Key Design Principles**:
- **Cognitive Load**: Avoid overwhelming children with blank pages
- **Visual Scaffolding**: Use buttons, prompts, and visual cues
- **Error Prevention**: Stop interaction if AI expresses uncertainty
- **Transparency**: Always remind child that AI is not human

**Files to create/modify**:
- `src/lib/components/chat/ChildMessageInput.svelte` (new)
- `src/lib/components/chat/ChildChatPlaceholder.svelte` (new)
- Modify `src/lib/components/chat/Chat.svelte` to conditionally render child interface

### 6. Parent Preview of Child Chat
**Requirements**:
- Parent can view child's chat interface as preview
- Shows what features are enabled
- Shows how the interface looks to the child

**Files to create/modify**:
- `src/routes/(app)/parent/child-preview/+page.svelte` (new)
- Or add preview mode to existing parent pages

### 7. Feature Enforcement
**Requirements**:
- Check child's selected features before allowing actions
- Only allow features that parent selected
- Show appropriate error messages if feature not enabled

**Files to modify**:
- `src/lib/components/chat/Chat.svelte` - Add feature checks
- `src/lib/utils/childUtils.ts` - Add feature checking utilities

## Implementation Steps

1. ✅ Create feature definitions and data structures
2. ✅ Create feature selection UI component
3. ✅ Integrate feature selection into onboarding
4. ⏳ Create child-friendly chat interface components
5. ⏳ Implement School Assignment feature
6. ⏳ Add feature enforcement logic
7. ⏳ Create parent preview functionality
8. ⏳ Add AI uncertainty detection
9. ⏳ Add "not human" reminders

## Technical Notes

### Data Flow
1. Parent selects features during onboarding → stored in `childProfile.selected_features`
2. When child accesses chat → system checks `selected_features`
3. Only enabled features are shown/accessible
4. Parent can preview child's view

### Age Groups
- **9-11**: School Assignment (photo upload + academic questions)
- **12-14**: (To be added)
- **15-17**: (To be added)
- **18+**: (To be added)

### Feature Structure
```typescript
{
  id: 'school_assignment',
  name: 'School Assignment',
  capabilities: [
    { id: 'photo_upload', name: 'Photo Upload' },
    { id: 'academic_help', name: 'Academic Questions' }
  ]
}
```

## Next Steps

1. Create child-friendly chat interface components
2. Implement School Assignment feature with photo upload
3. Add feature checking utilities
4. Create parent preview page
5. Add AI uncertainty detection
6. Test end-to-end flow
