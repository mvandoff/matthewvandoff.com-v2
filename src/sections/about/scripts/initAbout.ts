import {
	createTimelineWaveController,
	type BlockCoords,
	type GridBounds,
	type PointerEventNames,
	type WaveTimings,
} from './timelineWave';
import { initAboutScrollDistortion } from './aboutScrollDistortion';
import { initDebugGridToggle } from './debugGridToggle';

type BlockTimings = { fadeInMs: number; fadeOutMs: number; holdMs: number };
type BlockState = { holdTimeoutId: number | null; activatedAt: number };

export function initAbout() {
	/**
	 * About background blocks:
	 * - The About page creates a block grid overlay used for the mouse trail effect.
	 * - The grid is sized to the About section instead of the full document.
	 */
	const blockContainerEl = document.getElementById('block-grid');
	if (!blockContainerEl) throw new Error('#block-grid element not found');
	// Capture non-null ref for use inside callbacks (TS won’t narrow captured variables).
	const blockContainer = blockContainerEl;
	const aboutSectionEl = document.querySelector<HTMLElement>('#about');
	if (!aboutSectionEl) throw new Error('#about element not found');
	const aboutSection = aboutSectionEl;
	const mainNav = document.querySelector<HTMLElement>('#main-nav')!;
	const aboutMeDistortEl = document.querySelector<HTMLElement>('#about [data-scroll-distort="me"]');
	const aboutScrollTurbulenceEl = document.querySelector<SVGFETurbulenceElement>('#about-scroll-turbulence');
	const aboutScrollDisplacementEl = document.querySelector<SVGFEDisplacementMapElement>('#about-scroll-displacement');
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
		 * - Calculate grid columns/rows from the About section dimensions.
		 * - Replace all block elements (mouse trail + wave propagation targets).
		 */
		clearAllBlockTimers(blockStates);
		timelineWave.clearAllTimers();
		timings = getBlockTimingsFromCss(blockContainer, defaultTimings);
		waveTimings = getWaveTimingsFromCss(blockContainer, defaultWaveTimings);
		blockSizePx = getBlockSizePxFromCss(blockContainer, blockSizePx);

		const aboutRect = aboutSection.getBoundingClientRect();
		const targetWidth = Math.max(aboutSection.scrollWidth, aboutSection.clientWidth, aboutRect.width);
		const targetHeight = Math.max(aboutSection.scrollHeight, aboutSection.clientHeight, aboutRect.height);
		const baseColumns = Math.max(1, Math.ceil(targetWidth / blockSizePx));
		rows = Math.max(1, Math.ceil(targetHeight / blockSizePx));

		const baseWidthPx = Math.round(targetWidth);
		const heightPx = Math.round(targetHeight);

		let extraColumns = 0;
		let widthPx = baseWidthPx;
		let leftPx = aboutRect.left;
		const viewportWidth = document.documentElement.clientWidth;
		const spaceLeft = aboutRect.left;
		const spaceRight = viewportWidth - aboutRect.right;

		// When the About section hits its max width, it is centered and leaves extra room on both sides.
		// Add full block columns to each side (same count) so the grid expands outward while the About
		// content stays aligned to grid lines. Any leftover pixels become equal gaps at the edges.
		if (spaceLeft > 0 && spaceRight > 0) {
			const extraColumnsPerSide = Math.floor(Math.min(spaceLeft, spaceRight) / blockSizePx);
			if (extraColumnsPerSide > 0) {
				extraColumns = extraColumnsPerSide;
				widthPx = baseWidthPx + extraColumns * blockSizePx * 2;
				leftPx = aboutRect.left - extraColumns * blockSizePx;
			}
		}

		columns = baseColumns + extraColumns * 2;

		blockContainer.style.gridTemplateColumns = `repeat(${columns}, ${blockSizePx}px)`;
		blockContainer.style.gridTemplateRows = `repeat(${rows}, ${blockSizePx}px)`;
		blockContainer.style.width = `${widthPx}px`;
		blockContainer.style.height = `${heightPx}px`;

		if (!aboutSection.contains(blockContainer)) {
			const top = aboutRect.top + window.scrollY;
			const left = leftPx + window.scrollX;
			blockContainer.style.top = `${Math.round(top)}px`;
			blockContainer.style.left = `${Math.round(left)}px`;
		}

		// Calculate the total number of blocks needed
		const totalBlocks = columns * rows;

		blocks = createBlocks(totalBlocks);
		const debugLabels = createDebugLabelOverlay({ columns, rows, blockSizePx, widthPx, heightPx });
		blockContainer.replaceChildren(...blocks, debugLabels);
	}

	/**
	 * Initial build:
	 * - We do this immediately on DOMContentLoaded (see About.astro).
	 * - The Transition overlay is still covering the page at this moment, which is what we want.
	 */
	initDebugGridToggle({ container: blockContainer });
	rebuildGrid();

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
			const block = blocks[coords.index];
			if (block) triggerBlockHover(block, blockStates, timings);
			lastIndex = coords.index;
		});
	}

	const navRect = mainNav.getBoundingClientRect();
	function handlePointerMove(e: PointerEvent | MouseEvent) {
		if (navRect.height > 0 && e.clientY >= navRect.top && e.clientY <= navRect.bottom) {
			lastIndex = null;
			return;
		}
		// Use the block grid bounds (not just #about) so the trail works in the extra columns
		// that extend into the left/right gutters on wide viewports.
		const rect = blockContainer.getBoundingClientRect();
		if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
			lastIndex = null;
			return;
		}
		pendingClientX = e.clientX;
		pendingClientY = e.clientY;
		schedulePointerUpdate();
	}

	document.addEventListener(pointerEvents.move, handlePointerMove, { passive: true });

	const resizeDebounceMs = 150;
	let resizeTimeoutId: number | null = null;
	window.addEventListener('resize', () => {
		/**
		 * Resize handling:
		 * - Rebuilds the grid for the new size.
		 * - Debounced to avoid doing work on every resize event tick.
		 */
		if (resizeTimeoutId) window.clearTimeout(resizeTimeoutId);
		resizeTimeoutId = window.setTimeout(() => {
			resizeTimeoutId = null;
			lastIndex = null;
			rebuildGrid();
		}, resizeDebounceMs);
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

function createDebugLabelOverlay(params: {
	columns: number;
	rows: number;
	blockSizePx: number;
	widthPx: number;
	heightPx: number;
}) {
	const { columns, rows, blockSizePx, widthPx, heightPx } = params;
	const overlay = document.createElement('div');
	overlay.className = 'bg-grid-debug';

	const colLabels = document.createElement('div');
	colLabels.className = 'bg-grid-debug-cols';
	colLabels.style.gridTemplateColumns = `repeat(${columns}, ${blockSizePx}px)`;
	colLabels.style.gridTemplateRows = `${blockSizePx}px`;
	colLabels.style.top = `${blockSizePx}px`;
	colLabels.style.width = `${widthPx}px`;
	colLabels.style.height = `${blockSizePx}px`;

	for (let col = 0; col < columns; col += 1) {
		const label = document.createElement('div');
		label.className = 'bg-grid-debug-label';
		label.textContent = String(col);
		colLabels.append(label);
	}

	const rowLabels = document.createElement('div');
	rowLabels.className = 'bg-grid-debug-rows';
	rowLabels.style.gridTemplateColumns = `${blockSizePx}px`;
	rowLabels.style.gridTemplateRows = `repeat(${rows}, ${blockSizePx}px)`;
	rowLabels.style.width = `${blockSizePx}px`;
	rowLabels.style.height = `${heightPx}px`;

	for (let row = 0; row < rows; row += 1) {
		const label = document.createElement('div');
		label.className = 'bg-grid-debug-label';
		label.textContent = String(row);
		rowLabels.append(label);
	}

	overlay.append(colLabels, rowLabels);
	return overlay;
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
