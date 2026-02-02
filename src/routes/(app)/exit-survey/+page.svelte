<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { showSidebar, user, mobile } from '$lib/stores';
	import { get } from 'svelte/store';
	import MenuLines from '$lib/components/icons/MenuLines.svelte';
	import { toast } from 'svelte-sonner';
	import AssignmentTimeTracker from '$lib/components/assignment/AssignmentTimeTracker.svelte';
	import { childProfileSync } from '$lib/services/childProfileSync';
	import VideoModal from '$lib/components/common/VideoModal.svelte';
	import {
		personalityTraits,
		type PersonalityTrait,
		type SubCharacteristic
	} from '$lib/data/personalityTraits';
	import { getChildProfileById } from '$lib/apis/child-profiles';

	// Ensure sidebar is visible on survey pages (unless on mobile)
	onMount(() => {
		if (!$mobile) {
			showSidebar.set(true);
		}
	});

	// Assignment workflow state
	let assignmentStep: number = 1;

	// Child information modal state
	let showChildInfoModal: boolean = false;
	let childInfoData = {
		name: '',
		age: '',
		gender: ''
	};

	// Personality traits system
	let expandedTraits: Set<string> = new Set();
	let selectedSubCharacteristics: string[] = [];
	let childCharacteristics: string = '';

	// Child quiz research fields
	let isOnlyChild: string = '';
	let childHasAIUse: string = '';
	let childAIUseContexts: string[] = [];
	let parentLLMMonitoringLevel: string = '';
	let childAIUseContextsOther: string = '';
	let parentLLMMonitoringOther: string = '';

	// Duplicate questions for attention check
	let childHasAIUseCheck: string = '';
	let parentLLMMonitoringCheck: string = '';

	// Survey responses
	let surveyResponses = {
		parentGender: '',
		parentAge: '',
		areaOfResidency: '',
		parentEducation: '',
		parentEthnicity: [],
		genaiFamiliarity: '',
		genaiUsageFrequency: '',
		parentingStyle: ''
	};

	// API
	import { createExitQuiz, listExitQuiz } from '$lib/apis/exit-quiz';
	import { getChildProfiles as apiGetChildProfiles } from '$lib/apis/child-profiles';

	// Save/Edit pattern state
	let isSaved: boolean = false;
	let showConfirmationModal: boolean = false;

	// Assignment time tracking
	$: sessionNumber = $user?.session_number || 1;

	// Video modal state
	let showHelpVideo: boolean = false;

	// Debounce helper
	function debounce(fn: (...args: any[]) => void, delay = 400) {
		let t: any;
		return (...args: any[]) => {
			clearTimeout(t);
			t = setTimeout(() => fn(...args), delay);
		};
	}

	function draftKey(userId: string, childId: string) {
		const u = userId || 'anon';
		const c = childId || 'pending';
		return `exitSurveyDraft:${u}:${c}`;
	}
	function completedKey(userId: string, childId: string) {
		const u = userId || 'anon';
		const c = childId || 'pending';
		return `exitSurveyCompleted:${u}:${c}`;
	}

	async function resolveChildId(token: string): Promise<string> {
		let child_id = '';

		// Primary source: backend-persisted current child ID
		const currentChildId = childProfileSync.getCurrentChildId();
		if (currentChildId) {
			child_id = currentChildId;
		} else {
			// Fallback: use cached child profile
			const currentChild = childProfileSync.getCurrentChild();
			if (currentChild?.id) {
				child_id = currentChild.id;
			} else {
				// Fallback: use first available profile
				const profiles = await childProfileSync.getChildProfiles();
				if (profiles && Array.isArray(profiles) && profiles.length > 0) {
					child_id = profiles[0]?.id || '';
				} else {
					try {
						const apiProfiles = await apiGetChildProfiles(token);
						if (apiProfiles && Array.isArray(apiProfiles) && apiProfiles.length > 0) {
							child_id = apiProfiles[0]?.id || '';
						}
					} catch {}
				}
			}
		}
		return child_id;
	}

	// Personality trait helper functions
	function toggleTrait(traitId: string) {
		if (expandedTraits.has(traitId)) {
			expandedTraits.delete(traitId);
		} else {
			expandedTraits.add(traitId);
		}
		expandedTraits = expandedTraits; // Trigger reactivity
	}

	function getSelectedSubCharacteristics(): SubCharacteristic[] {
		const selected: SubCharacteristic[] = [];
		for (const trait of personalityTraits) {
			const matchingChars = trait.subCharacteristics.filter((sub) =>
				selectedSubCharacteristics.includes(sub.id)
			);
			selected.push(...matchingChars);
		}
		return selected;
	}

	function getSelectedSubCharacteristicNames(): string[] {
		return getSelectedSubCharacteristics().map((sub) => sub.name);
	}

	function getPersonalityDescription(): string {
		const selected = getSelectedSubCharacteristics();
		if (selected.length === 0) return '';
		const groupedByTrait: Record<string, string[]> = {};
		for (const sub of selected) {
			const trait = personalityTraits.find((t) =>
				t.subCharacteristics.some((sc) => sc.id === sub.id)
			);
			if (trait) {
				if (!groupedByTrait[trait.name]) {
					groupedByTrait[trait.name] = [];
				}
				groupedByTrait[trait.name].push(sub.name);
			}
		}
		return Object.entries(groupedByTrait)
			.map(([traitName, charNames]) => `${traitName}: ${charNames.join(', ')}`)
			.join('\n');
	}

	// Load child information from current child profile
	async function loadChildInfo() {
		try {
			const token = localStorage.token || '';
			const currentChild = childProfileSync.getCurrentChild();
			if (currentChild) {
				childInfoData.name = currentChild.name || '';
				childInfoData.age = currentChild.child_age || '';
				childInfoData.gender = currentChild.child_gender || '';
			} else {
				const childId = await resolveChildId(token);
				if (childId) {
					const profile = await getChildProfileById(token, childId);
					if (profile) {
						childInfoData.name = profile.name || '';
						childInfoData.age = profile.child_age || '';
						childInfoData.gender = profile.child_gender || '';
					}
				}
			}
		} catch (error) {
			console.error('Failed to load child info:', error);
		}
	}

	onMount(async () => {
		assignmentStep = parseInt(localStorage.getItem('assignmentStep') || '3');
		await loadChildInfo(); // Load child info for modal

		// Get current attempt number and child ID
		try {
			const token = localStorage.token || '';
			if (token) {
				const attemptData = await getCurrentAttempt(token);
				attemptNumber = attemptData.current_attempt || 1;
			}
			const currentChild = childProfileSync.getCurrentChild();
			currentChildId = currentChild?.id || null;
		} catch (e) {
			console.warn('Failed to get attempt number or child ID', e);
		}

		const token = localStorage.token || '';
		const userId = get(user)?.id || 'anon';
		const childId = await resolveChildId(token);

		// Rehydrate from backend if any saved rows exist (works even if local completion flag was cleared)
		if (childId) {
			try {
				const rows = await listExitQuiz(token, childId);
				if (rows && Array.isArray(rows) && rows.length > 0) {
					const latest = [...rows].sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))[0];
					const ans: any = latest?.answers || {};
					surveyResponses = {
						parentGender: ans.parentGender || '',
						parentAge: ans.parentAge || '',
						areaOfResidency: ans.areaOfResidency || '',
						parentEducation: ans.parentEducation || '',
						parentEthnicity: Array.isArray(ans.parentEthnicity) ? ans.parentEthnicity : [],
						genaiFamiliarity: ans.genaiFamiliarity || '',
						genaiUsageFrequency: ans.genaiUsageFrequency || '',
						parentingStyle: ans.parentingStyle || ''
					};
					isSaved = true;
					// Ensure sidebar unlock for completion if a saved survey exists
					try {
						localStorage.setItem('assignmentStep', '4');
						localStorage.setItem('assignmentCompleted', 'true');
						localStorage.setItem('unlock_completion', 'true');
						window.dispatchEvent(new Event('storage'));
						window.dispatchEvent(new Event('workflow-updated'));
					} catch {}
					// Also restore local completion flag for smoother UX next time
					try {
						localStorage.setItem(completedKey(userId, childId), 'true');
					} catch {}
					return; // prefer saved view
				}
			} catch {}
		}

		// Load draft if present
		try {
			const raw = localStorage.getItem(draftKey(userId, childId));
			if (raw) {
				const draft = JSON.parse(raw);
				if (draft && typeof draft === 'object') {
					surveyResponses = {
						parentGender: draft.parentGender || '',
						parentAge: draft.parentAge || '',
						areaOfResidency: draft.areaOfResidency || '',
						parentEducation: draft.parentEducation || '',
						parentEthnicity: Array.isArray(draft.parentEthnicity) ? draft.parentEthnicity : [],
						genaiFamiliarity: draft.genaiFamiliarity || '',
						genaiUsageFrequency: draft.genaiUsageFrequency || '',
						parentingStyle: draft.parentingStyle || ''
					};
				}
			}
		} catch {}
	});

	async function submitSurvey() {
		try {
			// Validate required fields
			if (!surveyResponses.parentGender) {
				toast.error('Please select your gender');
				return;
			}
			if (!surveyResponses.parentAge) {
				toast.error('Please select your age range');
				return;
			}
			if (!surveyResponses.areaOfResidency) {
				toast.error('Please select your area of residency');
				return;
			}
			if (!surveyResponses.parentEducation) {
				toast.error('Please select your education level');
				return;
			}
			if (!surveyResponses.genaiFamiliarity) {
				toast.error('Please select your familiarity with LLMs');
				return;
			}
			if (!surveyResponses.genaiUsageFrequency) {
				toast.error('Please select your personal AI use frequency');
				return;
			}
			if (!surveyResponses.parentingStyle) {
				toast.error('Please select your parenting style');
				return;
			}
			if (!surveyResponses.parentEthnicity || surveyResponses.parentEthnicity.length === 0) {
				toast.error('Please select at least one ethnicity');
				return;
			}

			// Validate child information fields
			if (childCharacteristics.length < 10) {
				toast.error('Please provide a description of your child (at least 10 characters)');
				return;
			}
			if (!isOnlyChild) {
				toast.error('Please indicate if this child is an only child');
				return;
			}
			if (!childHasAIUse) {
				toast.error('Please indicate if this child has used ChatGPT or similar AI tools');
				return;
			}
			if (childHasAIUse === 'yes' && childAIUseContexts.length === 0) {
				toast.error('Please select at least one context in which your child has used AI tools');
				return;
			}
			if (!parentLLMMonitoringLevel) {
				toast.error('Please indicate your monitoring level of your child\'s AI tool use');
				return;
			}

			// Validate attention check questions
			if (!childHasAIUseCheck) {
				toast.error('Please answer the attention check question about AI tool use');
				return;
			}
			if (!parentLLMMonitoringCheck) {
				toast.error('Please answer the attention check question about monitoring');
				return;
			}

			// Resolve child_id using the consolidated resolveChildId function
			const token = localStorage.token || '';
			let child_id = await resolveChildId(token);

			if (!child_id) {
				toast.error(
					'No child profile found. Please create/select a child on the Child Profile page.'
				);
				return;
			}

			// Get personality description
			const personalityDesc = getPersonalityDescription();

			// Map survey responses into answers payload
			const answers = {
				parentGender: surveyResponses.parentGender,
				parentAge: surveyResponses.parentAge,
				areaOfResidency: surveyResponses.areaOfResidency,
				parentEducation: surveyResponses.parentEducation,
				parentEthnicity: surveyResponses.parentEthnicity,
				genaiFamiliarity: surveyResponses.genaiFamiliarity,
				genaiUsageFrequency: surveyResponses.genaiUsageFrequency,
				parentingStyle: surveyResponses.parentingStyle,
				// Child information
				childName: childInfoData.name,
				childAge: childInfoData.age,
				childGender: childInfoData.gender,
				// Personality traits
				personalityTraits: personalityDesc,
				selectedSubCharacteristics: selectedSubCharacteristics,
				// Additional characteristics
				childCharacteristics: childCharacteristics,
				// Child quiz questions
				isOnlyChild: isOnlyChild,
				childHasAIUse: childHasAIUse,
				childAIUseContexts: childAIUseContexts,
				childAIUseContextsOther: childAIUseContextsOther,
				parentLLMMonitoringLevel: parentLLMMonitoringLevel,
				parentLLMMonitoringOther: parentLLMMonitoringOther,
				// Attention check
				childHasAIUseCheck: childHasAIUseCheck,
				parentLLMMonitoringCheck: parentLLMMonitoringCheck
			};

			// Persist to backend (exit quiz)
			await createExitQuiz(token, { child_id, answers, meta: { page: 'exit-survey' } });

			// Mark assignment as completed before showing confirmation
			localStorage.setItem('assignmentStep', '4');
			localStorage.setItem('assignmentCompleted', 'true');
			localStorage.setItem('unlock_completion', 'true');
			window.dispatchEvent(new Event('storage'));
			window.dispatchEvent(new Event('workflow-updated'));
			// Mark as saved and open confirmation modal
			isSaved = true;
			showConfirmationModal = true;

			// Clear draft and set per-user per-child completion flag
			const userId = get(user)?.id || 'anon';
			try {
				localStorage.removeItem(draftKey(userId, child_id));
			} catch {}
			localStorage.setItem(completedKey(userId, child_id), 'true');
		} catch (error) {
			console.error('Error saving survey:', error);
			toast.error('Failed to save survey. Please try again.');
		}
	}

	// Autosave draft on changes (debounced)
	const saveDraft = debounce(async () => {
		const token = localStorage.token || '';
		const userId = get(user)?.id || 'anon';
		const cid = await resolveChildId(token);
		const key = draftKey(userId, cid);
		try {
			localStorage.setItem(key, JSON.stringify(surveyResponses));
		} catch {}
	}, 500);

	$: saveDraft();

	function startEditing() {
		isSaved = false;
	}

	function proceedToNextStep() {
		// Update assignment step to 4 (completion)
		localStorage.setItem('assignmentStep', '4');
		localStorage.setItem('assignmentCompleted', 'true');
		goto('/completion');
	}

	function continueEditing() {
		showConfirmationModal = false;
	}

	function handleNextTask() {
		if (isSaved) {
			showConfirmationModal = true;
		} else {
			toast.error('Please save the survey before proceeding to the next task');
		}
	}

	function goBack() {
		goto('/moderation-scenario');
	}
