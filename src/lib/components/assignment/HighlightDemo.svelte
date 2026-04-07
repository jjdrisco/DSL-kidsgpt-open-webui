<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	let container: HTMLDivElement;
	let chatArea: HTMLDivElement;
	let cursorEl: HTMLDivElement;
	let promptSpan: HTMLSpanElement;
	let responseSpan: HTMLSpanElement;

	let animationFrame: number;
	let animationTimer: ReturnType<typeof setTimeout>;

	// Animation phases and timing (ms)
	const TOTAL_DURATION = 8000;
	const phases = [
		{ name: 'fadeIn', start: 0, end: 500 },
		{ name: 'moveToPromptStart', start: 500, end: 1200 },
		{ name: 'dragPrompt', start: 1200, end: 2400 },
		{ name: 'pausePrompt', start: 2400, end: 3200 },
		{ name: 'moveToResponseStart', start: 3200, end: 4200 },
		{ name: 'dragResponse', start: 4200, end: 5400 },
		{ name: 'pauseResponse', start: 5400, end: 6500 },
		{ name: 'fadeOut', start: 6500, end: 7200 },
		{ name: 'wait', start: 7200, end: 8000 }
	];

	function getSpanEdges(span: HTMLElement) {
		const rect = span.getBoundingClientRect();
		const areaRect = chatArea.getBoundingClientRect();
		return {
			startX: rect.left - areaRect.left,
			endX: rect.right - areaRect.left,
			centerY: rect.top - areaRect.top + rect.height / 2
		};
	}

	function lerp(a: number, b: number, t: number) {
		return a + (b - a) * t;
	}

	function easeInOut(t: number) {
		return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
	}

	let startTime: number;
	let promptHighlighted = false;
	let responseHighlighted = false;

	function animate(timestamp: number) {
		if (!startTime) startTime = timestamp;
		const elapsed = (timestamp - startTime) % TOTAL_DURATION;

		if (!container || !cursorEl || !promptSpan || !responseSpan) {
			animationFrame = requestAnimationFrame(animate);
			return;
		}

		// Reset highlights at loop start
		if (elapsed < 100) {
			promptHighlighted = false;
			responseHighlighted = false;
			promptSpan.style.backgroundColor = 'transparent';
			responseSpan.style.backgroundColor = 'transparent';
		}

		const prompt = getSpanEdges(promptSpan);
		const response = getSpanEdges(responseSpan);

		let x = 0,
			y = 0,
			opacity = 0;

		if (elapsed < phases[0].end) {
			// fadeIn: appear at center
			const t = elapsed / phases[0].end;
			x = (prompt.startX + prompt.endX) / 2;
			y = prompt.centerY;
			opacity = t;
		} else if (elapsed < phases[1].end) {
			// moveToPromptStart
			const t = easeInOut((elapsed - phases[1].start) / (phases[1].end - phases[1].start));
			const fromX = (prompt.startX + prompt.endX) / 2;
			x = lerp(fromX, prompt.startX, t);
			y = prompt.centerY;
			opacity = 1;
		} else if (elapsed < phases[2].end) {
			// dragPrompt
			const t = easeInOut((elapsed - phases[2].start) / (phases[2].end - phases[2].start));
			x = lerp(prompt.startX, prompt.endX, t);
			y = prompt.centerY;
			opacity = 1;
			// Progressively highlight
			promptSpan.style.backgroundColor = `color-mix(in srgb, var(--highlight-color-prompt) ${Math.round(t * 100)}%, transparent)`;
		} else if (elapsed < phases[3].end) {
			// pausePrompt
			x = prompt.endX;
			y = prompt.centerY;
			opacity = 1;
			if (!promptHighlighted) {
				promptSpan.style.backgroundColor = 'var(--highlight-color-prompt)';
				promptHighlighted = true;
			}
		} else if (elapsed < phases[4].end) {
			// moveToResponseStart
			const t = easeInOut((elapsed - phases[4].start) / (phases[4].end - phases[4].start));
			x = lerp(prompt.endX, response.startX, t);
			y = lerp(prompt.centerY, response.centerY, t);
			opacity = 1;
		} else if (elapsed < phases[5].end) {
			// dragResponse
			const t = easeInOut((elapsed - phases[5].start) / (phases[5].end - phases[5].start));
			x = lerp(response.startX, response.endX, t);
			y = response.centerY;
			opacity = 1;
			responseSpan.style.backgroundColor = `color-mix(in srgb, var(--highlight-color) ${Math.round(t * 100)}%, transparent)`;
		} else if (elapsed < phases[6].end) {
			// pauseResponse
			x = response.endX;
			y = response.centerY;
			opacity = 1;
			if (!responseHighlighted) {
				responseSpan.style.backgroundColor = 'var(--highlight-color)';
				responseHighlighted = true;
			}
		} else if (elapsed < phases[7].end) {
			// fadeOut
			const t = (elapsed - phases[7].start) / (phases[7].end - phases[7].start);
			x = response.endX;
			y = response.centerY;
			opacity = 1 - t;
			// Fade highlights too
			const highlightOpacity = 1 - t;
			promptSpan.style.backgroundColor = `color-mix(in srgb, var(--highlight-color-prompt) ${Math.round(highlightOpacity * 100)}%, transparent)`;
			responseSpan.style.backgroundColor = `color-mix(in srgb, var(--highlight-color) ${Math.round(highlightOpacity * 100)}%, transparent)`;
		} else {
			// wait
			opacity = 0;
			promptSpan.style.backgroundColor = 'transparent';
			responseSpan.style.backgroundColor = 'transparent';
		}

		cursorEl.style.transform = `translate(${x}px, ${y}px)`;
		cursorEl.style.opacity = String(opacity);

		animationFrame = requestAnimationFrame(animate);
	}

	onMount(() => {
		// Check for reduced motion preference
		const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (prefersReducedMotion) {
			promptSpan.style.backgroundColor = 'var(--highlight-color-prompt)';
			responseSpan.style.backgroundColor = 'var(--highlight-color)';
			cursorEl.style.display = 'none';
			return;
		}

		// Small delay to let layout settle
		animationTimer = setTimeout(() => {
			animationFrame = requestAnimationFrame(animate);
		}, 200);
	});

	onDestroy(() => {
		if (animationFrame) cancelAnimationFrame(animationFrame);
		if (animationTimer) clearTimeout(animationTimer);
	});
