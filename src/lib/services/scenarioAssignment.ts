import { assignScenario, type ScenarioAssignResponse } from '$lib/apis/moderation';
import { WEBUI_API_BASE_URL } from '$lib/constants';

/**
 * Assign scenarios for a child profile in the background.
 * All assignments are stored in the database via the API - no localStorage needed.
 *
 * @param childId - Child profile ID
 * @param participantId - User/participant ID
 * @param sessionNumber - Session number for this assignment
 * @param token - Authentication token
 * @param scenariosPerSession - Number of scenarios to assign (default: 6)
 * @returns Promise with success status, assignment count, and assignments
 */
export async function assignScenariosForChild(
	childId: string,
	participantId: string,
	sessionNumber: number,
	token: string,
	scenariosPerSession: number = 6
): Promise<{ success: boolean; assignmentCount: number; assignments: ScenarioAssignResponse[] }> {
	const assignments: ScenarioAssignResponse[] = [];
	let successCount = 0;

	try {
		for (let i = 0; i < scenariosPerSession; i++) {
			try {
				const response = await assignScenario(token, {
					participant_id: participantId,
					child_profile_id: childId,
					assignment_position: i,
					alpha: 1.0
				});
				assignments.push(response);
				successCount++;
				console.log(
					`✅ Assigned scenario ${i + 1}/${scenariosPerSession} for child ${childId}: ${response.scenario_id}`
				);
			} catch (error) {
				console.error(`❌ Error assigning scenario ${i + 1}/${scenariosPerSession}:`, error);
				// Continue with remaining assignments
			}
		}

		// Assignments are automatically stored in database via assignScenario API
		// No localStorage needed - will be retrieved from backend on scenario page load

		console.log(
			`✅ Completed scenario assignment for child ${childId}: ${successCount}/${scenariosPerSession} successful`
		);

		// select one of the successful assignments at random to receive an attention check code
		if (assignments.length > 0) {
			const winner = assignments[Math.floor(Math.random() * assignments.length)];
			try {
				const res = await fetch(`${WEBUI_API_BASE_URL}/moderation/scenarios/assignments/${winner.assignment_id}/attention-code`, {
					method: 'PATCH',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${token}`
					}
				});
				if (res.ok) {
					const body = await res.json();
					winner.attention_check_code = body.attention_check_code;
					console.log('🔐 Assigned attention code to assignment', winner.assignment_id);
				} else {
					console.warn('Failed to patch attention code', await res.text());
				}
			} catch (err) {
				console.error('Error calling attention-code endpoint', err);
			}
		}

		return {
			success: successCount === scenariosPerSession,
			assignmentCount: successCount,
			assignments
		};
	} catch (error) {
		console.error(`❌ Error in assignScenariosForChild for child ${childId}:`, error);
		return { success: false, assignmentCount: successCount, assignments };
	}
}