</script>

<svelte:head>
	<title>Exit Survey</title>
</svelte:head>

<div
	class="flex flex-col w-full h-screen max-h-[100dvh] transition-width duration-200 ease-in-out {$showSidebar
		? 'md:max-w-[calc(100%-260px)]'
		: ''} max-w-full"
>
	<nav
		class="px-2.5 pt-1.5 pb-2 backdrop-blur-xl w-full drag-region bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800"
	>
		<div class="flex items-center justify-between">
			<div class="flex items-center">
				<div class="{$showSidebar ? 'md:hidden' : ''} flex flex-none items-center self-end">
					<button
						id="sidebar-toggle-button"
						class="cursor-pointer p-1.5 flex rounded-xl hover:bg-gray-100 dark:hover:bg-gray-850 transition"
						on:click={() => {
							showSidebar.set(!$showSidebar);
						}}
						aria-label="Toggle Sidebar"
					>
						<div class="m-auto self-center">
							<MenuLines />
						</div>
					</button>
				</div>

				<div class="flex w-full">
					<div class="flex items-center text-xl font-semibold">Exit Survey</div>
				</div>
			</div>

			<!-- Navigation Buttons -->
			<div class="flex items-center space-x-2">
				<!-- Help Button -->
				<button
					on:click={() => (showHelpVideo = true)}
					class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
					aria-label="Show help video"
				>
					Help
				</button>
				<button
					on:click={goBack}
					class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex items-center space-x-2"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15 19l-7-7 7-7"
						></path>
					</svg>
					<span>Previous Task</span>
				</button>
				<button
					on:click={handleNextTask}
					disabled={!isSaved}
					class="px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center space-x-2 {isSaved
						? 'bg-blue-500 hover:bg-blue-600 text-white'
						: 'text-gray-400 dark:text-gray-500 cursor-not-allowed'}"
				>
					<span>Next Task</span>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"
						></path>
					</svg>
				</button>
			</div>
		</div>
	</nav>

	<div class="flex-1 max-h-full overflow-y-auto bg-gray-50 dark:bg-gray-900">
		<div class="max-w-4xl mx-auto px-4 py-8">
			<!-- Header -->
			<div class="mb-8">
				<div>
					<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Exit Survey</h1>
					<p class="text-gray-600 dark:text-gray-300 mt-2">
						Please complete the exit survey to help us understand our participants
					</p>
				</div>
			</div>

			<!-- Survey Display/Form -->
			{#if isSaved}
				<!-- Read-only view after saving -->
				<div class="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-sm">
					<div class="flex justify-between items-start mb-6">
						<h3 class="text-xl font-semibold text-gray-900 dark:text-white">
							Exit Survey Responses
						</h3>
						<button
							type="button"
							on:click={startEditing}
							class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition"
						>
							Edit
						</button>
					</div>
					<div class="space-y-4">
						<div>
							<div class="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
								Parenting Style
							</div>
							<p class="text-gray-900 dark:text-white">
								{surveyResponses.parentingStyle
									? surveyResponses.parentingStyle === 'A'
										? "I set clear rules and follow through, but I explain my reasons, listen to my child's point of view, and encourage independence."
										: surveyResponses.parentingStyle === 'B'
											? "I set strict rules and expect obedience; I rarely negotiate and use firm consequences when rules aren't followed."
											: surveyResponses.parentingStyle === 'C'
												? "I'm warm and supportive with few rules or demands; my child mostly sets their own routines and limits."
												: surveyResponses.parentingStyle === 'D'
													? 'I give my child a lot of freedom and usually take a hands-off approach unless safety or basic needs require me to step in.'
													: surveyResponses.parentingStyle === 'E'
														? 'None of these fits me / It depends on the situation.'
														: surveyResponses.parentingStyle === 'prefer-not-to-answer'
															? 'Prefer not to answer'
															: surveyResponses.parentingStyle
									: 'Not specified'}
							</p>
						</div>
						<div>
							<div class="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
								GenAI Familiarity
							</div>
							<p class="text-gray-900 dark:text-white">
								{surveyResponses.genaiFamiliarity || 'Not specified'}
							</p>
						</div>
						<div>
							<div class="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
								GenAI Usage Frequency
							</div>
							<p class="text-gray-900 dark:text-white">
								{surveyResponses.genaiUsageFrequency || 'Not specified'}
							</p>
						</div>
						<div>
							<div class="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
								Gender
							</div>
							<p class="text-gray-900 dark:text-white">
								{surveyResponses.parentGender || 'Not specified'}
							</p>
						</div>
						<div>
							<div class="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
								Age Range
							</div>
							<p class="text-gray-900 dark:text-white">
								{surveyResponses.parentAge || 'Not specified'}
							</p>
						</div>
						<div>
							<div class="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
								Area of Residency
							</div>
							<p class="text-gray-900 dark:text-white">
								{surveyResponses.areaOfResidency || 'Not specified'}
							</p>
						</div>
						<div>
							<div class="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
								Education Level
							</div>
							<p class="text-gray-900 dark:text-white">
								{surveyResponses.parentEducation || 'Not specified'}
							</p>
						</div>
						<div>
							<div class="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
								Ethnicity
							</div>
							<p class="text-gray-900 dark:text-white">
								{surveyResponses.parentEthnicity.length > 0
									? surveyResponses.parentEthnicity.join(', ')
									: 'Not specified'}
							</p>
						</div>
					</div>
				</div>
			{:else}
				<!-- Editable form -->
				<div class="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-sm">
					<form on:submit|preventDefault={submitSurvey} class="space-y-8">
						<!-- Question 1: Parenting Style -->
						<div>
							<div class="block text-lg font-medium text-gray-900 dark:text-white mb-3">
								1. Which description best matches your typical approach to day-to-day parenting?
								(Choose the closest fit.) <span class="text-red-500">*</span>
							</div>
							<div class="space-y-2">
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.parentingStyle}
										value="A"
										class="mr-3"
										id="parenting-style-a"
									/>
									<span class="text-gray-900 dark:text-white"
										>I set clear rules and follow through, but I explain my reasons, listen to my
										child's point of view, and encourage independence.</span
									>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.parentingStyle}
										value="B"
										class="mr-3"
										id="parenting-style-b"
									/>
									<span class="text-gray-900 dark:text-white"
										>I set strict rules and expect obedience; I rarely negotiate and use firm
										consequences when rules aren't followed.</span
									>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.parentingStyle}
										value="C"
										class="mr-3"
										id="parenting-style-c"
									/>
									<span class="text-gray-900 dark:text-white"
										>I'm warm and supportive with few rules or demands; my child mostly sets their
										own routines and limits.</span
									>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.parentingStyle}
										value="D"
										class="mr-3"
										id="parenting-style-d"
									/>
									<span class="text-gray-900 dark:text-white"
										>I give my child a lot of freedom and usually take a hands-off approach unless
										safety or basic needs require me to step in.</span
									>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.parentingStyle}
										value="E"
										class="mr-3"
										id="parenting-style-e"
									/>
									<span class="text-gray-900 dark:text-white"
										>None of these fits me / It depends on the situation.</span
									>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.parentingStyle}
										value="prefer-not-to-answer"
										class="mr-3"
										id="parenting-style-prefer-not-to-answer"
									/>
									<span class="text-gray-900 dark:text-white">Prefer not to answer</span>
								</label>
							</div>
						</div>

						<!-- GenAI familiarity -->
						<div>
							<div class="block text-lg font-medium text-gray-900 dark:text-white mb-3">
								2. How familiar are you with ChatGPT or other Large Language Models (LLMs)? <span
									class="text-red-500">*</span
								>
							</div>
							<div class="space-y-2">
								<label class="flex items-center"
									><input
										type="radio"
										bind:group={surveyResponses.genaiFamiliarity}
										value="regular_user"
										class="mr-3"
									/>I regularly use ChatGPT or other LLMs for work or personal use</label
								>
								<label class="flex items-center"
									><input
										type="radio"
										bind:group={surveyResponses.genaiFamiliarity}
										value="tried_few_times"
										class="mr-3"
									/>I have tried them a few times but don’t use them often</label
								>
								<label class="flex items-center"
									><input
										type="radio"
										bind:group={surveyResponses.genaiFamiliarity}
										value="heard_never_used"
										class="mr-3"
									/>I have heard of them but never used them</label
								>
								<label class="flex items-center"
									><input
										type="radio"
										bind:group={surveyResponses.genaiFamiliarity}
										value="dont_know"
										class="mr-3"
									/>I don’t know what they are</label
								>
								<label class="flex items-center"
									><input
										type="radio"
										bind:group={surveyResponses.genaiFamiliarity}
										value="prefer-not-to-answer"
										class="mr-3"
									/>Prefer not to answer</label
								>
							</div>
						</div>

						<!-- Personal GenAI use frequency -->
						<div>
							<div class="block text-lg font-medium text-gray-900 dark:text-white mb-3">
								3. How often do you personally use ChatGPT or similar AI tools? <span
									class="text-red-500">*</span
								>
							</div>
							<div class="space-y-2">
								<label class="flex items-center"
									><input
										type="radio"
										bind:group={surveyResponses.genaiUsageFrequency}
										value="daily"
										class="mr-3"
									/>Daily or almost daily</label
								>
								<label class="flex items-center"
									><input
										type="radio"
										bind:group={surveyResponses.genaiUsageFrequency}
										value="weekly"
										class="mr-3"
									/>Weekly</label
								>
								<label class="flex items-center"
									><input
										type="radio"
										bind:group={surveyResponses.genaiUsageFrequency}
										value="monthly_or_less"
										class="mr-3"
									/>Monthly or less</label
								>
								<label class="flex items-center"
									><input
										type="radio"
										bind:group={surveyResponses.genaiUsageFrequency}
										value="do_not_use"
										class="mr-3"
									/>I do not use these tools</label
								>
								<label class="flex items-center"
									><input
										type="radio"
										bind:group={surveyResponses.genaiUsageFrequency}
										value="prefer-not-to-answer"
										class="mr-3"
									/>Prefer not to answer</label
								>
							</div>
						</div>
						<!-- Question 4: Parent Gender -->
						<div>
							<div class="block text-lg font-medium text-gray-900 dark:text-white mb-3">
								4. What is your gender? <span class="text-red-500">*</span>
							</div>
							<div class="space-y-2">
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.parentGender}
										value="male"
										class="mr-3"
										id="gender-male"
									/>
									<span class="text-gray-900 dark:text-white">Male</span>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.parentGender}
										value="female"
										class="mr-3"
										id="gender-female"
									/>
									<span class="text-gray-900 dark:text-white">Female</span>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.parentGender}
										value="non-binary"
										class="mr-3"
										id="gender-non-binary"
									/>
									<span class="text-gray-900 dark:text-white">Non-binary</span>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.parentGender}
										value="other"
										class="mr-3"
										id="gender-other"
									/>
									<span class="text-gray-900 dark:text-white">Other</span>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.parentGender}
										value="prefer-not-to-say"
										class="mr-3"
										id="gender-prefer-not-to-say"
									/>
									<span class="text-gray-900 dark:text-white">Prefer not to say</span>
								</label>
							</div>
						</div>

						<!-- Question 5: Parent Age -->
						<div>
							<div class="block text-lg font-medium text-gray-900 dark:text-white mb-3">
								5. What is your age range? <span class="text-red-500">*</span>
							</div>
							<div class="space-y-2">
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.parentAge}
										value="18-24"
										class="mr-3"
										id="age-18-24"
									/>
									<span class="text-gray-900 dark:text-white">18-24 years</span>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.parentAge}
										value="25-34"
										class="mr-3"
										id="age-25-34"
									/>
									<span class="text-gray-900 dark:text-white">25-34 years</span>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.parentAge}
										value="35-44"
										class="mr-3"
										id="age-35-44"
									/>
									<span class="text-gray-900 dark:text-white">35-44 years</span>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.parentAge}
										value="45-54"
										class="mr-3"
										id="age-45-54"
									/>
									<span class="text-gray-900 dark:text-white">45-54 years</span>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.parentAge}
										value="55-64"
										class="mr-3"
										id="age-55-64"
									/>
									<span class="text-gray-900 dark:text-white">55-64 years</span>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.parentAge}
										value="65+"
										class="mr-3"
										id="age-65-plus"
									/>
									<span class="text-gray-900 dark:text-white">65+ years</span>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.parentAge}
										value="prefer-not-to-say"
										class="mr-3"
										id="age-prefer-not-to-say"
									/>
									<span class="text-gray-900 dark:text-white">Prefer not to say</span>
								</label>
							</div>
						</div>

						<!-- Question 6: Area of Residency -->
						<div>
							<div class="block text-lg font-medium text-gray-900 dark:text-white mb-3">
								6. What type of area do you live in? <span class="text-red-500">*</span>
							</div>
							<div class="space-y-2">
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.areaOfResidency}
										value="urban"
										class="mr-3"
										id="area-urban"
									/>
									<span class="text-gray-900 dark:text-white">Urban (city)</span>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.areaOfResidency}
										value="suburban"
										class="mr-3"
										id="area-suburban"
									/>
									<span class="text-gray-900 dark:text-white">Suburban</span>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.areaOfResidency}
										value="rural"
										class="mr-3"
										id="area-rural"
									/>
									<span class="text-gray-900 dark:text-white">Rural (countryside)</span>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.areaOfResidency}
										value="prefer-not-to-say"
										class="mr-3"
										id="area-prefer-not-to-say"
									/>
									<span class="text-gray-900 dark:text-white">Prefer not to say</span>
								</label>
							</div>
						</div>

						<!-- Question 7: Parent Education -->
						<div>
							<div class="block text-lg font-medium text-gray-900 dark:text-white mb-3">
								7. What is your highest level of education? <span class="text-red-500">*</span>
							</div>
							<div class="space-y-2">
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.parentEducation}
										value="high-school"
										class="mr-3"
										id="education-high-school"
									/>
									<span class="text-gray-900 dark:text-white"
										>High school diploma or equivalent</span
									>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.parentEducation}
										value="some-college"
										class="mr-3"
										id="education-some-college"
									/>
									<span class="text-gray-900 dark:text-white">Some college, no degree</span>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.parentEducation}
										value="associates"
										class="mr-3"
										id="education-associates"
									/>
									<span class="text-gray-900 dark:text-white">Associate degree</span>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.parentEducation}
										value="bachelors"
										class="mr-3"
										id="education-bachelors"
									/>
									<span class="text-gray-900 dark:text-white">Bachelor's degree</span>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.parentEducation}
										value="masters"
										class="mr-3"
										id="education-masters"
									/>
									<span class="text-gray-900 dark:text-white">Master's degree</span>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.parentEducation}
										value="doctoral"
										class="mr-3"
										id="education-doctoral"
									/>
									<span class="text-gray-900 dark:text-white">Doctoral degree</span>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={surveyResponses.parentEducation}
										value="prefer-not-to-say"
										class="mr-3"
										id="education-prefer-not-to-say"
									/>
									<span class="text-gray-900 dark:text-white">Prefer not to say</span>
								</label>
							</div>
						</div>

						<!-- Question 8: Parent Ethnicity -->
						<div>
							<div class="block text-lg font-medium text-gray-900 dark:text-white mb-3">
								8. What is your ethnicity? (Select all that apply) <span class="text-red-500"
									>*</span
								>
							</div>
							<div class="space-y-2">
								<label class="flex items-center">
									<input
										type="checkbox"
										bind:group={surveyResponses.parentEthnicity}
										value="white"
										class="mr-3"
										id="ethnicity-white"
									/>
									<span class="text-gray-900 dark:text-white">White</span>
								</label>
								<label class="flex items-center">
									<input
										type="checkbox"
										bind:group={surveyResponses.parentEthnicity}
										value="black-african-american"
										class="mr-3"
										id="ethnicity-black-african-american"
									/>
									<span class="text-gray-900 dark:text-white">Black or African American</span>
								</label>
								<label class="flex items-center">
									<input
										type="checkbox"
										bind:group={surveyResponses.parentEthnicity}
										value="hispanic-latino"
										class="mr-3"
										id="ethnicity-hispanic-latino"
									/>
									<span class="text-gray-900 dark:text-white">Hispanic or Latino</span>
								</label>
								<label class="flex items-center">
									<input
										type="checkbox"
										bind:group={surveyResponses.parentEthnicity}
										value="asian"
										class="mr-3"
										id="ethnicity-asian"
									/>
									<span class="text-gray-900 dark:text-white">Asian</span>
								</label>
								<label class="flex items-center">
									<input
										type="checkbox"
										bind:group={surveyResponses.parentEthnicity}
										value="native-american"
										class="mr-3"
										id="ethnicity-native-american"
									/>
									<span class="text-gray-900 dark:text-white">Native American or Alaska Native</span
									>
								</label>
								<label class="flex items-center">
									<input
										type="checkbox"
										bind:group={surveyResponses.parentEthnicity}
										value="pacific-islander"
										class="mr-3"
										id="ethnicity-pacific-islander"
									/>
									<span class="text-gray-900 dark:text-white"
										>Native Hawaiian or Pacific Islander</span
									>
								</label>
								<label class="flex items-center">
									<input
										type="checkbox"
										bind:group={surveyResponses.parentEthnicity}
										value="middle-eastern"
										class="mr-3"
										id="ethnicity-middle-eastern"
									/>
									<span class="text-gray-900 dark:text-white">Middle Eastern or North African</span>
								</label>
								<label class="flex items-center">
									<input
										type="checkbox"
										bind:group={surveyResponses.parentEthnicity}
										value="mixed-race"
										class="mr-3"
										id="ethnicity-mixed-race"
									/>
									<span class="text-gray-900 dark:text-white">Mixed race</span>
								</label>
								<label class="flex items-center">
									<input
										type="checkbox"
										bind:group={surveyResponses.parentEthnicity}
										value="other"
										class="mr-3"
										id="ethnicity-other"
									/>
									<span class="text-gray-900 dark:text-white">Other</span>
								</label>
								<label class="flex items-center">
									<input
										type="checkbox"
										bind:group={surveyResponses.parentEthnicity}
										value="prefer-not-to-say"
										class="mr-3"
										id="ethnicity-prefer-not-to-say"
									/>
									<span class="text-gray-900 dark:text-white">Prefer not to say</span>
								</label>
							</div>
						</div>

						<!-- Child Information Section -->
						<div class="border-t border-gray-200 dark:border-gray-700 pt-8 mt-8">
							<div class="flex items-center justify-between mb-4">
								<h3 class="text-xl font-semibold text-gray-900 dark:text-white">
									Child Information
								</h3>
								<button
									type="button"
									on:click={() => (showChildInfoModal = true)}
									class="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
								>
									View/Edit Child Information
								</button>
							</div>
							{#if childInfoData.name || childInfoData.age || childInfoData.gender}
								<div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2">
									{#if childInfoData.name}
										<div>
											<span class="text-sm font-medium text-gray-600 dark:text-gray-400">Name:</span>
											<span class="ml-2 text-gray-900 dark:text-white">{childInfoData.name}</span>
										</div>
									{/if}
									{#if childInfoData.age}
										<div>
											<span class="text-sm font-medium text-gray-600 dark:text-gray-400">Age:</span>
											<span class="ml-2 text-gray-900 dark:text-white">{childInfoData.age}</span>
										</div>
									{/if}
									{#if childInfoData.gender}
										<div>
											<span class="text-sm font-medium text-gray-600 dark:text-gray-400">Gender:</span>
											<span class="ml-2 text-gray-900 dark:text-white">{childInfoData.gender}</span>
										</div>
									{/if}
								</div>
							{/if}
						</div>

						<!-- Personality Traits Selection -->
						<div class="border-t border-gray-200 dark:border-gray-700 pt-8 mt-8">
							<h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">
								Personality Traits Selection
							</h3>
							<p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
								Please select the personality traits that best describe your child. Click on each trait
								to expand and select specific characteristics.
							</p>
							<div class="space-y-4">
								{#each personalityTraits as trait}
									<div
										class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
									>
										<button
											type="button"
											on:click={() => toggleTrait(trait.id)}
											class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between transition-colors"
										>
											<div class="text-left">
												<div class="font-medium text-gray-900 dark:text-white">{trait.name}</div>
												<div class="text-sm text-gray-600 dark:text-gray-400 mt-1">
													{trait.description}
												</div>
											</div>
											<svg
												class="w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform {expandedTraits.has(trait.id)
													? 'rotate-180'
													: ''}"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M19 9l-7 7-7-7"
												></path>
											</svg>
										</button>
										{#if expandedTraits.has(trait.id)}
											<div class="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
												<div class="space-y-2">
													{#each trait.subCharacteristics as subChar}
														<label class="flex items-start">
															<input
																type="checkbox"
																bind:group={selectedSubCharacteristics}
																value={subChar.id}
																class="mt-1 mr-3"
															/>
															<div class="flex-1">
																<div class="text-sm font-medium text-gray-900 dark:text-white">
																	{subChar.name}
																</div>
																<div class="text-xs text-gray-600 dark:text-gray-400 mt-1">
																	{subChar.description}
																</div>
															</div>
														</label>
													{/each}
												</div>
											</div>
										{/if}
									</div>
								{/each}
							</div>
						</div>

						<!-- Additional Characteristics -->
						<div class="border-t border-gray-200 dark:border-gray-700 pt-8 mt-8">
							<label
								for="childCharacteristics"
								class="block text-lg font-medium text-gray-900 dark:text-white mb-3"
							>
								Please provide a description of your child (at least 10 characters)
								<span class="text-red-500">*</span>
							</label>
							<textarea
								id="childCharacteristics"
								bind:value={childCharacteristics}
								placeholder="Describe your child's personality, interests, and characteristics..."
								rows="4"
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
								minlength="10"
								required
							></textarea>
							<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
								{childCharacteristics.length}/10 minimum characters
							</p>
						</div>

						<!-- Is Child Only Child -->
						<div class="border-t border-gray-200 dark:border-gray-700 pt-8 mt-8">
							<div class="block text-lg font-medium text-gray-900 dark:text-white mb-3">
								Is this child an only child? <span class="text-red-500">*</span>
							</div>
							<div class="space-y-2">
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={isOnlyChild}
										value="yes"
										class="mr-3"
										id="only-child-yes"
									/>
									<span class="text-gray-900 dark:text-white">Yes</span>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={isOnlyChild}
										value="no"
										class="mr-3"
										id="only-child-no"
									/>
									<span class="text-gray-900 dark:text-white">No</span>
								</label>
							</div>
						</div>

						<!-- Has This Child Used ChatGPT -->
						<div class="border-t border-gray-200 dark:border-gray-700 pt-8 mt-8">
							<div class="block text-lg font-medium text-gray-900 dark:text-white mb-3">
								Has this child used ChatGPT or similar AI tools? <span class="text-red-500">*</span>
							</div>
							<div class="space-y-2">
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={childHasAIUse}
										value="yes"
										class="mr-3"
										id="child-ai-use-yes"
									/>
									<span class="text-gray-900 dark:text-white">Yes</span>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={childHasAIUse}
										value="no"
										class="mr-3"
										id="child-ai-use-no"
									/>
									<span class="text-gray-900 dark:text-white">No</span>
								</label>
							</div>
							{#if childHasAIUse === 'yes'}
								<div class="mt-4">
									<div class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
										In what contexts has your child used AI tools? (Select all that apply)
									</div>
									<div class="space-y-2">
										<label class="flex items-center">
											<input
												type="checkbox"
												bind:group={childAIUseContexts}
												value="homework"
												class="mr-3"
											/>
											<span class="text-gray-900 dark:text-white">Homework/Schoolwork</span>
										</label>
										<label class="flex items-center">
											<input
												type="checkbox"
												bind:group={childAIUseContexts}
												value="creative"
												class="mr-3"
											/>
											<span class="text-gray-900 dark:text-white">Creative writing/Stories</span>
										</label>
										<label class="flex items-center">
											<input
												type="checkbox"
												bind:group={childAIUseContexts}
												value="questions"
												class="mr-3"
											/>
											<span class="text-gray-900 dark:text-white">Answering questions</span>
										</label>
										<label class="flex items-center">
											<input
												type="checkbox"
												bind:group={childAIUseContexts}
												value="entertainment"
												class="mr-3"
											/>
											<span class="text-gray-900 dark:text-white">Entertainment/Conversation</span>
										</label>
										<label class="flex items-center">
											<input
												type="checkbox"
												bind:group={childAIUseContexts}
												value="other"
												class="mr-3"
											/>
											<span class="text-gray-900 dark:text-white">Other</span>
										</label>
									</div>
									{#if childAIUseContexts.includes('other')}
										<input
											type="text"
											bind:value={childAIUseContextsOther}
											placeholder="Please specify"
											class="w-full mt-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
										/>
									{/if}
								</div>
							{/if}
						</div>

						<!-- Have You Monitored or Adjusted -->
						<div class="border-t border-gray-200 dark:border-gray-700 pt-8 mt-8">
							<div class="block text-lg font-medium text-gray-900 dark:text-white mb-3">
								Have you monitored or adjusted your child's use of ChatGPT or similar AI tools?
								<span class="text-red-500">*</span>
							</div>
							<div class="space-y-2">
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={parentLLMMonitoringLevel}
										value="always"
										class="mr-3"
										id="monitoring-always"
									/>
									<span class="text-gray-900 dark:text-white">Always</span>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={parentLLMMonitoringLevel}
										value="often"
										class="mr-3"
										id="monitoring-often"
									/>
									<span class="text-gray-900 dark:text-white">Often</span>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={parentLLMMonitoringLevel}
										value="sometimes"
										class="mr-3"
										id="monitoring-sometimes"
									/>
									<span class="text-gray-900 dark:text-white">Sometimes</span>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={parentLLMMonitoringLevel}
										value="rarely"
										class="mr-3"
										id="monitoring-rarely"
									/>
									<span class="text-gray-900 dark:text-white">Rarely</span>
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										bind:group={parentLLMMonitoringLevel}
										value="never"
										class="mr-3"
										id="monitoring-never"
									/>
									<span class="text-gray-900 dark:text-white">Never</span>
								</label>
							</div>
							{#if parentLLMMonitoringLevel === 'other'}
								<input
									type="text"
									bind:value={parentLLMMonitoringOther}
									placeholder="Please specify"
									class="w-full mt-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
								/>
							{/if}
						</div>

						<!-- Attention Check: Duplicate Questions -->
						<div class="border-t-2 border-blue-300 dark:border-blue-600 pt-8 mt-8">
							<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
								Attention Check Questions
							</h3>
							<p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
								Please answer these questions again to help us verify your responses.
							</p>

							<!-- Duplicate: Has This Child Used ChatGPT -->
							<div class="mb-6">
								<div class="block text-lg font-medium text-gray-900 dark:text-white mb-3">
									Has this child used ChatGPT or similar AI tools? (Please answer again)
									<span class="text-red-500">*</span>
								</div>
								<div class="space-y-2">
									<label class="flex items-center">
										<input
											type="radio"
											bind:group={childHasAIUseCheck}
											value="yes"
											class="mr-3"
											id="child-ai-use-check-yes"
										/>
										<span class="text-gray-900 dark:text-white">Yes</span>
									</label>
									<label class="flex items-center">
										<input
											type="radio"
											bind:group={childHasAIUseCheck}
											value="no"
											class="mr-3"
											id="child-ai-use-check-no"
										/>
										<span class="text-gray-900 dark:text-white">No</span>
									</label>
								</div>
							</div>

							<!-- Duplicate: Have You Monitored or Adjusted -->
							<div>
								<div class="block text-lg font-medium text-gray-900 dark:text-white mb-3">
									Have you monitored or adjusted your child's use of ChatGPT or similar AI tools?
									(Please answer again) <span class="text-red-500">*</span>
								</div>
								<div class="space-y-2">
									<label class="flex items-center">
										<input
											type="radio"
											bind:group={parentLLMMonitoringCheck}
											value="always"
											class="mr-3"
											id="monitoring-check-always"
										/>
										<span class="text-gray-900 dark:text-white">Always</span>
									</label>
									<label class="flex items-center">
										<input
											type="radio"
											bind:group={parentLLMMonitoringCheck}
											value="often"
											class="mr-3"
											id="monitoring-check-often"
										/>
										<span class="text-gray-900 dark:text-white">Often</span>
									</label>
									<label class="flex items-center">
										<input
											type="radio"
											bind:group={parentLLMMonitoringCheck}
											value="sometimes"
											class="mr-3"
											id="monitoring-check-sometimes"
										/>
										<span class="text-gray-900 dark:text-white">Sometimes</span>
									</label>
									<label class="flex items-center">
										<input
											type="radio"
											bind:group={parentLLMMonitoringCheck}
											value="rarely"
											class="mr-3"
											id="monitoring-check-rarely"
										/>
										<span class="text-gray-900 dark:text-white">Rarely</span>
									</label>
									<label class="flex items-center">
										<input
											type="radio"
											bind:group={parentLLMMonitoringCheck}
											value="never"
											class="mr-3"
											id="monitoring-check-never"
										/>
										<span class="text-gray-900 dark:text-white">Never</span>
									</label>
								</div>
							</div>
						</div>

						<!-- Submit Button -->
						<div class="flex justify-end pt-6">
							<button
								type="submit"
								class="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-8 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
							>
								Submit Survey
							</button>
						</div>
					</form>
				</div>
			{/if}
		</div>
	</div>

	<!-- Confirmation Modal for Workflow Progression -->
	{#if showConfirmationModal}
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
		<div
			class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
			on:click={() => (showConfirmationModal = false)}
			on:keydown={(e) => e.key === 'Escape' && (showConfirmationModal = false)}
			role="dialog"
			aria-modal="true"
			aria-labelledby="confirmation-modal-title"
		>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div
				class="bg-white dark:bg-gray-800 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl"
				on:click|stopPropagation
			>
				<div class="text-center mb-6">
					<div
						class="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4"
					>
						<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 13l4 4L19 7"
							></path>
						</svg>
					</div>
					<h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Task 3 Complete</h3>
					<p class="text-gray-600 dark:text-gray-400">
						Would you like to proceed to the completion page?
					</p>
				</div>

				<div class="flex flex-col space-y-3">
					<button
						on:click={proceedToNextStep}
						class="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
					>
						Yes, Proceed to Completion
					</button>
					<button
						on:click={continueEditing}
						class="px-6 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
					>
						No, Continue Editing
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Assignment Time Tracker -->
	<AssignmentTimeTracker userId={get(user)?.id || ''} {sessionNumber} enabled={true} />

	<!-- Help Video Modal -->
	<VideoModal
		isOpen={showHelpVideo}
		videoSrc="/video/Exit-Survey-Demo.mp4"
		title="Exit Survey Tutorial"
	/>

	<!-- Child Information Modal -->
	{#if showChildInfoModal}
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
		<div
			class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
			on:click={() => (showChildInfoModal = false)}
			on:keydown={(e) => e.key === 'Escape' && (showChildInfoModal = false)}
			role="dialog"
			aria-modal="true"
			aria-labelledby="child-info-modal-title"
		>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div
				class="bg-white dark:bg-gray-800 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl"
				on:click|stopPropagation
			>
				<div class="flex justify-between items-center mb-6">
					<h3 id="child-info-modal-title" class="text-2xl font-bold text-gray-900 dark:text-white">
						Child Information
					</h3>
					<button
						on:click={() => (showChildInfoModal = false)}
						class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
						aria-label="Close modal"
					>
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							></path>
						</svg>
					</button>
				</div>
				<div class="space-y-4">
					<div>
						<label
							for="modal-child-name"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
						>
							Name
						</label>
						<input
							type="text"
							id="modal-child-name"
							bind:value={childInfoData.name}
							readonly
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white cursor-not-allowed"
						/>
					</div>
					<div>
						<label
							for="modal-child-age"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
						>
							Age
						</label>
						<input
							type="text"
							id="modal-child-age"
							bind:value={childInfoData.age}
							readonly
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white cursor-not-allowed"
						/>
					</div>
					<div>
						<label
							for="modal-child-gender"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
						>
							Gender
						</label>
						<input
							type="text"
							id="modal-child-gender"
							bind:value={childInfoData.gender}
							readonly
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white cursor-not-allowed"
						/>
					</div>
				</div>
				<div class="mt-6 flex justify-end">
					<button
						on:click={() => (showChildInfoModal = false)}
						class="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
					>
						Close
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
