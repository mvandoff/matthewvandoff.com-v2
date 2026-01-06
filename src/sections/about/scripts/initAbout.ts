import {
	createTimelineWaveController,
	type BlockCoords,
	type GridBounds,
	type PointerEventNames,
	type WaveTimings,
} from './timelineWave';
import { markAboutLayoutReadyAfterPaint } from 'scripts/global/aboutLayoutReady';
import { initAboutScrollDistortion } from './aboutScrollDistortion';

type BlockTimings = { fadeInMs: number; fadeOutMs: number; holdMs: number };
type BlockState = { holdTimeoutId: number | null; activatedAt: number };

export function initAbout() {
	/**
	 * About background blocks:
	 * - The About page creates a fixed “block grid” overlay used for the mouse trail effect.
	 * - It also snaps key layout elements to that same grid so the design aligns to block edges.
	 *
	 * Important interaction with the global Transition:
	 * - The Transition overlay starts fully covering the screen on page load, then animates away.
	 * - The About grid + snapping work can cause layout shift while it runs.
	 * - To keep that shift from being visible, the Transition waits to start revealing the About
	 *   page until this script signals that layout is ready (see `markAboutLayoutReadyAfterPaint`).
	 */
	const blockContainerEl = document.getElementById('bg-blocks');
	if (!blockContainerEl) throw new Error('bg-blocks element not found');
	// Capture non-null ref for use inside callbacks (TS won’t narrow captured variables).
	const blockContainer = blockContainerEl;
	const aboutLeftEl = document.querySelector<HTMLElement>('#about .left');
	const aboutRightEl = document.querySelector<HTMLElement>('#about .right');
	const aboutMeDistortEl = document.querySelector<HTMLElement>('#about [data-scroll-distort="me"]');
	const aboutScrollTurbulenceEl = document.querySelector<SVGFETurbulenceElement>('#about-scroll-turbulence');
	const aboutScrollDisplacementEl = document.querySelector<SVGFEDisplacementMapElement>('#about-scroll-displacement');
	const timelineHeadingEl = document.querySelector<HTMLElement>('#tl > h3');
	const timelineFirstBlockEl = document.querySelector<HTMLElement>('#tl .tl-block');
	const timelineBlocks = Array.from(document.querySelectorAll<HTMLElement>('#tl .tl-block'));
	const pointerEvents = getPointerEventNames('PointerEvent' in window);

	let blocks: HTMLDivElement[] = [];
	let columns = 0;
	let rows = 0;
	let blockSizePx = 70;
	const defaultTimings: BlockTimings = { fadeInMs: 150, fadeOutMs: 3000, holdMs: 3000 };
	let timings = defaultTimings;
	const blockStates = new Map<HTMLDivElement, BlockState>();
	const defaultWaveTimings: WaveTimings = { fadeInMs: 250, fadeOutMs: 400, stepMs: 40 };
	let waveTimings = defaultWaveTimings;

	// Timeline hover effect:
	// When hovering a `.tl-block`, we light up the background grid blocks underneath it,
	// propagating outward from the pointer location as a “wave”.
	const timelineWave = createTimelineWaveController({
		blockContainerEl: blockContainer,
		timelineBlocks,
		getBlocks: () => blocks,
		getGridMetrics: () => ({ blockSizePx, columns, rows }),
		getBlockCoordsFromClient,
		getGridBoundsForElement,
		getWaveTimings: () => waveTimings,
	});

	function rebuildGrid() {
		/**
		 * Rebuild responsibilities:
		 * - Re-read CSS custom properties (block sizing + animation timings).
		 * - Calculate grid columns/rows from current document dimensions.
		 * - Replace all block elements (mouse trail + wave propagation targets).
		 * - Snap layout elements to the nearest grid line.
		 */
		clearAllBlockTimers(blockStates);
		timelineWave.clearAllTimers();
			timings = getBlockTimingsFromCss(blockContainer, defaultTimings);
			waveTimings = getWaveTimingsFromCss(blockContainer, defaultWaveTimings);
			blockSizePx = getBlockSizePxFromCss(blockContainer, blockSizePx);

		const targetWidth = Math.max(document.documentElement.clientWidth, document.body?.clientWidth ?? 0);
		const targetHeight = Math.max(
			document.documentElement.scrollHeight,
			document.body?.scrollHeight ?? 0,
			document.documentElement.clientHeight,
		);
		columns = Math.max(1, Math.ceil(targetWidth / blockSizePx));
		rows = Math.max(1, Math.ceil(targetHeight / blockSizePx));

			blockContainer.style.gridTemplateColumns = `repeat(${columns}, ${blockSizePx}px)`;
			blockContainer.style.gridTemplateRows = `repeat(${rows}, ${blockSizePx}px)`;

		// Calculate the total number of blocks needed
		const totalBlocks = columns * rows;

			blocks = createBlocks(totalBlocks);
			blockContainer.replaceChildren(...blocks);

		if (aboutLeftEl) {
			snapElementLeftToGrid({ gridSizePx: blockSizePx, element: aboutLeftEl });
		}
		if (aboutRightEl) {
			snapElementRightToGrid({ gridSizePx: blockSizePx, element: aboutRightEl });
		}
		if (timelineHeadingEl && timelineFirstBlockEl) {
			snapTimelineHeadingToGrid({
				gridSizePx: blockSizePx,
				heading: timelineHeadingEl,
				block: timelineFirstBlockEl,
			});
		} else if (timelineFirstBlockEl) {
			snapElementTopToGrid({ gridSizePx: blockSizePx, element: timelineFirstBlockEl });
		}
	}

	/**
	 * Initial build:
	 * - We do this immediately on DOMContentLoaded (see About.astro).
	 * - The Transition overlay is still covering the page at this moment, which is what we want.
	 */
	rebuildGrid();

	/**
	 * Signal “layout ready” only after the snapped layout has been painted at least once.
	 * This ensures the transition reveal won't expose intermediate layout shifts.
	 */
	markAboutLayoutReadyAfterPaint();

	// Scroll-driven image distortion (SVG filter + CSS blur) for the headshot.
	initAboutScrollDistortion({
		meDistortEl: aboutMeDistortEl,
		turbulenceEl: aboutScrollTurbulenceEl,
		displacementEl: aboutScrollDisplacementEl,
		getBlockSizePx: () => blockSizePx,
	});

	if (timelineBlocks.length > 0) {
		timelineWave.bindHandlers(pointerEvents);
	}

	// The blocks overlay the page, but use `pointer-events: none` so all interactions
	// hit the real content. That means we can't use `mouseenter` on blocks; we light
	// a block by mapping pointer coordinates -> block index (throttled via rAF).
	let lastIndex: number | null = null;
	let raf = 0;
	let pendingClientX = 0;
	let pendingClientY = 0;

	function schedulePointerUpdate() {
		if (raf) return;
		raf = requestAnimationFrame(() => {
			raf = 0;
				const coords = getBlockCoordsFromClient({
					clientX: pendingClientX,
					clientY: pendingClientY,
					containerRect: blockContainer.getBoundingClientRect(),
					blockSizePx,
					columns,
					rows,
				});
			if (!coords) {
				if (lastIndex !== null) lastIndex = null;
				return;
			}
			if (coords.index !== lastIndex) {
				lastIndex = coords.index;
				const block = blocks[coords.index];
				if (block) triggerBlockHover(block, blockStates, timings);
			}
		});
	}

	function handlePointerMove(e: PointerEvent | MouseEvent) {
		// Don't trigger the About block trail while interacting with the fixed nav.
		// This prevents “block trails” showing behind nav items.
		const targetEl = e.target instanceof Element ? e.target : null;
		if (targetEl?.closest('#main-nav')) {
			lastIndex = null;
			return;
		}
		pendingClientX = e.clientX;
		pendingClientY = e.clientY;
		schedulePointerUpdate();
	}

	document.addEventListener(pointerEvents.move, handlePointerMove, { passive: true });

	let resizeRaf = 0;
	window.addEventListener('resize', () => {
		/**
		 * Resize handling:
		 * - Rebuilds the grid and re-snaps content.
		 * - Throttled via rAF to avoid doing work on every resize event tick.
		 */
		if (resizeRaf) return;
		resizeRaf = requestAnimationFrame(() => {
			resizeRaf = 0;
			lastIndex = null;
			rebuildGrid();
		});
	});
}

