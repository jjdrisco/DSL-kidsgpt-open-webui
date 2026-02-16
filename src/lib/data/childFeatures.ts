/**
 * Child Feature Definitions and Age-Based Recommendations
 * 
 * This module defines available features for children based on age groups,
 * with recommendations for parents during onboarding.
 */

export interface ChildFeature {
	id: string;
	name: string;
	description: string;
	icon?: string;
	ageGroups: AgeGroup[];
	recommendedFor: string[]; // Age group IDs where this is recommended
	capabilities: FeatureCapability[];
}

export interface AgeGroup {
	id: string;
	minAge: number;
	maxAge: number;
	label: string;
	piagetStage?: 'preoperational' | 'concrete_operational' | 'formal_operational';
}

export interface FeatureCapability {
	id: string;
	name: string;
	description: string;
	enabled: boolean;
}

// Age Groups (Piaget-Aligned)
export const AGE_GROUPS: AgeGroup[] = [
	{ id: '6-8', minAge: 6, maxAge: 8, label: 'Ages 6-8', piagetStage: 'preoperational' },
	{ id: '9-12', minAge: 9, maxAge: 12, label: 'Ages 9-12', piagetStage: 'concrete_operational' },
	{ id: '13-15', minAge: 13, maxAge: 15, label: 'Ages 13-15', piagetStage: 'formal_operational' },
	{ id: '16-18', minAge: 16, maxAge: 18, label: 'Ages 16-18', piagetStage: 'formal_operational' }
];

// Feature Definitions
export const CHILD_FEATURES: ChildFeature[] = [
	{
		id: 'school_assignment',
		name: 'School Assignment',
		description: 'Take a picture and upload assignments, get help with academic questions',
		icon: '📚',
		ageGroups: [
			{ id: '9-12', minAge: 9, maxAge: 12, label: 'Ages 9-12' },
			{ id: '13-15', minAge: 13, maxAge: 15, label: 'Ages 13-15' },
			{ id: '16-18', minAge: 16, maxAge: 18, label: 'Ages 16-18' }
		],
		recommendedFor: ['9-12', '13-15', '16-18'],
		capabilities: [
			{
				id: 'photo_upload',
				name: 'Photo Upload',
				description: 'Take a picture and upload homework or assignments',
				enabled: true
			},
			{
				id: 'academic_help',
				name: 'Academic Questions',
				description: 'Get help with school assignments and academic questions',
				enabled: true
			}
		]
	}
	// Additional features can be added here as they're developed
];

/**
 * Get recommended features for a specific age
 */
export function getRecommendedFeatures(age: number): ChildFeature[] {
	const ageGroup = AGE_GROUPS.find(
		(group) => age >= group.minAge && age <= group.maxAge
	);
	
	if (!ageGroup) {
		return [];
	}
	
	return CHILD_FEATURES.filter((feature) =>
		feature.recommendedFor.includes(ageGroup.id)
	);
}

/**
 * Get all available features for a specific age (not just recommended)
 */
export function getAvailableFeatures(age: number): ChildFeature[] {
	const ageGroup = AGE_GROUPS.find(
		(group) => age >= group.minAge && age <= group.maxAge
	);
	
	if (!ageGroup) {
		return [];
	}
	
	return CHILD_FEATURES.filter((feature) =>
		feature.ageGroups.some((ag) => ag.id === ageGroup.id)
	);
}

/**
 * Get age group from age string (e.g., "9 years old" -> "9-11")
 */
export function getAgeGroupFromString(ageString: string): string | null {
	const ageMatch = ageString.match(/(\d+)/);
	if (!ageMatch) return null;
	
	const age = parseInt(ageMatch[1]);
	const ageGroup = AGE_GROUPS.find(
		(group) => age >= group.minAge && age <= group.maxAge
	);
	
	return ageGroup?.id || null;
}

/**
 * Validate that selected features are appropriate for the child's age
 */
export function validateFeaturesForAge(
	selectedFeatureIds: string[],
	age: number
): { valid: boolean; invalidFeatures: string[] } {
	const availableFeatures = getAvailableFeatures(age);
	const availableFeatureIds = availableFeatures.map((f) => f.id);
	
	const invalidFeatures = selectedFeatureIds.filter(
		(id) => !availableFeatureIds.includes(id)
	);
	
	return {
		valid: invalidFeatures.length === 0,
		invalidFeatures
	};
}
