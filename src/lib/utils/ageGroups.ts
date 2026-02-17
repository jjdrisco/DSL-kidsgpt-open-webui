/**
 * Age Group Utilities
 * 
 * Manages conversion between numeric ages and categorical age groups
 * for the UI. Ages are stored as integers in the database (e.g., 6, 9, 13, 16)
 * but displayed as ranges in the UI (e.g., "6-8 years", "9-12 years").
 */

export interface AgeGroup {
	/** Display label for the age group */
	label: string;
	/** Numeric value to store in database (typically the minimum of the range) */
	value: number;
	/** Minimum age in the range (inclusive) */
	min: number;
	/** Maximum age in the range (inclusive) */
	max: number;
}

/**
 * Predefined age groups with their corresponding numeric ranges
 */
export const AGE_GROUPS: AgeGroup[] = [
	{
		label: '6-8 years',
		value: 6,
		min: 6,
		max: 8
	},
	{
		label: '9-12 years',
		value: 9,
		min: 9,
		max: 12
	},
	{
		label: '13-15 years',
		value: 13,
		min: 13,
		max: 15
	},
	{
		label: '16-18 years',
		value: 16,
		min: 16,
		max: 18
	}
];

/**
 * Get the age group definition for a given numeric age value
 * 
 * @param age Numeric age value (e.g., 6, 9, 13, 16)
 * @returns AgeGroup definition or undefined if not found
 */
export function getAgeGroupFromValue(age: number | undefined | null): AgeGroup | undefined {
	if (age === undefined || age === null) return undefined;
	return AGE_GROUPS.find((group) => group.value === age);
}

/**
 * Get the display label for a given numeric age value
 * 
 * @param age Numeric age value (e.g., 6, 9, 13, 16)
 * @returns Display label (e.g., "6-8 years") or undefined if not found
 */
export function getAgeLabel(age: number | undefined | null): string | undefined {
	const group = getAgeGroupFromValue(age);
	return group?.label;
}

/**
 * Get the numeric value to store for a given age group label
 * 
 * @param label Age group label (e.g., "6-8 years")
 * @returns Numeric value to store (e.g., 6) or undefined if not found
 */
export function getAgeValueFromLabel(label: string | undefined | null): number | undefined {
	if (!label) return undefined;
	const group = AGE_GROUPS.find((g) => g.label === label);
	return group?.value;
}

/**
 * Check if a numeric age falls within an age group's range
 * 
 * @param age Numeric age to check
 * @param ageGroup Age group to check against
 * @returns True if age is within the group's min-max range
 */
export function isAgeInGroup(age: number, ageGroup: AgeGroup): boolean {
	return age >= ageGroup.min && age <= ageGroup.max;
}

/**
 * Get the age group that contains a specific age
 * Useful for determining which group an exact age (e.g., 7) belongs to
 * 
 * @param exactAge Exact age (e.g., 7)
 * @returns AgeGroup that contains this age, or undefined if not found
 */
export function getAgeGroupContaining(exactAge: number): AgeGroup | undefined {
	return AGE_GROUPS.find((group) => isAgeInGroup(exactAge, group));
}
