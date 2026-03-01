import type { PointerEventNames } from './timelineWave';

const LINE_LIT_VAR = '--timeline-line-lit';
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

	function bindHandlers(events: PointerEventNames) {
		for (const timelineBlock of timelineBlocks) {
			timelineBlock.addEventListener(events.enter, handleEnter);
			timelineBlock.addEventListener(events.leave, handleLeave);
		}
	}

	function reset() {
		timelineContainerEl.style.setProperty(LINE_LIT_VAR, '0px');
		clearChronoDim();
	}

	function handleEnter(event: PointerEvent | MouseEvent) {
		const target = event.currentTarget as HTMLElement | null;
		if (!target) return;
		const litHeight = Math.max(0, timelineContainerEl.clientHeight - target.offsetTop);
		timelineContainerEl.style.setProperty(LINE_LIT_VAR, `${litHeight - 3}px`);
		applyChronoDim(target);
	}

	function handleLeave() {
		reset();
	}

	return { bindHandlers, reset };

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
