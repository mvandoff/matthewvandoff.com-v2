type BlockTimings = { fadeInMs: number; fadeOutMs: number; holdMs: number };
type BlockState = { holdTimeoutId: number | null; activatedAt: number };
type WaveTimings = { fadeInMs: number; fadeOutMs: number; stepMs: number };
type TimelineWaveState = { inTimeoutIds: number[]; outTimeoutIds: number[]; lastClientX: number; lastClientY: number };
type BlockCoords = { index: number; row: number; col: number };
type GridBounds = { rowStart: number; rowEnd: number; colStart: number; colEnd: number };
type WaveItem = { block: HTMLDivElement; distance: number };

export function initAbout() {
	const blockContainer = document.getElementById('bg-blocks');
	if (!blockContainer) throw new Error('bg-blocks element not found');
	const blockContainerEl = blockContainer;
	const aboutLeftEl = document.querySelector<HTMLElement>('#about .left');
	const aboutRightEl = document.querySelector<HTMLElement>('#about .right');
	const timelineHeadingEl = document.querySelector<HTMLElement>('#tl > h3');
	const timelineFirstBlockEl = document.querySelector<HTMLElement>('#tl .tl-block');
	const timelineBlocks = Array.from(document.querySelectorAll<HTMLElement>('#tl .tl-block'));

	let blocks: HTMLDivElement[] = [];
	let columns = 0;
	let rows = 0;
	let blockSizePx = 70;
	const defaultTimings: BlockTimings = { fadeInMs: 150, fadeOutMs: 3000, holdMs: 3000 };
	let timings = defaultTimings;
	const blockStates = new Map<HTMLDivElement, BlockState>();
	const defaultWaveTimings: WaveTimings = { fadeInMs: 250, fadeOutMs: 400, stepMs: 40 };
	let waveTimings = defaultWaveTimings;
	const timelineWaveStates = new Map<HTMLElement, TimelineWaveState>();
	let timelineWaveBindingsReady = false;

	function rebuildGrid() {
		clearAllBlockTimers(blockStates);
		clearAllTimelineWaveTimers(timelineWaveStates);
		timings = getBlockTimingsFromCss(blockContainerEl, defaultTimings);
		waveTimings = getWaveTimingsFromCss(blockContainerEl, defaultWaveTimings);
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
	document.body?.classList.add('about-blocks-ready');

	if (!timelineWaveBindingsReady && timelineBlocks.length > 0) {
		bindTimelineWaveHandlers();
		timelineWaveBindingsReady = true;
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

	function bindTimelineWaveHandlers() {
		const enterEvent = 'PointerEvent' in window ? 'pointerenter' : 'mouseenter';
		const moveEvent = 'PointerEvent' in window ? 'pointermove' : 'mousemove';
		const leaveEvent = 'PointerEvent' in window ? 'pointerleave' : 'mouseleave';

		for (const timelineBlock of timelineBlocks) {
			timelineBlock.addEventListener(enterEvent, handleTimelineEnter);
			timelineBlock.addEventListener(moveEvent, handleTimelineMove, { passive: true });
			timelineBlock.addEventListener(leaveEvent, handleTimelineLeave);
		}
	}

	function handleTimelineEnter(event: PointerEvent | MouseEvent) {
		const target = event.currentTarget as HTMLElement | null;
		if (!target) return;
		const state = getTimelineWaveState(target);
		state.lastClientX = event.clientX;
		state.lastClientY = event.clientY;
		clearTimelineWaveState(state);
		runTimelineWave({ element: target, origin: getWaveOrigin(target, state.lastClientX, state.lastClientY), type: 'in', state });
	}

	function handleTimelineMove(event: PointerEvent | MouseEvent) {
		const target = event.currentTarget as HTMLElement | null;
		if (!target) return;
		const state = getTimelineWaveState(target);
		state.lastClientX = event.clientX;
		state.lastClientY = event.clientY;
	}

	function handleTimelineLeave(event: PointerEvent | MouseEvent) {
		const target = event.currentTarget as HTMLElement | null;
		if (!target) return;
		const state = getTimelineWaveState(target);
		state.lastClientX = event.clientX;
		state.lastClientY = event.clientY;
		clearTimelineWaveState(state);
		runTimelineWave({ element: target, origin: getWaveOrigin(target, state.lastClientX, state.lastClientY), type: 'out', state });
	}

	function getTimelineWaveState(element: HTMLElement) {
		const existing = timelineWaveStates.get(element);
		if (existing) return existing;
		const state: TimelineWaveState = { inTimeoutIds: [], outTimeoutIds: [], lastClientX: 0, lastClientY: 0 };
		timelineWaveStates.set(element, state);
		return state;
	}

	function clearTimelineWaveState(state: TimelineWaveState) {
		for (const timeoutId of state.inTimeoutIds) window.clearTimeout(timeoutId);
		for (const timeoutId of state.outTimeoutIds) window.clearTimeout(timeoutId);
		state.inTimeoutIds = [];
		state.outTimeoutIds = [];
	}

	function getWaveOrigin(element: HTMLElement, clientX: number, clientY: number) {
		const containerRect = blockContainerEl.getBoundingClientRect();
		const origin = getBlockCoordsFromClient({
			clientX,
			clientY,
			containerRect,
			blockSizePx,
			columns,
			rows,
		});
		if (origin) return origin;

		const rect = element.getBoundingClientRect();
		return getBlockCoordsFromClient({
			clientX: rect.left + rect.width / 2,
			clientY: rect.top + rect.height / 2,
			containerRect,
			blockSizePx,
			columns,
			rows,
		});
	}

	function runTimelineWave(params: { element: HTMLElement; origin: BlockCoords | null; type: 'in' | 'out'; state: TimelineWaveState }) {
		if (!params.origin) return;
		const containerRect = blockContainerEl.getBoundingClientRect();
		const bounds = getGridBoundsForElement({
			element: params.element,
			containerRect,
			blockSizePx,
			columns,
			rows,
		});
		if (!bounds) return;
		const items = buildWaveItems(bounds, params.origin);
		if (!items.length) return;

		items.sort((a, b) => a.distance - b.distance);
		const targetTimeouts = params.type === 'in' ? params.state.inTimeoutIds : params.state.outTimeoutIds;
		for (const item of items) {
			const delay = Math.round(item.distance * waveTimings.stepMs);
			const timeoutId = window.setTimeout(() => {
				if (params.type === 'in') {
					item.block.classList.add('is-tl-lit');
				} else {
					item.block.classList.remove('is-tl-lit');
				}
			}, delay);
			targetTimeouts.push(timeoutId);
		}
	}

	function buildWaveItems(bounds: GridBounds, origin: BlockCoords): WaveItem[] {
		const items: WaveItem[] = [];
		for (let row = bounds.rowStart; row <= bounds.rowEnd; row += 1) {
			for (let col = bounds.colStart; col <= bounds.colEnd; col += 1) {
				const idx = row * columns + col;
				const block = blocks[idx];
				if (!block) continue;
				items.push({ block, distance: Math.hypot(col - origin.col, row - origin.row) });
			}
		}
		return items;
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

function clearAllTimelineWaveTimers(timelineStates: Map<HTMLElement, TimelineWaveState>) {
	for (const state of timelineStates.values()) {
		for (const timeoutId of state.inTimeoutIds) window.clearTimeout(timeoutId);
		for (const timeoutId of state.outTimeoutIds) window.clearTimeout(timeoutId);
		state.inTimeoutIds = [];
		state.outTimeoutIds = [];
	}
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
