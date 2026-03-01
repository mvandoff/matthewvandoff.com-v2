import type { PointerEventNames } from './timelineWave';

const LINE_GRID_SELECTOR = '.timeline-line-grid';
const LINE_MINI_BLOCK_CLASS = 'timeline-line-mini-block';
const LINE_STEP_MS_VAR = '--timeline-line-step';
const MINI_BLOCKS_PER_TIMELINE_BLOCK = 6;
const DEFAULT_LINE_STEP_MS = 30;
const CHRONO_DIM_VAR = '--tl-chrono-dim-strength';
const CHRONO_MINI_GRID_VAR = '--tl-mini-static-opacity';
const CHRONO_MINI_BORDER_VAR = '--tl-mini-static-border-strength';
const CHRONO_DIM_MAX = 4;
const CHRONO_DIM_MIN = 2;
const CHRONO_MINI_GRID_MAX = 0.18;
const CHRONO_MINI_GRID_MIN = 0.1;
const CHRONO_MINI_BORDER_MAX = 8;
const CHRONO_MINI_BORDER_MIN = 6;

/**
 * Drives the timeline connector "progress" line.
 * The lit segment grows bottom->top from the oldest item toward newer items.
 */
export function createTimelineProgressLineController(params: {
	timelineBlocks: HTMLElement[];
	timelineContainerEl: HTMLElement;
}) {
	const { timelineBlocks, timelineContainerEl } = params;
	const timelineLineGrid = timelineContainerEl.querySelector<HTMLElement>(LINE_GRID_SELECTOR);
	if (!timelineLineGrid) throw new Error('.timeline-line-grid element not found');
	const timelineLineGridEl = timelineLineGrid;
	const timelineBlockIndexMap = new Map(timelineBlocks.map((timelineBlock, index) => [timelineBlock, index]));
	const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
	let lineStepMs = DEFAULT_LINE_STEP_MS;
	let miniBlocks: HTMLDivElement[] = [];
	let activeCount = 0;
	let targetCount = 0;
	let stepTimeoutId: number | null = null;

	rebuild();

	function bindHandlers(events: PointerEventNames) {
		for (const timelineBlock of timelineBlocks) {
			timelineBlock.addEventListener(events.enter, handleEnter);
		}
		timelineContainerEl.addEventListener(events.leave, handleLeave);
	}

	function reset() {
		setTargetCount(0, true);
		clearChronoDim();
	}

	function rebuild() {
		const computedStyle = window.getComputedStyle(timelineContainerEl);
		lineStepMs = parseCssTimeToMs(computedStyle.getPropertyValue(LINE_STEP_MS_VAR), DEFAULT_LINE_STEP_MS);
		const miniBlockCount = timelineBlocks.length * MINI_BLOCKS_PER_TIMELINE_BLOCK;
		miniBlocks = Array.from({ length: miniBlockCount }, () => {
			const block = document.createElement('div');
			block.classList.add(LINE_MINI_BLOCK_CLASS);
			return block;
		});
		timelineLineGridEl.replaceChildren(...miniBlocks);

		setTargetCount(0, true);
	}

	function handleEnter(event: PointerEvent | MouseEvent) {
		const target = event.currentTarget as HTMLElement | null;
		if (!target) return;
		const activeIndex = timelineBlockIndexMap.get(target);
		if (activeIndex === undefined) return;
		const nextTargetCount = (timelineBlocks.length - activeIndex) * MINI_BLOCKS_PER_TIMELINE_BLOCK;
		setTargetCount(nextTargetCount);
		applyChronoDim(target);
	}

	function handleLeave() {
		setTargetCount(0);
		clearChronoDim();
	}

	return { bindHandlers, rebuild, reset };

	function setTargetCount(nextTargetCount: number, instant = false) {
		targetCount = clamp(nextTargetCount, 0, miniBlocks.length);
		if (instant || reduceMotionQuery.matches) {
			clearStepTimer();
			activeCount = targetCount;
			renderBlocks();
			return;
		}
		runSteppedAnimation();
	}

	function runSteppedAnimation() {
		if (stepTimeoutId) return;
		stepLine();
	}

	function stepLine() {
		if (activeCount === targetCount) {
			stepTimeoutId = null;
			return;
		}

		activeCount += activeCount < targetCount ? 1 : -1;
		renderBlocks();
		stepTimeoutId = window.setTimeout(stepLine, lineStepMs);
	}

	function clearStepTimer() {
		if (!stepTimeoutId) return;
		window.clearTimeout(stepTimeoutId);
		stepTimeoutId = null;
	}

	function renderBlocks() {
		for (let index = 0; index < miniBlocks.length; index += 1) {
			miniBlocks[index].classList.toggle('is-lit', index < activeCount);
		}
	}

	function applyChronoDim(activeBlock: HTMLElement) {
		const activeIndex = timelineBlocks.indexOf(activeBlock);
		if (activeIndex === -1) return;
		const olderCount = timelineBlocks.length - activeIndex - 1;

		for (let index = 0; index < timelineBlocks.length; index += 1) {
			const block = timelineBlocks[index];
			const offsetFromActive = index - activeIndex;
			if (offsetFromActive <= 0) {
				block.style.setProperty(CHRONO_DIM_VAR, '0%');
				block.style.setProperty(CHRONO_MINI_GRID_VAR, '0');
				block.style.setProperty(CHRONO_MINI_BORDER_VAR, '0%');
				continue;
			}

			const progress = olderCount <= 1 ? 0 : (offsetFromActive - 1) / (olderCount - 1);
			const strength = lerp(CHRONO_DIM_MAX, CHRONO_DIM_MIN, progress);
			const miniGridOpacity = lerp(CHRONO_MINI_GRID_MAX, CHRONO_MINI_GRID_MIN, progress);
			const miniBorderStrength = lerp(CHRONO_MINI_BORDER_MAX, CHRONO_MINI_BORDER_MIN, progress);
			block.style.setProperty(CHRONO_DIM_VAR, `${strength.toFixed(2)}%`);
			block.style.setProperty(CHRONO_MINI_GRID_VAR, miniGridOpacity.toFixed(3));
			block.style.setProperty(CHRONO_MINI_BORDER_VAR, `${miniBorderStrength.toFixed(2)}%`);
		}
	}

	function clearChronoDim() {
		for (const block of timelineBlocks) {
			block.style.setProperty(CHRONO_DIM_VAR, '0%');
			block.style.setProperty(CHRONO_MINI_GRID_VAR, '0');
			block.style.setProperty(CHRONO_MINI_BORDER_VAR, '0%');
		}
	}
}

function lerp(start: number, end: number, progress: number) {
	return start + (end - start) * progress;
}

function parseCssTimeToMs(value: string, fallbackMs: number) {
	const trimmed = value.trim();
	if (!trimmed) return fallbackMs;
	const token = trimmed.split(/[,\s]/).find(Boolean);
	if (!token) return fallbackMs;

	const match = token.match(/^(-?\d*\.?\d+)(ms|s)$/);
	if (match) {
		const raw = Number(match[1]);
		if (!Number.isFinite(raw)) return fallbackMs;
		return Math.max(0, match[2] === 's' ? raw * 1000 : raw);
	}

	const raw = Number(token);
	return Number.isFinite(raw) ? Math.max(0, raw) : fallbackMs;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}
