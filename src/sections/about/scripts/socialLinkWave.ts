import type { PointerEventNames, WaveTimings } from './timelineWave';

type SocialLinkWaveState = { inTimeoutIds: number[]; outTimeoutIds: number[]; lastClientX: number; lastClientY: number };
type SocialLinkGrid = { gridEl: HTMLElement; blocks: HTMLDivElement[]; columns: number; rows: number; blockSizePx: number };
type BlockCoords = { row: number; col: number };

export function createSocialLinkWaveController(params: {
	socialLinks: HTMLAnchorElement[];
	getWaveTimings: () => WaveTimings;
	getSocialBlockSizePx: () => number;
}) {
	const { socialLinks, getWaveTimings, getSocialBlockSizePx } = params;

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
			const gridEl = link.querySelector<HTMLElement>('.social-wave-grid');
			if (!gridEl) continue;

			const rect = link.getBoundingClientRect();
			if (rect.width <= 0 || rect.height <= 0) continue;

			const columns = Math.max(1, Math.ceil(rect.width / socialBlockSizePx));
			const rows = Math.max(1, Math.ceil(rect.height / socialBlockSizePx));
			const blocks = createBlocks({ columns, rows });

			gridEl.style.gridTemplateColumns = `repeat(${columns}, ${socialBlockSizePx}px)`;
			gridEl.style.gridTemplateRows = `repeat(${rows}, ${socialBlockSizePx}px)`;
			gridEl.replaceChildren(...blocks);

			const state = getState(link);
			clearState(state);
			grids.set(link, { gridEl, blocks, columns, rows, blockSizePx: socialBlockSizePx });
		}

	}

	function handleEnter(event: PointerEvent | MouseEvent) {
		handleWave(event, 'in');
	}

	function handleMove(event: PointerEvent | MouseEvent) {
		const link = event.currentTarget as HTMLAnchorElement | null;
		if (!link) return;
		const state = getState(link);
		state.lastClientX = event.clientX;
		state.lastClientY = event.clientY;
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
		clearState(state);

		const origin = getOrigin(link, grid, state.lastClientX, state.lastClientY);
		if (!origin) return;
		runWave({ grid, origin, type, state });
	}

	function runWave(params: { grid: SocialLinkGrid; origin: BlockCoords; type: 'in' | 'out'; state: SocialLinkWaveState }) {
		const { grid, origin, type, state } = params;
		const { blocks, columns, rows } = grid;
		const shouldLight = type === 'in';
		const targetTimeouts = shouldLight ? state.inTimeoutIds : state.outTimeoutIds;

		const { stepMs } = getWaveTimings();
		const socialStepMs = clamp(Math.round(stepMs * 0.6), 0, 80);

		for (let row = 0; row < rows; row += 1) {
			for (let col = 0; col < columns; col += 1) {
				const idx = row * columns + col;
				const block = blocks[idx];
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
		const state: SocialLinkWaveState = { inTimeoutIds: [], outTimeoutIds: [], lastClientX: 0, lastClientY: 0 };
		states.set(link, state);
		return state;
	}

	function clearAllTimers() {
		for (const state of states.values()) {
			clearState(state);
		}
		for (const grid of grids.values()) {
			for (const block of grid.blocks) block.classList.remove('is-lit');
		}
	}

	function clearState(state: SocialLinkWaveState) {
		for (const timeoutId of state.inTimeoutIds) window.clearTimeout(timeoutId);
		for (const timeoutId of state.outTimeoutIds) window.clearTimeout(timeoutId);
		state.inTimeoutIds = [];
		state.outTimeoutIds = [];
	}

	return { bindHandlers, rebuildAll, clearAllTimers };
}

function createBlocks(params: { columns: number; rows: number }) {
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

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}
