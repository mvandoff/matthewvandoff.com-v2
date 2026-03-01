import type { PointerEventNames, WaveTimings } from './timelineWave';

// Default knobs for timeline-local mini grid behavior.
const DEFAULT_MINI_BLOCK_SIZE_PX = 24;
// Timeline-local wave runs slightly faster than background wave.
const STEP_SCALE = 0.6;
const STEP_MAX_MS = 60;
const MINI_BLOCK_SIZE_VAR = '--tl-mini-block-size';
// Shorter trail timings keep the effect visible but not "smeared".
const DEFAULT_TRAIL_TIMINGS: BlockTimings = { fadeInMs: 100, fadeOutMs: 800, holdMs: 700 };
const DEFAULT_TRAIL_RADIUS_PX = 18;

type BlockCoords = { row: number; col: number };
type BlockTimings = { fadeInMs: number; fadeOutMs: number; holdMs: number };
type BlockState = { holdTimeoutId: number | null; activatedAt: number };
type TimelineBlockWaveState = {
	inTimeoutIds: number[];
	outTimeoutIds: number[];
	lastClientX: number;
	lastClientY: number;
	trailRafId: number;
	trailClientX: number;
	trailClientY: number;
};
type TimelineBlockGrid = {
	timelineBlockEl: HTMLElement;
	waveBlocks: HTMLDivElement[];
	trailBlocks: HTMLDivElement[];
	columns: number;
	rows: number;
	blockSizePx: number;
	trailStates: Map<HTMLDivElement, BlockState>;
	trailTimings: BlockTimings;
	trailRadiusPx: number;
	trailGridEl: HTMLElement;
};

/**
 * Creates local mini-grid hover effects inside each timeline card (wave + pointer trail).
 */