function getBlockTimingsFromCss(blockContainer: HTMLElement, fallback: BlockTimings): BlockTimings {
	const computedStyle = window.getComputedStyle(blockContainer);
	const fadeInMs = parseCssTimeToMs(computedStyle.getPropertyValue('--bg-block-fade-in'), fallback.fadeInMs);
	const fadeOutMs = parseCssTimeToMs(computedStyle.getPropertyValue('--bg-block-fade-out'), fallback.fadeOutMs);
	const holdMs = parseCssTimeToMs(computedStyle.getPropertyValue('--bg-block-hold'), fallback.holdMs);
	return { fadeInMs, fadeOutMs, holdMs };
}

function getWaveTimingsFromCss(blockContainer: HTMLElement, fallback: WaveTimings): WaveTimings {
	const computedStyle = window.getComputedStyle(blockContainer);
	const fadeInMs = parseCssTimeToMs(computedStyle.getPropertyValue('--bg-block-wave-fade-in'), fallback.fadeInMs);
	const fadeOutMs = parseCssTimeToMs(computedStyle.getPropertyValue('--bg-block-wave-fade-out'), fallback.fadeOutMs);
	const stepMs = parseCssTimeToMs(computedStyle.getPropertyValue('--bg-block-wave-step'), fallback.stepMs);
	return { fadeInMs, fadeOutMs, stepMs };
}

