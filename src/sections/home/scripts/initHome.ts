import { createTimelineWaveController, type WaveTimings } from './timelineWave';
import { initHomeScrollDistortion } from './homeScrollDistortion';
import { initDebugGridToggle } from './debugGridToggle';
import { initTimelineEnterDistortion } from './timelineEnterDistortion';
import { createBlockTrailController } from './homeBlockTrail';
import {
	clearAllBlockTimers,
	createBlocks,
	createDebugLabelOverlay,
	getBlockCoordsFromClient,
	getBlockSizePxFromCss,
	getBlockTimingsFromCss,
	getGridBoundsForElement,
	getPointerEventNames,
	getWaveTimingsFromCss,
	type BlockState,
	type BlockTimings,
} from './homeBlockGrid';

const CLEANUP_KEY = '__homeResizeCleanup__' as const;

declare global {
	interface Window {
		__homeResizeCleanup__?: () => void;
	}
}

export function initHome() {
	// Home attaches a global `resize` listener; `DOMContentLoaded` + `astro:page-load` would otherwise double-bind.
	if (window[CLEANUP_KEY]) return;

	const homeSectionEl = document.querySelector<HTMLElement>('#home');
	if (!homeSectionEl) throw new Error('#home element not found');
	const homeSection = homeSectionEl;
	// Keep the right column aligned with the fixed left grid by resetting any restored scroll offset.
	homeSection.scrollTop = 0;
	homeSection.scrollLeft = 0;
	if (
		!window.matchMedia('(hover: hover) and (pointer: fine)').matches ||
		window.matchMedia('(prefers-reduced-motion: reduce)').matches
	)
		return;

	/**
	 * Home background blocks:
	 * - The Home page creates a block grid overlay used for the mouse trail effect.
	 * - The grid is sized to the Home section instead of the full document.
	 */
	const blockContainerEl = document.getElementById('block-grid');
	if (!blockContainerEl) throw new Error('#block-grid element not found');
	// Capture non-null ref for use inside callbacks (TS won’t narrow captured variables).
	const blockContainer = blockContainerEl;
	const homeContentEl = homeSectionEl.querySelector<HTMLElement>('#home-content');
	const homeContent = homeContentEl ?? homeSection;
	const mainNav = document.querySelector<HTMLElement>('#main-nav')!;
	const homeMeDistortEl = document.querySelector<HTMLElement>('#home [data-scroll-distort="me"]');
	const homeScrollTurbulenceEl = document.querySelector<SVGFETurbulenceElement>('#home-scroll-turbulence');
	const homeScrollDisplacementEl = document.querySelector<SVGFEDisplacementMapElement>('#home-scroll-displacement');
	const timelineBlocks = Array.from(homeSectionEl.querySelectorAll<HTMLElement>('.tl-block'));
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

	const blockTrail = createBlockTrailController({
		blockContainerEl: blockContainer,
		mainNavEl: mainNav,
		getBlocks: () => blocks,
		getGridMetrics: () => ({ blockSizePx, columns, rows }),
		getTimings: () => timings,
		getBlockStates: () => blockStates,
	});

	function rebuildGrid() {
		/**
		 * Rebuild responsibilities:
		 * - Re-read CSS custom properties (block sizing + animation timings).
		 * - Calculate grid columns/rows from the Home section dimensions.
		 * - Replace all block elements (mouse trail + wave propagation targets).
		 */
		clearAllBlockTimers(blockStates);
		timelineWave.clearAllTimers();
		timings = getBlockTimingsFromCss(blockContainer, defaultTimings);
		waveTimings = getWaveTimingsFromCss(blockContainer, defaultWaveTimings);
		blockSizePx = getBlockSizePxFromCss(blockContainer, blockSizePx);

		// Avoid measuring the existing grid as part of the section's scrollable height.
		const previousDisplay = blockContainer.style.display;
		blockContainer.style.display = 'none';

		const homeRect = homeSection.getBoundingClientRect();
		const contentRect = homeContent.getBoundingClientRect();
		const targetWidth = Math.max(homeContent.scrollWidth, homeContent.clientWidth, contentRect.width);
		const targetHeight = Math.max(homeSection.scrollHeight, homeSection.clientHeight, homeRect.height);

		blockContainer.style.display = previousDisplay;
		const baseColumns = Math.max(1, Math.ceil(targetWidth / blockSizePx));
		rows = Math.max(1, Math.ceil(targetHeight / blockSizePx));

		const baseWidthPx = Math.round(targetWidth);
		const heightPx = Math.round(targetHeight);

		let extraColumns = 0;
		let widthPx = baseWidthPx;
		let leftPx = contentRect.left;
		const viewportWidth = document.documentElement.clientWidth;
		const spaceLeft = contentRect.left;
		const spaceRight = viewportWidth - contentRect.right;

		// When the Home section hits its max width, it is centered and leaves extra room on both sides.
		// Add full block columns to each side (same count) so the grid expands outward while the Home
		// content stays aligned to grid lines. Any leftover pixels become equal gaps at the edges.
		if (spaceLeft > 0 && spaceRight > 0) {
			const extraColumnsPerSide = Math.floor(Math.min(spaceLeft, spaceRight) / blockSizePx);
			if (extraColumnsPerSide > 0) {
				extraColumns = extraColumnsPerSide;
				widthPx = baseWidthPx + extraColumns * blockSizePx * 2;
				leftPx = contentRect.left - extraColumns * blockSizePx;
			}
		}

		columns = baseColumns + extraColumns * 2;

		blockContainer.style.gridTemplateColumns = `repeat(${columns}, ${blockSizePx}px)`;
		blockContainer.style.gridTemplateRows = `repeat(${rows}, ${blockSizePx}px)`;
		blockContainer.style.width = `${widthPx}px`;
		blockContainer.style.height = `${heightPx}px`;

		const leftOffset = leftPx - homeRect.left;
		blockContainer.style.top = '0px';
		blockContainer.style.left = `${leftOffset}px`;

		// Calculate the total number of blocks needed
		const totalBlocks = columns * rows;

		blocks = createBlocks(totalBlocks);
		const debugLabels = createDebugLabelOverlay({ columns, rows, blockSizePx, widthPx, heightPx });
		blockContainer.replaceChildren(...blocks, debugLabels);
	}

	/**
	 * Initial build:
	 * - We do this immediately on DOMContentLoaded (see Home.astro).
	 * - The Transition overlay is still covering the page at this moment, which is what we want.
	 */
	initDebugGridToggle({ container: blockContainer });
	rebuildGrid();
	blockTrail.refreshIgnoreRects();

	// Scroll-driven image distortion (SVG filter + CSS blur) for the headshot.
	initHomeScrollDistortion({
		meDistortEl: homeMeDistortEl,
		turbulenceEl: homeScrollTurbulenceEl,
		displacementEl: homeScrollDisplacementEl,
		getBlockSizePx: () => blockSizePx,
		scrollContainer: homeSection,
	});

	if (timelineBlocks.length > 0) {
		timelineWave.bindHandlers(pointerEvents);
	}

	initTimelineEnterDistortion({
		timelineBlocks,
		enterEventName: pointerEvents.enter,
		getBlockSizePx: () => blockSizePx,
		durationMs: 1000,
	});

	// The blocks overlay the page, but use `pointer-events: none` so all interactions
	// hit the real content. That means we can't use `mouseenter` on blocks; we light
	// a block by mapping pointer coordinates -> block index (throttled via rAF).
	blockTrail.bindHandlers(pointerEvents);

	const resizeDebounceMs = 150;
	let resizeTimeoutId: number | null = null;
	const onResize = () => {
		/**
		 * Resize handling:
		 * - Rebuilds the grid for the new size.
		 * - Debounced to avoid doing work on every resize event tick.
		 */
		if (resizeTimeoutId) window.clearTimeout(resizeTimeoutId);
		resizeTimeoutId = window.setTimeout(() => {
			resizeTimeoutId = null;
			blockTrail.resetPointerState();
			rebuildGrid();
			blockTrail.refreshIgnoreRects();
		}, resizeDebounceMs);
	};
	window.addEventListener('resize', onResize);

	const cleanup = () => {
		if (resizeTimeoutId) window.clearTimeout(resizeTimeoutId);
		window.removeEventListener('resize', onResize);
		window[CLEANUP_KEY] = undefined;
	};
	window[CLEANUP_KEY] = cleanup;
	// Ensure this page instance detaches its listeners before Astro swaps DOM.
	document.addEventListener('astro:before-swap', cleanup, { once: true });
}
