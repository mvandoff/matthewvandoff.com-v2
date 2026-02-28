import type { PointerEventNames } from './timelineWave';

const LINE_LIT_VAR = '--timeline-line-lit';

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
	}

	function handleEnter(event: PointerEvent | MouseEvent) {
		const target = event.currentTarget as HTMLElement | null;
		if (!target) return;
		const litHeight = Math.max(0, timelineContainerEl.clientHeight - target.offsetTop);
		timelineContainerEl.style.setProperty(LINE_LIT_VAR, `${litHeight - 1}px`);
	}

	function handleLeave() {
		reset();
	}

	return { bindHandlers, reset };
}