function getBlockSizePxFromCss(blockContainer: HTMLElement, fallbackPx: number): number {
	const computedStyle = window.getComputedStyle(blockContainer);
	const raw = computedStyle.getPropertyValue('--bg-block-size').trim();
	if (!raw) return fallbackPx;
	const match = raw.match(/^(-?\d*\.?\d+)px$/);
	if (!match) return fallbackPx;
	const value = Number(match[1]);
	return Number.isFinite(value) && value > 0 ? value : fallbackPx;
}

function clearAllBlockTimers(blockStates: Map<HTMLDivElement, BlockState>) {
	for (const { holdTimeoutId } of blockStates.values()) {
		if (holdTimeoutId) window.clearTimeout(holdTimeoutId);
	}
	blockStates.clear();
}

function triggerBlockHover(block: HTMLDivElement, blockStates: Map<HTMLDivElement, BlockState>, timings: BlockTimings) {
	const now = performance.now();
	const state = blockStates.get(block) ?? { holdTimeoutId: null, activatedAt: -Infinity };
	blockStates.set(block, state);

	if (!block.classList.contains('is-lit')) {
		block.classList.add('is-lit');
		state.activatedAt = now;
	}

	if (state.holdTimeoutId) window.clearTimeout(state.holdTimeoutId);
	const fadeRemainingMs = Math.max(0, timings.fadeInMs - (now - state.activatedAt));
	const holdDelayMs = fadeRemainingMs + timings.holdMs;
	state.holdTimeoutId = window.setTimeout(() => {
		state.holdTimeoutId = null;
		block.classList.remove('is-lit');
	}, holdDelayMs);
}

