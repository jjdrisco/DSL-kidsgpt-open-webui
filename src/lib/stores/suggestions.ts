import { writable, get } from 'svelte/store';

export type PromptSuggestion = {
	title: [string, string];
	content: string;
};

interface SuggestionCache {
	[profileHash: string]: {
		suggestions: PromptSuggestion[];
		timestamp: number;
	};
}

const cache = writable<SuggestionCache>({});
let loadingPromises: Map<string, Promise<PromptSuggestion[]>> = new Map();

/**
 * Generate a hash from child profile for cache key
 */
export function getProfileHash(age: number | null, features: string[]): string {
	const featuresStr = [...features].sort().join(',');
	return `${age || 'none'}-${featuresStr}`;
}

/**
 * Get cached suggestions or generate new ones
 */
export async function getSuggestionsForProfile(
	age: number | null,
	features: string[],
	modelId: string,
	token: string,
	generateFn: (
		token: string,
		model: string,
		age: number | null,
		features: string[]
	) => Promise<any[]>
): Promise<PromptSuggestion[]> {
	const hash = getProfileHash(age, features);

	// Check cache
	const cachedState = get(cache);
	const cached = cachedState[hash];
	if (cached) {
		console.log('[suggestions] cache hit', { hash, count: cached.suggestions.length });
		return cached.suggestions;
	}

	// Check if already generating
	if (loadingPromises.has(hash)) {
		console.log('[suggestions] deduping, returning existing promise', { hash });
		return loadingPromises.get(hash)!;
	}

	// Generate
	const promise = (async () => {
		try {
			console.log('[suggestions] calling generateFn', { hash, modelId, age, features });
			const generated = await generateFn(token, modelId, age, features);
			console.log('[suggestions] generateFn returned', { hash, count: generated?.length ?? 0 });
			const suggestions: PromptSuggestion[] = generated.map((s: any) => ({
				title: Array.isArray(s.title) ? s.title : ['Suggestion', ''],
				content: s.content || ''
			}));

			// Store in cache
			cache.update((c) => ({
				...c,
				[hash]: { suggestions, timestamp: Date.now() }
			}));

			return suggestions;
		} catch (error) {
			console.error('[suggestions] Failed to generate suggestions:', error);
			return [];
		} finally {
			loadingPromises.delete(hash);
		}
	})();

	loadingPromises.set(hash, promise);
	return promise;
}

/**
 * Clear cache (call on logout)
 */
export function clearSuggestionsCache(): void {
	cache.set({});
	loadingPromises.clear();
}
