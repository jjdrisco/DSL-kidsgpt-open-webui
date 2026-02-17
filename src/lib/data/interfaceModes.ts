/**
 * Interface Mode Definitions and Piaget-Aligned Age Groups
 * 
 * This module defines HOW children can interact with the chat interface
 * (voice, text, photo, buttons) separate from WHAT content features they can access.
 * 
 * Based on Piaget's stages of cognitive development.
 */

export interface InterfaceMode {
	id: 'voice_input' | 'text_input' | 'photo_upload' | 'prompt_buttons';
	name: string;
	description: string;
	icon: string;
	piagetStages: string[]; // Age group IDs where this mode is available
	recommendedFor: string[]; // Age group IDs where this is recommended
	autoSelectFor: string[]; // Age groups where this is auto-selected
}

export interface PiagetStage {
	id: '6-8' | '9-12' | '13-15' | '16-18';
	label: string;
	cognitiveLevel: 'preoperational' | 'concrete_operational' | 'formal_operational';
	minAge: number;
	maxAge: number;
	description: string;
}

// Piaget-Aligned Age Groups
export const PIAGET_STAGES: PiagetStage[] = [
	{
		id: '6-8',
		label: 'Ages 6-8',
		cognitiveLevel: 'preoperational',
		minAge: 6,
		maxAge: 8,
		description:
			'Preoperational stage: Magical thinking, egocentric, literal, limited writing skills'
	},
	{
		id: '9-12',
		label: 'Ages 9-12',
		cognitiveLevel: 'concrete_operational',
		minAge: 9,
		maxAge: 12,
		description:
			'Concrete operational stage: Logical about concrete situations, rule-based reasoning, developing writing fluency'
	},
	{
		id: '13-15',
		label: 'Ages 13-15',
		cognitiveLevel: 'formal_operational',
		minAge: 13,
		maxAge: 15,
		description:
			'Early formal operational stage: Beginning abstract reasoning, can consider counterfactuals, more independence'
	},
	{
		id: '16-18',
		label: 'Ages 16-18',
		cognitiveLevel: 'formal_operational',
		minAge: 16,
		maxAge: 18,
		description:
			'Formal operational stage: Abstract/hypothetical reasoning, metacognition, adult-like interaction'
	}
];

// Interface Mode Definitions
export const INTERFACE_MODES: InterfaceMode[] = [
	{
		id: 'voice_input',
		name: 'Voice Input',
		description: 'Speak your questions using your microphone',
		icon: '🎤',
		piagetStages: ['6-8', '9-12', '13-15', '16-18'],
		recommendedFor: ['6-8', '9-12', '13-15', '16-18'],
		autoSelectFor: ['6-8', '9-12', '13-15', '16-18'] // All age groups
	},
	{
		id: 'text_input',
		name: 'Text Input',
		description: 'Type your questions in a text box',
		icon: '⌨️',
		piagetStages: ['6-8', '9-12', '13-15', '16-18'], // Available for all ages; starred only for 9-12, 13-15, 16-18
		recommendedFor: ['9-12', '13-15', '16-18'],
		autoSelectFor: ['9-12', '13-15', '16-18']
	},
	{
		id: 'photo_upload',
		name: 'Photo Upload',
		description: 'Take a picture or upload a photo of your assignment',
		icon: '📷',
		piagetStages: ['6-8', '9-12', '13-15', '16-18'], // Available for all; auto-select 13-15+ only
		recommendedFor: ['13-15', '16-18'],
		autoSelectFor: ['13-15', '16-18'] // Not auto-selected for 9-12; least-to-most progression
	},
	{
		id: 'prompt_buttons',
		name: 'Prompt Buttons',
		description: 'Choose from suggested questions and prompts',
		icon: '🔘',
		piagetStages: ['6-8', '9-12', '13-15', '16-18'],
		recommendedFor: ['6-8', '9-12', '13-15', '16-18'],
		autoSelectFor: ['6-8', '9-12', '13-15', '16-18'] // Including 15-17 (13-15, 16-18)
	}
];

/**
 * Get Piaget stage for a specific age
 */
export function getPiagetStageForAge(age: number): PiagetStage | null {
	return (
		PIAGET_STAGES.find((stage) => age >= stage.minAge && age <= stage.maxAge) || null
	);
}

/**
 * Get available interface modes for a specific age
 */
export function getAvailableModesForAge(age: number): InterfaceMode[] {
	const stage = getPiagetStageForAge(age);
	if (!stage) return [];

	return INTERFACE_MODES.filter((mode) => mode.piagetStages.includes(stage.id));
}

/**
 * Get recommended interface modes for a specific age
 */
export function getRecommendedModesForAge(age: number): InterfaceMode[] {
	const stage = getPiagetStageForAge(age);
	if (!stage) return [];

	return INTERFACE_MODES.filter((mode) => mode.recommendedFor.includes(stage.id));
}

/**
 * Get auto-selected modes for a specific age
 */
export function getAutoSelectedModesForAge(age: number): string[] {
	const stage = getPiagetStageForAge(age);
	if (!stage) return [];

	return INTERFACE_MODES.filter((mode) => mode.autoSelectFor.includes(stage.id)).map(
		(mode) => mode.id
	);
}

/**
 * Get age group ID from age string (e.g., "9 years old" -> "9-12")
 */
export function getAgeGroupFromString(ageString: string): string | null {
	const ageMatch = ageString.match(/(\d+)/);
	if (!ageMatch) return null;

	const age = parseInt(ageMatch[1]);
	const stage = getPiagetStageForAge(age);
	return stage?.id || null;
}

/**
 * Validate that selected modes are appropriate for the child's age
 */
export function validateModesForAge(
	selectedModeIds: string[],
	age: number
): { valid: boolean; invalidModes: string[] } {
	const availableModes = getAvailableModesForAge(age);
	const availableModeIds = availableModes.map((m) => m.id);

	const invalidModes = selectedModeIds.filter((id) => !availableModeIds.includes(id));

	return {
		valid: invalidModes.length === 0,
		invalidModes
	};
}

/**
 * Get interface mode by ID
 */
export function getModeById(modeId: string): InterfaceMode | undefined {
	return INTERFACE_MODES.find((mode) => mode.id === modeId);
}