</script>

<div
	bind:this={container}
	class="highlight-demo border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-8 bg-white dark:bg-gray-850 relative overflow-hidden select-none"
	role="img"
	aria-label="Animation demonstrating how to highlight text in both the child's prompt and the AI response by clicking and dragging"
	aria-hidden="true"
	style="pointer-events: none;"
>
	<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
		How highlighting works
	</p>

	<!-- Mock chat interface -->
	<div bind:this={chatArea} class="flex flex-col gap-3 relative">
		<!-- Child Prompt Bubble (right-aligned) -->
		<div class="flex justify-end">
			<div class="max-w-[80%] bg-blue-500 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
				<p class="text-sm whitespace-pre-wrap">
					How do I make a <span bind:this={promptSpan} class="highlight-span"
						>volcano for my science fair</span
					> project?
				</p>
			</div>
		</div>

		<!-- AI Response Bubble (left-aligned) -->
		<div class="flex justify-start">
			<div
				class="max-w-[80%] bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm"
			>
				<p class="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
					Great question! You can build a volcano using <span
						bind:this={responseSpan}
						class="highlight-span">baking soda and vinegar</span
					>. Mix them together and watch the eruption!
				</p>
			</div>
		</div>

		<!-- Animated Cursor -->
		<div bind:this={cursorEl} class="cursor-el">
			<svg
				width="16"
				height="20"
				viewBox="0 0 16 20"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M1 1L1 14.5L4.5 11.5L7.5 18L10 17L7 10.5L11.5 10.5L1 1Z"
					fill="white"
					stroke="black"
					stroke-width="1.5"
					stroke-linejoin="round"
				/>
			</svg>
		</div>
	</div>

	<!-- Caption -->
	<p class="text-xs text-gray-400 dark:text-gray-500 mt-3 text-center italic">
		You can highlight text in both the child's message and the AI response
	</p>
</div>

<style>
	.highlight-demo {
		--highlight-color: #fef08a;
		--highlight-color-prompt: rgba(254, 240, 138, 0.85);
	}

	:global(.dark) .highlight-demo {
		--highlight-color: #92400e;
		--highlight-color-prompt: rgba(146, 64, 14, 0.85);
	}

	.highlight-span {
		border-radius: 2px;
		padding: 0 2px;
		background-color: transparent;
		transition: background-color 0.05s;
	}

	.cursor-el {
		position: absolute;
		top: 0;
		left: 0;
		opacity: 0;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
		z-index: 10;
		will-change: transform, opacity;
	}
</style>
