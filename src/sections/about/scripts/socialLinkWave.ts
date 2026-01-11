import type { PointerEventNames, WaveTimings } from './timelineWave';

type BlockTimings = { fadeInMs: number; fadeOutMs: number; holdMs: number };
type BlockState = { holdTimeoutId: number | null; activatedAt: number };
type SocialLinkWaveState = {
	inTimeoutIds: number[];
	outTimeoutIds: number[];
	lastClientX: number;
	lastClientY: number;
	trailRafId: number;
	trailClientX: number;
	trailClientY: number;
};
type SocialLinkGrid = {
	waveGridEl: HTMLElement;
	trailGridEl: HTMLElement;
	waveBlocks: HTMLDivElement[];
	trailBlocks: HTMLDivElement[];
	columns: number;
	rows: number;
	blockSizePx: number;
	trailStates: Map<HTMLDivElement, BlockState>;
	trailTimings: BlockTimings;
	trailRadiusPx: number;
};
type BlockCoords = { row: number; col: number };

export function createSocialLinkWaveController(params: {
	socialLinks: HTMLAnchorElement[];
	getWaveTimings: () => WaveTimings;
	getSocialBlockSizePx: () => number;
}) {
	const { socialLinks, getWaveTimings, getSocialBlockSizePx } = params;
	const defaultTrailTimings: BlockTimings = { fadeInMs: 150, fadeOutMs: 3000, holdMs: 3000 };
	const defaultTrailRadiusPx = 9;

	const states = new Map<HTMLAnchorElement, SocialLinkWaveState>();
	const grids = new Map<HTMLAnchorElement, SocialLinkGrid>();

	function bindHandlers(events: PointerEventNames) {
		for (const link of socialLinks) {
			link.addEventListener(events.enter, handleEnter);
			link.addEventListener(events.move, handleMove, { passive: true });
			link.addEventListener(events.leave, handleLeave);
		}
	}

	function rebuildAll() {
		const socialBlockSizePx = getSocialBlockSizePx();

		for (const link of socialLinks) {
			const waveGridEl = link.querySelector<HTMLElement>('.social-wave-grid');
			const trailGridEl = link.querySelector<HTMLElement>('.social-trail-grid');
			if (!waveGridEl || !trailGridEl) continue;

			const rect = link.getBoundingClientRect();
			if (rect.width <= 0 || rect.height <= 0) continue;

			const columns = Math.max(1, Math.ceil(rect.width / socialBlockSizePx));
			const rows = Math.max(1, Math.ceil(rect.height / socialBlockSizePx));
			const waveBlocks = createWaveBlocks({ columns, rows });
			const trailBlocks = createTrailBlocks({ columns, rows });

			waveGridEl.style.gridTemplateColumns = `repeat(${columns}, ${socialBlockSizePx}px)`;
			waveGridEl.style.gridTemplateRows = `repeat(${rows}, ${socialBlockSizePx}px)`;
			waveGridEl.replaceChildren(...waveBlocks);

			trailGridEl.style.gridTemplateColumns = `repeat(${columns}, ${socialBlockSizePx}px)`;
			trailGridEl.style.gridTemplateRows = `repeat(${rows}, ${socialBlockSizePx}px)`;
			trailGridEl.replaceChildren(...trailBlocks);

			const state = getState(link);
			clearWaveState(state);

			const trailTimings = getTrailTimingsFromCss(trailGridEl, defaultTrailTimings);
			const trailRadiusPx = getTrailRadiusPxFromCss(trailGridEl, defaultTrailRadiusPx);

			grids.set(link, {
				waveGridEl,
				trailGridEl,
				waveBlocks,
				trailBlocks,
				columns,
				rows,
				blockSizePx: socialBlockSizePx,
				trailStates: new Map(),
				trailTimings,
				trailRadiusPx,
			});
		}
	}

	function handleEnter(event: PointerEvent | MouseEvent) {
		handleWave(event, 'in');
		const link = event.currentTarget as HTMLAnchorElement | null;
		if (!link) return;
		const state = getState(link);
		scheduleTrailUpdate(link, state, event.clientX, event.clientY);
	}

	function handleMove(event: PointerEvent | MouseEvent) {
		const link = event.currentTarget as HTMLAnchorElement | null;
		if (!link) return;
		const state = getState(link);
		state.lastClientX = event.clientX;
		state.lastClientY = event.clientY;
		scheduleTrailUpdate(link, state, event.clientX, event.clientY);
	}

	function handleLeave(event: PointerEvent | MouseEvent) {
		handleWave(event, 'out');
	}

	function handleWave(event: PointerEvent | MouseEvent, type: 'in' | 'out') {
		const link = event.currentTarget as HTMLAnchorElement | null;
		if (!link) return;

		const grid = grids.get(link);
		if (!grid) return;

		const state = getState(link);
		state.lastClientX = event.clientX;
		state.lastClientY = event.clientY;
		clearWaveState(state);

		const origin = getOrigin(link, grid, state.lastClientX, state.lastClientY);
		if (!origin) return;
		runWave({ grid, origin, type, state });
	}

	function runWave(params: { grid: SocialLinkGrid; origin: BlockCoords; type: 'in' | 'out'; state: SocialLinkWaveState }) {
		const { grid, origin, type, state } = params;
		const { waveBlocks, columns, rows } = grid;
		const shouldLight = type === 'in';
		const targetTimeouts = shouldLight ? state.inTimeoutIds : state.outTimeoutIds;

		const { stepMs } = getWaveTimings();
		const socialStepMs = clamp(Math.round(stepMs * 0.6), 0, 80);

		for (let row = 0; row < rows; row += 1) {
			for (let col = 0; col < columns; col += 1) {
				const idx = row * columns + col;
				const block = waveBlocks[idx];
				if (!block) continue;
				const distance = Math.hypot(col - origin.col, row - origin.row);
				const delay = Math.round(distance * socialStepMs);
				const timeoutId = window.setTimeout(() => {
					block.classList.toggle('is-lit', shouldLight);
				}, delay);
				targetTimeouts.push(timeoutId);
			}
		}
	}

	function scheduleTrailUpdate(link: HTMLAnchorElement, state: SocialLinkWaveState, clientX: number, clientY: number) {
		const grid = grids.get(link);
		if (!grid) return;
		state.trailClientX = clientX;
		state.trailClientY = clientY;
		if (state.trailRafId) return;
		state.trailRafId = window.requestAnimationFrame(() => {
			state.trailRafId = 0;
			runTrail(grid, state.trailClientX, state.trailClientY);
		});
	}

	function runTrail(grid: SocialLinkGrid, clientX: number, clientY: number) {
		const rect = grid.trailGridEl.getBoundingClientRect();
		const x = clientX - rect.left;
		const y = clientY - rect.top;
		if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

		const { blockSizePx, columns, rows, trailRadiusPx } = grid;
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

	function getOrigin(link: HTMLAnchorElement, grid: SocialLinkGrid, clientX: number, clientY: number): BlockCoords | null {
		const rect = link.getBoundingClientRect();
		const x = clamp(clientX - rect.left, 0, Math.max(0, rect.width - 1));
		const y = clamp(clientY - rect.top, 0, Math.max(0, rect.height - 1));
		const col = clamp(Math.floor(x / grid.blockSizePx), 0, grid.columns - 1);
		const row = clamp(Math.floor(y / grid.blockSizePx), 0, grid.rows - 1);
		return { row, col };
	}

	function getState(link: HTMLAnchorElement) {
		const existing = states.get(link);
		if (existing) return existing;
		const state: SocialLinkWaveState = {
			inTimeoutIds: [],
			outTimeoutIds: [],
			lastClientX: 0,
			lastClientY: 0,
			trailRafId: 0,
			trailClientX: 0,
			trailClientY: 0,
		};
		states.set(link, state);
		return state;
	}

	function clearAllTimers() {
		for (const state of states.values()) {
			clearWaveState(state);
		}
		for (const grid of grids.values()) {
			clearTrailBlockTimers(grid.trailStates);
			for (const block of grid.waveBlocks) block.classList.remove('is-lit');
			for (const block of grid.trailBlocks) block.classList.remove('is-lit');
		}
	}

	function clearWaveState(state: SocialLinkWaveState) {
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

function createWaveBlocks(params: { columns: number; rows: number }) {
	const { columns, rows } = params;
	const blocks: HTMLDivElement[] = [];
	for (let row = 0; row < rows; row += 1) {
		for (let col = 0; col < columns; col += 1) {
			const block = document.createElement('div') as HTMLDivElement;
			block.classList.add('social-wave-block');
			if (row === 0) block.classList.add('is-edge-top');
			if (row === rows - 1) block.classList.add('is-edge-bottom');
			if (col === 0) block.classList.add('is-edge-left');
			if (col === columns - 1) block.classList.add('is-edge-right');
			blocks.push(block);
		}
	}
	return blocks;
}

function createTrailBlocks(params: { columns: number; rows: number }) {
	const { columns, rows } = params;
	const blocks: HTMLDivElement[] = [];
	for (let row = 0; row < rows; row += 1) {
		for (let col = 0; col < columns; col += 1) {
			const block = document.createElement('div') as HTMLDivElement;
			block.classList.add('social-trail-block');
			blocks.push(block);
		}
	}
	return blocks;
}

function triggerTrailBlock(block: HTMLDivElement, blockStates: Map<HTMLDivElement, BlockState>, timings: BlockTimings) {
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

function clearTrailBlockTimers(blockStates: Map<HTMLDivElement, BlockState>) {
	for (const { holdTimeoutId } of blockStates.values()) {
		if (holdTimeoutId) window.clearTimeout(holdTimeoutId);
	}
	blockStates.clear();
}

function getTrailTimingsFromCss(container: HTMLElement, fallback: BlockTimings): BlockTimings {
	const computedStyle = window.getComputedStyle(container);
	const fadeInMs = parseCssTimeToMs(computedStyle.getPropertyValue('--social-trail-fade-in'), fallback.fadeInMs);
	const fadeOutMs = parseCssTimeToMs(computedStyle.getPropertyValue('--social-trail-fade-out'), fallback.fadeOutMs);
	const holdMs = parseCssTimeToMs(computedStyle.getPropertyValue('--social-trail-hold'), fallback.holdMs);
	return { fadeInMs, fadeOutMs, holdMs };
}

function getTrailRadiusPxFromCss(container: HTMLElement, fallbackPx: number) {
	const computedStyle = window.getComputedStyle(container);
	return parseCssPxToNumber(computedStyle.getPropertyValue('--social-trail-radius'), fallbackPx);
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
