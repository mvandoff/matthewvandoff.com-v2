type BlockTimings = { fadeInMs: number; fadeOutMs: number; holdMs: number };
type BlockState = { holdTimeoutId: number | null; activatedAt: number };

export function initAbout() {
	const blockContainer = document.getElementById('bg-blocks');
	if (!blockContainer) throw new Error('bg-blocks element not found');
	const blockContainerEl = blockContainer;
	const aboutLeftEl = document.querySelector<HTMLElement>('#about .left');
	const aboutRightEl = document.querySelector<HTMLElement>('#about .right');
	const timelineHeadingEl = document.querySelector<HTMLElement>('#tl > h3');
	const timelineFirstBlockEl = document.querySelector<HTMLElement>('#tl .tl-block');

	let blocks: HTMLDivElement[] = [];
	let columns = 0;
	let rows = 0;
	let blockSizePx = 70;
	const defaultTimings: BlockTimings = { fadeInMs: 150, fadeOutMs: 3000, holdMs: 3000 };
	let timings = defaultTimings;
	const blockStates = new Map<HTMLDivElement, BlockState>();

	function rebuildGrid() {
		clearAllBlockTimers(blockStates);
		timings = getBlockTimingsFromCss(blockContainerEl, defaultTimings);
		blockSizePx = getBlockSizePxFromCss(blockContainerEl, blockSizePx);

		const targetWidth = Math.max(document.documentElement.clientWidth, document.body?.clientWidth ?? 0);
		const targetHeight = Math.max(
			document.documentElement.scrollHeight,
			document.body?.scrollHeight ?? 0,
			document.documentElement.clientHeight
		);
		columns = Math.max(1, Math.ceil(targetWidth / blockSizePx));
		rows = Math.max(1, Math.ceil(targetHeight / blockSizePx));

		blockContainerEl.style.gridTemplateColumns = `repeat(${columns}, ${blockSizePx}px)`;
		blockContainerEl.style.gridTemplateRows = `repeat(${rows}, ${blockSizePx}px)`;

		// Calculate the total number of blocks needed
		const totalBlocks = columns * rows;

		blocks = createBlocks(totalBlocks);
		blockContainerEl.replaceChildren(...blocks);

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

	rebuildGrid();

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
			const { left, top } = blockContainerEl.getBoundingClientRect();
			const x = pendingClientX - left;
			const y = pendingClientY - top;
			if (x < 0 || y < 0) {
				if (lastIndex !== null) lastIndex = null;
				return;
			}
			const col = Math.floor(x / blockSizePx);
			const row = Math.floor(y / blockSizePx);
			if (col < 0 || row < 0 || col >= columns || row >= rows) {
				if (lastIndex !== null) lastIndex = null;
				return;
			}
			const idx = row * columns + col;
			if (idx !== lastIndex && blocks[idx]) {
				lastIndex = idx;
				triggerBlockHover(blocks[idx], blockStates, timings);
			}
		});
	}

	function handlePointerMove(e: PointerEvent | MouseEvent) {
		pendingClientX = e.clientX;
		pendingClientY = e.clientY;
		schedulePointerUpdate();
	}

	if ('PointerEvent' in window) {
		document.addEventListener('pointermove', handlePointerMove, { passive: true });
	} else {
		document.addEventListener('mousemove', handlePointerMove, { passive: true });
	}

	let resizeRaf = 0;
	window.addEventListener('resize', () => {
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