function createBlocks(totalBlocks: number) {
	return Array.from({ length: totalBlocks }, () => {
		const block = document.createElement('div') as HTMLDivElement;
		block.classList.add('bg-block');
		return block;
	});
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

function getPointerEventNames(usePointerEvents: boolean): PointerEventNames {
	return usePointerEvents
		? { enter: 'pointerenter', move: 'pointermove', leave: 'pointerleave' }
		: { enter: 'mouseenter', move: 'mousemove', leave: 'mouseleave' };
}

function getBlockCoordsFromClient(params: {
	clientX: number;
	clientY: number;
	containerRect: DOMRect;
	blockSizePx: number;
	columns: number;
	rows: number;
}): BlockCoords | null {
	const { clientX, clientY, containerRect, blockSizePx, columns, rows } = params;
	const x = clientX - containerRect.left;
	const y = clientY - containerRect.top;
	if (x < 0 || y < 0) return null;
	const col = Math.floor(x / blockSizePx);
	const row = Math.floor(y / blockSizePx);
	if (col < 0 || row < 0 || col >= columns || row >= rows) return null;
	return { index: row * columns + col, row, col };
}

function getGridBoundsForElement(params: {
	element: HTMLElement;
	containerRect: DOMRect;
	blockSizePx: number;
	columns: number;
	rows: number;
}): GridBounds | null {
	const { element, containerRect, blockSizePx, columns, rows } = params;
	const rect = element.getBoundingClientRect();
	const left = rect.left - containerRect.left;
	const right = rect.right - containerRect.left;
	const top = rect.top - containerRect.top;
	const bottom = rect.bottom - containerRect.top;
	const endOffset = 1;
	const rawColStart = Math.floor(left / blockSizePx);
	const rawColEnd = Math.floor((right - endOffset) / blockSizePx);
	const rawRowStart = Math.round(top / blockSizePx);
	const rawRowEnd = Math.floor((bottom - endOffset) / blockSizePx);

	if (rawColEnd < 0 || rawRowEnd < 0 || rawColStart >= columns || rawRowStart >= rows) return null;

	return {
		colStart: clamp(rawColStart, 0, columns - 1),
		colEnd: clamp(rawColEnd, 0, columns - 1),
		rowStart: clamp(rawRowStart, 0, rows - 1),
		rowEnd: clamp(rawRowEnd, 0, rows - 1),
	};
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function snapElementLeftToGrid(params: { gridSizePx: number; element: HTMLElement }) {
	const { gridSizePx, element } = params;
	if (!Number.isFinite(gridSizePx) || gridSizePx <= 0) return;

	const elementLeft = element.getBoundingClientRect().left;
	const currentMarginLeftPx = parsePx(window.getComputedStyle(element).marginLeft, 0);

	const snappedElementLeft = Math.round(elementLeft / gridSizePx) * gridSizePx;
	const snappedMarginLeft = currentMarginLeftPx + (snappedElementLeft - elementLeft);
	element.style.setProperty('--about-left-start', `${Math.round(snappedMarginLeft)}px`);
}

function snapElementRightToGrid(params: { gridSizePx: number; element: HTMLElement }) {
	const { gridSizePx, element } = params;
	if (!Number.isFinite(gridSizePx) || gridSizePx <= 0) return;

	const elementLeft = element.getBoundingClientRect().left;
	const computedStyle = window.getComputedStyle(element);
	const currentStartOffsetPx = parsePx(computedStyle.getPropertyValue('--about-right-start'), 0);

	const snappedElementLeft = Math.round(elementLeft / gridSizePx) * gridSizePx;
	const snappedStartOffset = currentStartOffsetPx + (snappedElementLeft - elementLeft);
	element.style.setProperty('--about-right-start', `${Math.round(snappedStartOffset)}px`);
}

function snapElementTopToGrid(params: { gridSizePx: number; element: HTMLElement }) {
	const { gridSizePx, element } = params;
	if (!Number.isFinite(gridSizePx) || gridSizePx <= 0) return;

	const elementTop = element.getBoundingClientRect().top + window.scrollY;
	const currentMarginTopPx = parsePx(window.getComputedStyle(element).marginTop, 0);

	const snappedElementTop = Math.ceil(elementTop / gridSizePx) * gridSizePx;
	const snappedMarginTop = currentMarginTopPx + (snappedElementTop - elementTop);
	element.style.marginTop = `${Math.round(snappedMarginTop)}px`;
}

function snapTimelineHeadingToGrid(params: { gridSizePx: number; heading: HTMLElement; block: HTMLElement }) {
	const { gridSizePx, heading, block } = params;
	if (!Number.isFinite(gridSizePx) || gridSizePx <= 0) return;

	const headingRect = heading.getBoundingClientRect();
	const blockRect = block.getBoundingClientRect();
	const headingMarginTopPx = parsePx(window.getComputedStyle(heading).marginTop, 0);
	const blockMarginTopPx = parsePx(window.getComputedStyle(block).marginTop, 0);

	const headingTop = headingRect.top + window.scrollY;
	const blockTop = blockRect.top + window.scrollY;
	const desiredBlockTop = Math.ceil(blockTop / gridSizePx) * gridSizePx;
	const headingRowTop = desiredBlockTop - gridSizePx;
	const desiredHeadingTop = headingRowTop + (gridSizePx - headingRect.height) / 2;

	const headingDelta = desiredHeadingTop - headingTop;
	const blockDelta = desiredBlockTop - blockTop - headingDelta;

	heading.style.marginTop = `${Math.round(headingMarginTopPx + headingDelta)}px`;
	block.style.marginTop = `${Math.round(blockMarginTopPx + blockDelta)}px`;
}

function parsePx(value: string, fallbackPx: number): number {
	const trimmed = value.trim();
	if (!trimmed) return fallbackPx;
	const match = trimmed.match(/^(-?\d*\.?\d+)px$/);
	if (!match) return fallbackPx;
	const raw = Number(match[1]);
	return Number.isFinite(raw) ? raw : fallbackPx;
}
