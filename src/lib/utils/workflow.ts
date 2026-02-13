import type { WorkflowStateResponse } from '$lib/apis/workflow/index';

/**
 * Get the route for a workflow step
 */
export function getStepRoute(step: number): string {
	switch (step) {
		case 1:
			return '/kids/profile';
		case 2:
			return '/moderation-scenario';
		case 3:
			return '/exit-survey';
		case 4:
			return '/completion';
		default:
			return '/assignment-instructions';
	}
}

/**
 * Get step number from route
 */
export function getStepFromRoute(route: string): number {
	if (route.startsWith('/kids/profile')) return 1;
	if (route.startsWith('/moderation-scenario')) return 2;
	if (route.startsWith('/exit-survey')) return 3;
	if (route.startsWith('/completion')) return 4;
	return 0;
}

/**
 * Determine if a step is accessible based on workflow state
 * Uses the backend workflow state response structure
 */
export function canAccessStep(
	step: number,
	workflowState: WorkflowStateResponse
): boolean {
	const { progress_by_section, next_route } = workflowState;

	// Step 1: Child Profile - accessible if instructions completed or already has profile
	if (step === 1) {
		// Check if next_route indicates step 1 is available or already completed
		return (
			next_route === '/kids/profile' ||
			progress_by_section.has_child_profile ||
			next_route === '/moderation-scenario' ||
			next_route === '/exit-survey' ||
			next_route === '/completion'
		);
	}

	// Step 2: Moderation - accessible if child profile completed
	if (step === 2) {
		return (
			progress_by_section.has_child_profile &&
			(next_route === '/moderation-scenario' ||
				progress_by_section.moderation_completed_count >= progress_by_section.moderation_total ||
				next_route === '/exit-survey' ||
				next_route === '/completion')
		);
	}

	// Step 3: Exit Survey - accessible if moderation completed
	if (step === 3) {
		return (
			progress_by_section.moderation_completed_count >= progress_by_section.moderation_total &&
			(next_route === '/exit-survey' || next_route === '/completion' || progress_by_section.exit_survey_completed)
		);
	}

	// Step 4: Completion - accessible if exit survey completed
	if (step === 4) {
		return progress_by_section.exit_survey_completed || next_route === '/completion';
	}

	return false;
}

/**
 * Get step label for display
 */
export function getStepLabel(step: number): string {
	switch (step) {
		case 1:
			return 'Child Profile';
		case 2:
			return 'Moderation';
		case 3:
			return 'Exit Survey';
		case 4:
			return 'Completion';
		default:
			return 'Unknown';
	}
}

/**
 * Check if a step is completed based on workflow state
 */
export function isStepCompleted(step: number, workflowState: WorkflowStateResponse): boolean {
	const { progress_by_section } = workflowState;

	if (step === 1) {
		return progress_by_section.has_child_profile;
	}
	if (step === 2) {
		return (
			progress_by_section.moderation_completed_count >= progress_by_section.moderation_total
		);
	}
	if (step === 3) {
		return progress_by_section.exit_survey_completed;
	}
	if (step === 4) {
		return progress_by_section.exit_survey_completed;
	}
	return false;
}
