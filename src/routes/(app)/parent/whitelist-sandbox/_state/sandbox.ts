import { derived, get, writable } from 'svelte/store';
import { toast } from 'svelte-sonner';
import { childProfileSync } from '$lib/services/childProfileSync';
import { updateChildProfileWhitelist } from '$lib/apis/child-profiles';

type Suggestion = { label: string; features: string[] };

export const SUGGESTIONS: Suggestion[] = [
	{
		label: '📚 School Assignment',
		features: [
			'Simple greetings and friendly conversation starters',
			'Math homework and problem-solving',
			'Science concepts and experiments',
			'History and geography questions',
			'Reading comprehension and analysis',
			'Essay writing and grammar help',
			'Study skills and exam preparation'
		]
	},
	{
		label: '💬 General Questions',
		features: [
			'Simple greetings and friendly conversation starters',
			'General knowledge and factual information',
			'Nature, animals, and the environment',
			'Space, planets, and astronomy',
			'How everyday things work',
			'Geography and world cultures'
		]
	},
	{
		label: '✍️ Creative Writing',
		features: [
			'Simple greetings and friendly conversation starters',
			'Story writing and storytelling',
			'Poetry and rhymes',
			'Character and world building',
			'Writing prompts and brainstorming',
			'Editing and improving writing'
		]
	},
	{
		label: '🚫 No Personal Advice',
		features: [
			'Simple greetings and friendly conversation starters',
			'Educational and factual questions only',
			'Science, math, and academic topics',
			'Creative and imaginative activities (age-appropriate)',
			'General knowledge and curiosity questions'
		]
	},
	{
		label: '✏️ Custom / DIY',
		features: []
	}
];

type SaveStatus = 'idle' | 'saving' | 'saved';
type Message = { role: 'user' | 'assistant'; content: string };

export const childName = writable<string>('Your Child');
export const childAge = writable<string>('');
const profileId = writable<string | null>(null);

export const features = writable<string[]>([...SUGGESTIONS[0].features]);
export const activeChip = writable<string>(SUGGESTIONS[0].label);
export const newFeatureText = writable<string>('');

export const saveStatus = writable<SaveStatus>('idle');

export const messages = writable<Message[]>([]);
export const inputText = writable<string>('');
export const isLoading = writable<boolean>(false);

export const activeChipFeatures = derived([activeChip], ([$activeChip]) => {
	return SUGGESTIONS.find((s) => s.label === $activeChip)?.features ?? [];
});

export const isCustomized = derived([features, activeChipFeatures], ([$features, $activeChipFeatures]) => {
	return JSON.stringify($features) !== JSON.stringify($activeChipFeatures);
});

export const systemPrompt = derived([features], ([$features]) => {
	return buildSystemPrompt($features);
});

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let savedClearTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;

export async function initializeSandbox() {
	if (initialized) return;
	initialized = true;

	try {
		const profiles = await childProfileSync.getChildProfiles();
		const currentId = childProfileSync.getCurrentChildId();
		const match = currentId ? profiles.find((p) => p.id === currentId) : profiles[0];

		if (match?.name) childName.set(match.name);
		if (match?.child_age) childAge.set(match.child_age);
		if (match?.id) profileId.set(match.id);

		if (match?.selected_features && match.selected_features.length > 0) {
			features.set([...match.selected_features]);
			const matchingChip = SUGGESTIONS.find(
				(s) => JSON.stringify(s.features) === JSON.stringify(match.selected_features)
			);
			activeChip.set(matchingChip ? matchingChip.label : '✏️ Custom / DIY');
		}
	} catch (error) {
		console.warn('[Sandbox] Could not load child profile:', error);
	}
}

export function setNewFeatureText(value: string) {
	newFeatureText.set(value);
}

function scheduleSave() {
	if (!get(profileId)) return;
	if (saveTimer) clearTimeout(saveTimer);
	if (savedClearTimer) clearTimeout(savedClearTimer);

	saveStatus.set('saving');
	saveTimer = setTimeout(persistWhitelist, 800);
}

async function persistWhitelist() {
	const currentProfileId = get(profileId);
	if (!currentProfileId) return;

	try {
		const token = localStorage.getItem('token') ?? '';
		await updateChildProfileWhitelist(token, currentProfileId, get(features));
		saveStatus.set('saved');
		savedClearTimer = setTimeout(() => saveStatus.set('idle'), 2500);
	} catch (error) {
		console.error('[Sandbox] Failed to save whitelist:', error);
		saveStatus.set('idle');
	}
}

export function applyChip(suggestion: Suggestion) {
	features.set([...suggestion.features]);
	activeChip.set(suggestion.label);
	scheduleSave();
}

export function resetToPreset() {
	const currentChip = get(activeChip);
	const preset =
		SUGGESTIONS.find((s) => s.label === currentChip && s.features.length > 0) ?? SUGGESTIONS[0];
	features.set([...preset.features]);
	activeChip.set(preset.label);
	scheduleSave();
}