export function createTimelineBlockWaveController(params: {
	timelineBlocks: HTMLElement[];
	getWaveTimings: () => WaveTimings;
}) {
	const { timelineBlocks, getWaveTimings } = params;
	// Per-card runtime state and cached grid geometry.
	const states = new Map<HTMLElement, TimelineBlockWaveState>();
	const grids = new Map<HTMLElement, TimelineBlockGrid>();

	function bindHandlers(events: PointerEventNames) {
		for (const timelineBlock of timelineBlocks) {
			timelineBlock.addEventListener(events.enter, handleEnter);
			timelineBlock.addEventListener(events.move, handleMove, { passive: true });
			timelineBlock.addEventListener(events.leave, handleLeave);
		}
	}

	function rebuildAll() {
		for (const timelineBlock of timelineBlocks) {
			const waveGridEl = timelineBlock.querySelector<HTMLElement>('.tl-mini-wave-grid');
			const trailGridEl = timelineBlock.querySelector<HTMLElement>('.tl-mini-trail-grid');
			if (!waveGridEl || !trailGridEl) continue;

			const rect = timelineBlock.getBoundingClientRect();
			if (rect.width <= 0 || rect.height <= 0) continue;

			const blockSizePx = getMiniBlockSizePxFromCss(timelineBlock, DEFAULT_MINI_BLOCK_SIZE_PX);
			const columns = Math.max(1, Math.ceil(rect.width / blockSizePx));
			const rows = Math.max(1, Math.ceil(rect.height / blockSizePx));
			const waveBlocks = createWaveBlocks({ columns, rows });
			const trailBlocks = createTrailBlocks({ columns, rows });

			// Keep both overlay layers on identical geometry so wave + trail align perfectly.
			waveGridEl.style.gridTemplateColumns = `repeat(${columns}, ${blockSizePx}px)`;
			waveGridEl.style.gridTemplateRows = `repeat(${rows}, ${blockSizePx}px)`;
			waveGridEl.replaceChildren(...waveBlocks);

			trailGridEl.style.gridTemplateColumns = `repeat(${columns}, ${blockSizePx}px)`;
			trailGridEl.style.gridTemplateRows = `repeat(${rows}, ${blockSizePx}px)`;
			trailGridEl.replaceChildren(...trailBlocks);

			const state = getState(timelineBlock);
			clearWaveState(state);
			const trailTimings = getTrailTimingsFromCss(trailGridEl, DEFAULT_TRAIL_TIMINGS);
			const trailRadiusPx = getTrailRadiusPxFromCss(trailGridEl, DEFAULT_TRAIL_RADIUS_PX);

			grids.set(timelineBlock, {
				timelineBlockEl: timelineBlock,
				waveBlocks,
				trailBlocks,
				columns,
				rows,
				blockSizePx,
				trailStates: new Map(),
				trailTimings,
				trailRadiusPx,
				trailGridEl,
			});
		}
	}

	function handleEnter(event: PointerEvent | MouseEvent) {
		// Enter starts the local wave and primes the local trail immediately.
		handleWave(event, 'in');
		const timelineBlock = event.currentTarget as HTMLElement | null;
		if (!timelineBlock) return;
		const state = getState(timelineBlock);
		scheduleTrailUpdate(timelineBlock, state, event.clientX, event.clientY);
	}

	function handleMove(event: PointerEvent | MouseEvent) {
		const timelineBlock = event.currentTarget as HTMLElement | null;
		if (!timelineBlock) return;
		const state = getState(timelineBlock);
		state.lastClientX = event.clientX;
		state.lastClientY = event.clientY;
		scheduleTrailUpdate(timelineBlock, state, event.clientX, event.clientY);
	}

	function handleLeave(event: PointerEvent | MouseEvent) {
		handleWave(event, 'out');
	}

	function handleWave(event: PointerEvent | MouseEvent, type: 'in' | 'out') {
		const timelineBlock = event.currentTarget as HTMLElement | null;
		if (!timelineBlock) return;

		const grid = grids.get(timelineBlock);
		if (!grid) return;

		const state = getState(timelineBlock);
		state.lastClientX = event.clientX;
		state.lastClientY = event.clientY;
		clearWaveState(state);

		const origin = getOrigin(grid, state.lastClientX, state.lastClientY);
		if (!origin) return;
		runWave({ grid, origin, type, state });
	}

	function runWave(params: {
		grid: TimelineBlockGrid;
		origin: BlockCoords;
		type: 'in' | 'out';
		state: TimelineBlockWaveState;
	}) {
		const { grid, origin, type, state } = params;
		const shouldLight = type === 'in';
		const targetTimeouts = shouldLight ? state.inTimeoutIds : state.outTimeoutIds;
		const stepMs = getTimelineStepMs(getWaveTimings().stepMs);
		const blocksByDelay = new Map<number, HTMLDivElement[]>();

		// Group by computed delay so we schedule one timeout per "ring" instead of per block.
		for (let row = 0; row < grid.rows; row += 1) {
			for (let col = 0; col < grid.columns; col += 1) {
				const idx = row * grid.columns + col;
				const block = grid.waveBlocks[idx];
				if (!block) continue;
				const distance = Math.hypot(col - origin.col, row - origin.row);
				const delay = Math.round(distance * stepMs);
				const bucket = blocksByDelay.get(delay);
				if (bucket) {
					bucket.push(block);
					continue;
				}
				blocksByDelay.set(delay, [block]);
			}
		}

		for (const [delay, bucket] of blocksByDelay) {
			const timeoutId = window.setTimeout(() => {
				for (const block of bucket) {
					block.classList.toggle('is-lit', shouldLight);
				}
			}, delay);
			targetTimeouts.push(timeoutId);
		}
	}

	function scheduleTrailUpdate(timelineBlock: HTMLElement, state: TimelineBlockWaveState, clientX: number, clientY: number) {
		const grid = grids.get(timelineBlock);
		if (!grid) return;
		state.trailClientX = clientX;
		state.trailClientY = clientY;
		if (state.trailRafId) return;
		// Coalesce high-frequency pointermove events into one trail update per animation frame.
		state.trailRafId = window.requestAnimationFrame(() => {
			state.trailRafId = 0;
			runTrail(grid, state.trailClientX, state.trailClientY);
		});
	}

	function runTrail(grid: TimelineBlockGrid, clientX: number, clientY: number) {
		const rect = grid.trailGridEl.getBoundingClientRect();
		const x = clientX - rect.left;
		const y = clientY - rect.top;
		if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

		const { blockSizePx, columns, rows, trailRadiusPx } = grid;
		// Narrow candidate cells to a bounding box around the cursor before exact radius checks.
		const colStart = clamp(Math.floor((x - trailRadiusPx) / blockSizePx), 0, columns - 1);
		const colEnd = clamp(Math.floor((x + trailRadiusPx) / blockSizePx), 0, columns - 1);
		const rowStart = clamp(Math.floor((y - trailRadiusPx) / blockSizePx), 0, rows - 1);
		const rowEnd = clamp(Math.floor((y + trailRadiusPx) / blockSizePx), 0, rows - 1);

		for (let row = rowStart; row <= rowEnd; row += 1) {
			for (let col = colStart; col <= colEnd; col += 1) {
				const idx = row * columns + col;
				const block = grid.trailBlocks[idx];
				if (!block) continue;
				if (!isBlockWithinRadius({ x, y, radius: trailRadiusPx, row, col, blockSizePx })) continue;
				triggerTrailBlock(block, grid.trailStates, grid.trailTimings);
			}
		}
	}

	function getOrigin(grid: TimelineBlockGrid, clientX: number, clientY: number): BlockCoords | null {
		const rect = grid.timelineBlockEl.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return null;
		const x = clamp(clientX - rect.left, 0, Math.max(0, rect.width - 1));
		const y = clamp(clientY - rect.top, 0, Math.max(0, rect.height - 1));
		const col = clamp(Math.floor(x / grid.blockSizePx), 0, grid.columns - 1);
		const row = clamp(Math.floor(y / grid.blockSizePx), 0, grid.rows - 1);
		return { row, col };
	}

	function getState(timelineBlock: HTMLElement) {
		const existing = states.get(timelineBlock);
		if (existing) return existing;
		const state: TimelineBlockWaveState = {
			inTimeoutIds: [],
			outTimeoutIds: [],
			lastClientX: 0,
			lastClientY: 0,
			trailRafId: 0,
			trailClientX: 0,
			trailClientY: 0,
		};
		states.set(timelineBlock, state);
		return state;
	}

	function clearAllTimers() {
		for (const state of states.values()) {
			clearWaveState(state);
		}
		for (const grid of grids.values()) {
			for (const block of grid.waveBlocks) {
				block.classList.remove('is-lit');
			}
			for (const block of grid.trailBlocks) {
				block.classList.remove('is-lit');
			}
			clearTrailBlockTimers(grid.trailStates);
		}
	}

	function clearWaveState(state: TimelineBlockWaveState) {
		for (const timeoutId of state.inTimeoutIds) window.clearTimeout(timeoutId);
		for (const timeoutId of state.outTimeoutIds) window.clearTimeout(timeoutId);
		state.inTimeoutIds = [];
		state.outTimeoutIds = [];
		if (state.trailRafId) {
			window.cancelAnimationFrame(state.trailRafId);
			state.trailRafId = 0;
		}
	}

	return { bindHandlers, rebuildAll, clearAllTimers };
}

