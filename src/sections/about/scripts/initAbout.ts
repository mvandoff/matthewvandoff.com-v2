type BlockTimings = { fadeInMs: number; fadeOutMs: number; holdMs: number };
type BlockState = { holdTimeoutId: number | null; activatedAt: number; activationId: number };

export function initAbout() {
	const blockContainer = document.getElementById('bg-blocks');
	if (!blockContainer) throw new Error('bg-blocks element not found');
	const blockContainerEl = blockContainer;

	let blocks: HTMLDivElement[] = [];
	let columns = 0;
	let blockSize = 0;
	let containerRect: DOMRect | null = null;
	const defaultTimings: BlockTimings = { fadeInMs: 150, fadeOutMs: 3000, holdMs: 3000 };
	let timings = defaultTimings;
	const blockStates = new Map<HTMLDivElement, BlockState>();

	function rebuildGrid() {
		clearAllBlockTimers(blockStates);
		timings = getBlockTimingsFromCss(blockContainerEl, defaultTimings);

		// Get computed style of the grid and extract the number of columns
		const computedStyle = window.getComputedStyle(blockContainerEl);
		const gridTemplateColumns = computedStyle.getPropertyValue('grid-template-columns');
		columns = parseGridColumns(gridTemplateColumns);

		containerRect = blockContainerEl.getBoundingClientRect();
		const containerWidth = containerRect.width || window.innerWidth;
		const containerHeight = containerRect.height || window.innerHeight;
		blockSize = columns > 0 ? containerWidth / columns : 0;
		const rowsNeeded = blockSize > 0 ? Math.ceil(containerHeight / blockSize) : 0;

		// Update grid styles
		blockContainerEl.style.gridTemplateRows = `repeat(${rowsNeeded}, ${blockSize}px)`;

		// Calculate the total number of blocks needed
		const totalBlocks = columns * rowsNeeded;

		// Clear existing blocks
		blockContainerEl.innerHTML = '';

		blocks = createBlocks(totalBlocks);
		if (blocks.length) blockContainerEl.append(...blocks);
	}

	rebuildGrid();

	// Fallback: when the blocks overlay interactive content
	// we can't rely on native pointer events. Use mousemove -> block index mapping
	// to simulate hover. Throttle with requestAnimationFrame for performance.
	let lastIndex: number | null = null;
	let raf = 0;
	let pendingClientX = 0;
	let pendingClientY = 0;

	function schedulePointerUpdate() {
		if (raf) return;
		raf = requestAnimationFrame(() => {
			raf = 0;
			const rect = containerRect ?? blockContainerEl.getBoundingClientRect();
			containerRect = rect;
			const x = pendingClientX - rect.left;
			const y = pendingClientY - rect.top;
			if (x < 0 || y < 0 || x >= rect.width || y >= rect.height || blockSize <= 0 || columns <= 0) {
				if (lastIndex !== null) lastIndex = null;
				return;
			}
			const col = Math.min(columns - 1, Math.max(0, Math.floor(x / blockSize)));
			const rows = Math.ceil(rect.height / blockSize);
			const row = Math.min(rows - 1, Math.max(0, Math.floor(y / blockSize)));
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

function clearAllBlockTimers(blockStates: Map<HTMLDivElement, BlockState>) {
	for (const { holdTimeoutId } of blockStates.values()) {
		if (holdTimeoutId) window.clearTimeout(holdTimeoutId);
	}
	blockStates.clear();
}

function triggerBlockHover(block: HTMLDivElement, blockStates: Map<HTMLDivElement, BlockState>, timings: BlockTimings) {
	const now = performance.now();
	const state = blockStates.get(block) ?? { holdTimeoutId: null, activatedAt: -Infinity, activationId: 0 };
	blockStates.set(block, state);

	if (!block.classList.contains('is-lit')) {
		block.classList.add('is-lit');
		state.activatedAt = now;
	}

	if (state.holdTimeoutId) window.clearTimeout(state.holdTimeoutId);
	const fadeRemainingMs = Math.max(0, timings.fadeInMs - (now - state.activatedAt));
	const holdDelayMs = fadeRemainingMs + timings.holdMs;
	const activationId = ++state.activationId;
	state.holdTimeoutId = window.setTimeout(() => {
		if (state.activationId !== activationId) return;
		state.holdTimeoutId = null;
		block.classList.remove('is-lit');
	}, holdDelayMs);
}

function parseGridColumns(gridTemplateColumns: string) {
	const repeatCount = Number(gridTemplateColumns.match(/repeat\(\s*(\d+)\s*,/)?.[1]);
	if (Number.isFinite(repeatCount) && repeatCount > 0) return repeatCount;
	return gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length;
}

function createBlocks(totalBlocks: number) {
	return Array.from({ length: totalBlocks }).reduce<HTMLDivElement[]>((acc) => {
		const block = document.createElement('div') as HTMLDivElement;
		block.classList.add('bg-block');
		acc.push(block);
		return acc;
	}, []);
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
