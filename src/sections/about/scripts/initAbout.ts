type BlockTimings = { fadeInMs: number; fadeOutMs: number; holdMs: number };
type BlockState = { holdTimeoutId: number | null; activatedAt: number; activationId: number };

export function initAbout() {
	const blockContainer = document.getElementById('bg-blocks');
	if (!blockContainer) throw new Error('bg-blocks element not found');
	const blockContainerEl = blockContainer;

	let blocks: HTMLDivElement[] = [];
	let columns = 0;
	let rows = 0;
	let blockSize = 0;
	const defaultTimings: BlockTimings = { fadeInMs: 150, fadeOutMs: 3000, holdMs: 3000 };
	let timings = defaultTimings;
	const blockStates = new Map<HTMLDivElement, BlockState>();

	function rebuildGrid() {
		clearAllBlockTimers(blockStates);
		timings = getBlockTimingsFromCss(blockContainerEl, defaultTimings);

		const computedStyle = window.getComputedStyle(blockContainerEl);
		columns = getColumnsFromCss(computedStyle);
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		blockSize = columns > 0 ? viewportWidth / columns : 0;
		rows = blockSize > 0 ? Math.ceil(viewportHeight / blockSize) : 0;

		// Update grid styles
		blockContainerEl.style.gridTemplateRows = `repeat(${rows}, ${blockSize}px)`;

		// Calculate the total number of blocks needed
		const totalBlocks = columns * rows;

		// Clear existing blocks
		blockContainerEl.innerHTML = '';

		blocks = createBlocks(totalBlocks);
		if (blocks.length) blockContainerEl.append(...blocks);
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
			const x = pendingClientX;
			const y = pendingClientY;
			if (
				x < 0 ||
				y < 0 ||
				x >= window.innerWidth ||
				y >= window.innerHeight ||
				blockSize <= 0 ||
				columns <= 0 ||
				rows <= 0
			) {
				if (lastIndex !== null) lastIndex = null;
				return;
			}
			const col = Math.min(columns - 1, Math.max(0, Math.floor(x / blockSize)));
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

function getColumnsFromCss(computedStyle: CSSStyleDeclaration) {
	const fromVar = Number(computedStyle.getPropertyValue('--block-cols').trim());
	if (Number.isFinite(fromVar) && fromVar > 0) return fromVar;

	const gridTemplateColumns = computedStyle.getPropertyValue('grid-template-columns');
	return parseGridColumns(gridTemplateColumns);
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