// Build the wave layer cells for one timeline card.
function createWaveBlocks(params: { columns: number; rows: number }) {
	const { columns, rows } = params;
	const blocks: HTMLDivElement[] = [];
	for (let row = 0; row < rows; row += 1) {
		for (let col = 0; col < columns; col += 1) {
			const block = document.createElement('div') as HTMLDivElement;
			block.classList.add('tl-mini-wave-block');
			blocks.push(block);
		}
	}
	return blocks;
}

// Build the trail layer cells for one timeline card.
function createTrailBlocks(params: { columns: number; rows: number }) {
	const { columns, rows } = params;
	const blocks: HTMLDivElement[] = [];
	for (let row = 0; row < rows; row += 1) {
		for (let col = 0; col < columns; col += 1) {
			const block = document.createElement('div') as HTMLDivElement;
			block.classList.add('tl-mini-trail-block');
			blocks.push(block);
		}
	}
	return blocks;
}

// Light a trail block and schedule when it should fade back out.
function triggerTrailBlock(block: HTMLDivElement, blockStates: Map<HTMLDivElement, BlockState>, timings: BlockTimings) {
	const now = performance.now();
	const state = blockStates.get(block) ?? { holdTimeoutId: null, activatedAt: -Infinity };
	blockStates.set(block, state);

	if (!block.classList.contains('is-lit')) {
		block.classList.add('is-lit');
		state.activatedAt = now;
	}

	if (state.holdTimeoutId) window.clearTimeout(state.holdTimeoutId);
	// If a block is re-hit during fade-in, preserve the intended visible hold duration.
	const fadeRemainingMs = Math.max(0, timings.fadeInMs - (now - state.activatedAt));
	const holdDelayMs = fadeRemainingMs + timings.holdMs;
	state.holdTimeoutId = window.setTimeout(() => {
		state.holdTimeoutId = null;
		block.classList.remove('is-lit');
	}, holdDelayMs);
}

