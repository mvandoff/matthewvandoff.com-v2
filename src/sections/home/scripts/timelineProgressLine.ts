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
	trackingEl: Document | HTMLElement;
	isSafari?: boolean;
}) {
	const { timelineBlocks, timelineContainerEl, trackingEl, isSafari = false } = params;
	const timelineLineGrid = timelineContainerEl.querySelector<HTMLElement>(LINE_GRID_SELECTOR);
	if (!timelineLineGrid) throw new Error('.timeline-line-grid element not found');
	const timelineLineGridEl = timelineLineGrid;
	const timelineBlockIndexMap = new Map(timelineBlocks.map((timelineBlock, index) => [timelineBlock, index]));
	const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
	let lineStepMs = DEFAULT_LINE_STEP_MS;
	let miniBlocks: HTMLDivElement[] = [];
	let activeCount = 0;
	let targetCount = 0;
	let stepRafId: number | null = null;
	let lastStepTs = 0;
	let hoverPollRafId: number | null = null;
	let activeTimelineBlock: HTMLElement | null = null;

	rebuild();

	function bindHandlers(events: PointerEventNames) {
		for (const timelineBlock of timelineBlocks) {
			timelineBlock.addEventListener(events.enter, handleEnter);
			if (events.enter !== 'mouseenter') timelineBlock.addEventListener('mouseenter', handleEnter);
		}
		trackingEl.addEventListener(events.move, handleTrackingMoveEvent, { passive: true, capture: true });
		if (events.move !== 'mousemove') {
			trackingEl.addEventListener('mousemove', handleTrackingMoveEvent, { passive: true, capture: true });
		}
		timelineContainerEl.addEventListener(events.leave, handleLeave);
		if (events.leave !== 'mouseleave') timelineContainerEl.addEventListener('mouseleave', handleLeave);
	}

	function reset() {
		stopHoverMonitor();
		activeTimelineBlock = null;
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
			if (isSafari) {
				block.style.transition = 'none';
				block.style.opacity = '0';
			}
			return block;
		});
		timelineLineGridEl.replaceChildren(...miniBlocks);

		stopHoverMonitor();
		activeTimelineBlock = null;
		setTargetCount(0, true);
	}

	function handleEnter(event: PointerEvent | MouseEvent) {
		const target = event.currentTarget as HTMLElement | null;
		if (!target) return;
		activateTimelineBlock(target);
	}

	function handleTrackingMove(event: PointerEvent | MouseEvent) {
		const pointTimelineBlock = getTimelineBlockFromPoint(event.clientX, event.clientY);
		if (!pointTimelineBlock) {
			activateTimelineBlock(null);
			return;
		}
		activateTimelineBlock(pointTimelineBlock);
	}

	function handleTrackingMoveEvent(event: Event) {
		if (!(event instanceof MouseEvent || event instanceof PointerEvent)) return;
		handleTrackingMove(event);
	}

	function handleLeave() {
		activateTimelineBlock(null);
	}

	function activateTimelineBlock(nextTimelineBlock: HTMLElement | null) {
		if (activeTimelineBlock === nextTimelineBlock) return;
		activeTimelineBlock = nextTimelineBlock;
		if (!nextTimelineBlock) {
			stopHoverMonitor();
			setTargetCount(0);
			clearChronoDim();
			return;
		}
		startHoverMonitor();
		const activeIndex = timelineBlockIndexMap.get(nextTimelineBlock);
		if (activeIndex === undefined) return;
		const nextTargetCount = (timelineBlocks.length - activeIndex) * MINI_BLOCKS_PER_TIMELINE_BLOCK;
		setTargetCount(nextTargetCount);
		applyChronoDim(nextTimelineBlock);
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
		if (stepRafId !== null) return;
		lastStepTs = 0;
		stepRafId = window.requestAnimationFrame(stepLine);
	}

	function stepLine(timestamp: number) {
		stepRafId = null;
		if (activeCount === targetCount) {
			return;
		}

		if (lastStepTs === 0 || timestamp - lastStepTs >= lineStepMs) {
			activeCount += activeCount < targetCount ? 1 : -1;
			lastStepTs = timestamp;
			renderBlocks();
		}
		stepRafId = window.requestAnimationFrame(stepLine);
	}

	function clearStepTimer() {
		if (stepRafId === null) return;
		window.cancelAnimationFrame(stepRafId);
		stepRafId = null;
		lastStepTs = 0;
	}

	function renderBlocks() {
		for (let index = 0; index < miniBlocks.length; index += 1) {
			const block = miniBlocks[index];
			if (isSafari) {
				block.style.opacity = index < activeCount ? '1' : '0';
				continue;
			}
			block.classList.toggle('is-lit', index < activeCount);
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

	function getTimelineBlockFromPoint(clientX: number, clientY: number) {
		for (const timelineBlock of timelineBlocks) {
			const rect = timelineBlock.getBoundingClientRect();
			if (clientX < rect.left || clientX > rect.right) continue;
			if (clientY < rect.top || clientY > rect.bottom) continue;
			return timelineBlock;
		}
		return null;
	}

	function startHoverMonitor() {
		if (hoverPollRafId !== null) return;
		hoverPollRafId = window.requestAnimationFrame(pollHoveredTimelineBlock);
	}

	function stopHoverMonitor() {
		if (hoverPollRafId === null) return;
		window.cancelAnimationFrame(hoverPollRafId);
		hoverPollRafId = null;
	}

	function pollHoveredTimelineBlock() {
		hoverPollRafId = null;
		if (!activeTimelineBlock) return;
		const hoveredTimelineBlock = getHoveredTimelineBlock();
		if (hoveredTimelineBlock !== activeTimelineBlock) {
			activateTimelineBlock(hoveredTimelineBlock);
		}
		if (activeTimelineBlock) {
			hoverPollRafId = window.requestAnimationFrame(pollHoveredTimelineBlock);
		}
	}

	function getHoveredTimelineBlock() {
		for (const timelineBlock of timelineBlocks) {
			if (timelineBlock.matches(':hover')) return timelineBlock;
		}
		return null;
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