export function removeFeature(index: number) {
	features.update((current) => current.filter((_, i) => i !== index));
	scheduleSave();
}

export function updateFeature(index: number, value: string) {
	features.update((current) => current.map((f, i) => (i === index ? value : f)));
	scheduleSave();
}

export function addFeature(onAdded?: () => void) {
	const trimmed = get(newFeatureText).trim();
	if (!trimmed) return;

	features.update((current) => [...current, trimmed]);
	newFeatureText.set('');
	onAdded?.();
	scheduleSave();
}

export function setInputValue(value: string) {
	inputText.set(value);
}

export function resetChat() {
	messages.set([]);
	inputText.set('');
}

function buildSystemPrompt(featureList: string[]): string {
	if (featureList.length === 0) {
		return 'You are a safe and helpful AI assistant for a child. Be friendly and age-appropriate in all responses. Decline any topic that is not educational, creative, or factual in nature.';
	}

	const bulletList = featureList.map((f) => `• ${f}`).join('\n');
	return (
		'You are a safe and helpful AI assistant for a child. ' +
		'You are ONLY allowed to assist with the following approved topics and activities:\n\n' +
		`${bulletList}\n\n` +
		'For any topic, question, or request that is NOT on this approved list, politely decline ' +
		'and suggest the child speaks with a trusted adult or parent. ' +
		'Do not help with anything outside this whitelist under any circumstances. ' +
		'Keep all responses age-appropriate, positive, and encouraging.'
	);
}

async function llmCall(sysprompt: string, userContent: string): Promise<string> {
	const res = await fetch('/api/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`
		},
		body: JSON.stringify({
			model: 'gpt-5.2-chat-latest',
			messages: [
				{ role: 'system', content: sysprompt },
				{ role: 'user', content: userContent }
			],
			stream: false,
			metadata: { sandbox_mode: true }
		})
	});

	if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
	const data = await res.json();
	return data?.choices?.[0]?.message?.content ?? '';
}

export async function sendMessage() {
	const text = get(inputText).trim();
	if (!text || get(isLoading)) return;

	const currentMessages = get(messages);
	const userMsg: Message = { role: 'user', content: text };
	messages.set([...currentMessages, userMsg]);
	inputText.set('');
	isLoading.set(true);

	try {
		const ageClause = get(childAge) ? `The child is ${get(childAge)}. ` : '';
		const promptRewriteSystem =
			'You are a strict content-routing assistant for a children\'s AI. ' +
			ageClause +
			'Your job is to rewrite the child\'s message so it only addresses topics from the approved whitelist below, ' +
			'and so that the phrasing and vocabulary are appropriate for a child of that age. ' +
			'If the message is already on-topic, return it unchanged or lightly reworded for clarity. ' +
			'If the message cannot be redirected to any approved topic, respond with exactly: [BLOCKED]\n\n' +
			`Approved whitelist:\n${get(features).map((f) => `• ${f}`).join('\n')}\n\n` +
			'Return ONLY the rewritten message (or [BLOCKED]). Do not add explanations.';

		const rewrittenPrompt = await llmCall(promptRewriteSystem, text);

		if (rewrittenPrompt.trim() === '[BLOCKED]') {
			const blockedMsg =
				"I'm only able to help with the topics on your child's approved whitelist. " +
				'This question falls outside of the topics I can help with — please speak with a trusted adult or parent for help with this one!';
			messages.update((current) => [...current, { role: 'assistant', content: blockedMsg }]);
			return;
		}

		const history = get(messages).slice(0, -1);
		const apiMessages = [
			{ role: 'system', content: get(systemPrompt) },
			...history.map((m) => ({ role: m.role, content: m.content })),
			{ role: 'user', content: rewrittenPrompt }
		];

		const mainRes = await fetch('/api/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`
			},
			body: JSON.stringify({
				model: 'gpt-5.2-chat-latest',
				messages: apiMessages,
				stream: false,
				metadata: { sandbox_mode: true }
			})
		});

		if (!mainRes.ok) {
			const errText = await mainRes.text();
			console.error('[Sandbox] API error:', mainRes.status, errText);
			toast.error(`API error: ${mainRes.status}`);
			messages.update((current) => [...current, { role: 'assistant', content: `[Error ${mainRes.status}]` }]);
			return;
		}

		const mainData = await mainRes.json();
		const providerResponse = mainData?.choices?.[0]?.message?.content ?? '[No response content]';
		messages.update((current) => [...current, { role: 'assistant', content: providerResponse }]);
	} catch (error) {
		console.error('[Sandbox] Fetch error:', error);
		toast.error('Failed to reach the API. Is the backend running?');
		messages.update((current) => [...current, { role: 'assistant', content: '[Network error — check backend]' }]);
	} finally {
		isLoading.set(false);
	}
}
