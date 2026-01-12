import { createTimelineWaveController, type WaveTimings } from './timelineWave';
import { initAboutScrollDistortion } from './aboutScrollDistortion';
import { initDebugGridToggle } from './debugGridToggle';
import { createSocialLinkWaveController } from './socialLinkWave';
import { initTimelineEnterDistortion } from './timelineEnterDistortion';
import { createBlockTrailController } from './aboutBlockTrail';
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
} from './aboutBlockGrid';

export function initAbout() {
	const aboutSectionEl = document.querySelector<HTMLElement>('#about');
	if (!aboutSectionEl) throw new Error('#about element not found');
	const aboutSection = aboutSectionEl;
	// Keep the right column aligned with the fixed left grid by resetting any restored scroll offset.
	aboutSection.scrollTop = 0;
	aboutSection.scrollLeft = 0;
	if (
		!window.matchMedia('(hover: hover) and (pointer: fine)').matches ||
		window.matchMedia('(prefers-reduced-motion: reduce)').matches
	)
		return;

	/**
	 * About background blocks:
	 * - The About page creates a block grid overlay used for the mouse trail effect.
	 * - The grid is sized to the About section instead of the full document.
	 */
	const blockContainerEl = document.getElementById('block-grid');
	if (!blockContainerEl) throw new Error('#block-grid element not found');
	// Capture non-null ref for use inside callbacks (TS won’t narrow captured variables).
	const blockContainer = blockContainerEl;
	const aboutContentEl = aboutSectionEl.querySelector<HTMLElement>('.about-content');
	const aboutContent = aboutContentEl ?? aboutSection;
	const mainNav = document.querySelector<HTMLElement>('#main-nav')!;
	const aboutMeDistortEl = document.querySelector<HTMLElement>('#about [data-scroll-distort="me"]');
	const aboutScrollTurbulenceEl = document.querySelector<SVGFETurbulenceElement>('#about-scroll-turbulence');
	const aboutScrollDisplacementEl = document.querySelector<SVGFEDisplacementMapElement>('#about-scroll-displacement');
	const timelineBlocks = Array.from(aboutSectionEl.querySelectorAll<HTMLElement>('.tl-block'));
	const socialLinks = Array.from(aboutSectionEl.querySelectorAll<HTMLAnchorElement>('.social-link'));
	const hoverDistortTargets = [...timelineBlocks, ...socialLinks];
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

	const socialLinkWave = createSocialLinkWaveController({
		socialLinks,
		getWaveTimings: () => waveTimings,
		getSocialBlockSizePx: () => Math.max(8, Math.round(blockSizePx / 4)),
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
		 * - Calculate grid columns/rows from the About section dimensions.
		 * - Replace all block elements (mouse trail + wave propagation targets).
		 */
		clearAllBlockTimers(blockStates);
		timelineWave.clearAllTimers();
		socialLinkWave.clearAllTimers();
		timings = getBlockTimingsFromCss(blockContainer, defaultTimings);
		waveTimings = getWaveTimingsFromCss(blockContainer, defaultWaveTimings);
		blockSizePx = getBlockSizePxFromCss(blockContainer, blockSizePx);

		// Avoid measuring the existing grid as part of the section's scrollable height.
		const previousDisplay = blockContainer.style.display;
		blockContainer.style.display = 'none';

		const aboutRect = aboutSection.getBoundingClientRect();
		const contentRect = aboutContent.getBoundingClientRect();
		const targetWidth = Math.max(aboutContent.scrollWidth, aboutContent.clientWidth, contentRect.width);
		const targetHeight = Math.max(aboutSection.scrollHeight, aboutSection.clientHeight, aboutRect.height);

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

		// When the About section hits its max width, it is centered and leaves extra room on both sides.
		// Add full block columns to each side (same count) so the grid expands outward while the About
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

		const leftOffset = leftPx - aboutRect.left;
		blockContainer.style.top = '0px';
		blockContainer.style.left = `${leftOffset}px`;

		// Calculate the total number of blocks needed
		const totalBlocks = columns * rows;

		blocks = createBlocks(totalBlocks);
		const debugLabels = createDebugLabelOverlay({ columns, rows, blockSizePx, widthPx, heightPx });
		blockContainer.replaceChildren(...blocks, debugLabels);

		socialLinkWave.rebuildAll();
	}

	/**
	 * Initial build:
	 * - We do this immediately on DOMContentLoaded (see About.astro).
	 * - The Transition overlay is still covering the page at this moment, which is what we want.
	 */
	initDebugGridToggle({ container: blockContainer });
	rebuildGrid();
	blockTrail.refreshIgnoreRects();
	if (socialLinks.length > 0) {
		socialLinkWave.bindHandlers(pointerEvents);
	}

	// Scroll-driven image distortion (SVG filter + CSS blur) for the headshot.
	initAboutScrollDistortion({
		meDistortEl: aboutMeDistortEl,
		turbulenceEl: aboutScrollTurbulenceEl,
		displacementEl: aboutScrollDisplacementEl,
		getBlockSizePx: () => blockSizePx,
		scrollContainer: aboutSection,
	});

	if (timelineBlocks.length > 0) {
		timelineWave.bindHandlers(pointerEvents);
	}

	initTimelineEnterDistortion({
		timelineBlocks: hoverDistortTargets,
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
	window.addEventListener('resize', () => {
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
	});
}