// Clear all pending hold timers so no stale callbacks run after rebuild/cleanup.
function clearTrailBlockTimers(blockStates: Map<HTMLDivElement, BlockState>) {
	for (const { holdTimeoutId } of blockStates.values()) {
		if (holdTimeoutId) window.clearTimeout(holdTimeoutId);
	}
	blockStates.clear();
}

// Clamp/scale shared wave timings for timeline-card-local pacing.
function getTimelineStepMs(stepMs: number) {
	return clamp(Math.round(stepMs * STEP_SCALE), 0, STEP_MAX_MS);
}

function getMiniBlockSizePxFromCss(container: HTMLElement, fallbackPx: number) {
	const computedStyle = window.getComputedStyle(container);
	const rawToken = computedStyle.getPropertyValue(MINI_BLOCK_SIZE_VAR).trim();
	if (!rawToken) return fallbackPx;
	const numeric = parseCssPxToNumber(rawToken, NaN);
	if (Number.isFinite(numeric) && numeric > 0) return numeric;

	// Support calc()/nested var() by measuring a probe that uses the CSS variable.
	const probeEl = document.createElement('div');
	probeEl.style.position = 'absolute';
	probeEl.style.visibility = 'hidden';
	probeEl.style.pointerEvents = 'none';
	probeEl.style.width = `var(${MINI_BLOCK_SIZE_VAR})`;
	container.append(probeEl);
	const resolvedPx = probeEl.getBoundingClientRect().width;
	probeEl.remove();
	return resolvedPx > 0 ? resolvedPx : fallbackPx;
}

// Allow CSS to tune local trail timings without touching JS.
function getTrailTimingsFromCss(container: HTMLElement, fallback: BlockTimings): BlockTimings {
	const computedStyle = window.getComputedStyle(container);
	const fadeInMs = parseCssTimeToMs(computedStyle.getPropertyValue('--tl-mini-trail-fade-in'), fallback.fadeInMs);
	const fadeOutMs = parseCssTimeToMs(computedStyle.getPropertyValue('--tl-mini-trail-fade-out'), fallback.fadeOutMs);
	const holdMs = parseCssTimeToMs(computedStyle.getPropertyValue('--tl-mini-trail-hold'), fallback.holdMs);
	return { fadeInMs, fadeOutMs, holdMs };
}

// Allow CSS to tune the cursor influence radius for trail activation.
function getTrailRadiusPxFromCss(container: HTMLElement, fallbackPx: number) {
	const computedStyle = window.getComputedStyle(container);
	return parseCssPxToNumber(computedStyle.getPropertyValue('--tl-mini-trail-radius'), fallbackPx);
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

function parseCssPxToNumber(value: string, fallbackPx: number) {
	const trimmed = value.trim();
	if (!trimmed) return fallbackPx;
	const match = trimmed.match(/^(-?\d*\.?\d+)(px)?$/);
	if (!match) return fallbackPx;
	const raw = Number(match[1]);
	return Number.isFinite(raw) && raw >= 0 ? raw : fallbackPx;
}

// Exact circle-vs-rect test for whether the cursor radius touches a mini cell.
function isBlockWithinRadius(params: {
	x: number;
	y: number;
	radius: number;
	row: number;
	col: number;
	blockSizePx: number;
}) {
	const { x, y, radius, row, col, blockSizePx } = params;
	const left = col * blockSizePx;
	const right = left + blockSizePx;
	const top = row * blockSizePx;
	const bottom = top + blockSizePx;
	const nearestX = clamp(x, left, right);
	const nearestY = clamp(y, top, bottom);
	return Math.hypot(x - nearestX, y - nearestY) <= radius;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}
