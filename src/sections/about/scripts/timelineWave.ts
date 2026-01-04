export type WaveTimings = { fadeInMs: number; fadeOutMs: number; stepMs: number };
export type BlockCoords = { index: number; row: number; col: number };
export type GridBounds = { rowStart: number; rowEnd: number; colStart: number; colEnd: number };
export type PointerEventNames = {
	enter: 'pointerenter' | 'mouseenter';
	move: 'pointermove' | 'mousemove';
	leave: 'pointerleave' | 'mouseleave';
};

type TimelineWaveState = { inTimeoutIds: number[]; outTimeoutIds: number[]; lastClientX: number; lastClientY: number };
type WaveItem = { block: HTMLDivElement; distance: number };
type GridMetrics = { blockSizePx: number; columns: number; rows: number };
type BlockCoordsFromClientParams = {
	clientX: number;
	clientY: number;
	containerRect: DOMRect;
	blockSizePx: number;
	columns: number;
	rows: number;
};
type GridBoundsForElementParams = {
	element: HTMLElement;
	containerRect: DOMRect;
	blockSizePx: number;
	columns: number;
	rows: number;
};

type TimelineWaveDeps = {
	blockContainerEl: HTMLElement;
	timelineBlocks: HTMLElement[];
	getBlocks: () => HTMLDivElement[];
	getGridMetrics: () => GridMetrics;
	getBlockCoordsFromClient: (params: BlockCoordsFromClientParams) => BlockCoords | null;
	getGridBoundsForElement: (params: GridBoundsForElementParams) => GridBounds | null;
	getWaveTimings: () => WaveTimings;
};

export function createTimelineWaveController(deps: TimelineWaveDeps) {
	const {
		blockContainerEl,
		timelineBlocks,
		getBlocks,
		getGridMetrics,
		getBlockCoordsFromClient,
		getGridBoundsForElement,
		getWaveTimings,
	} = deps;
	const timelineWaveStates = new Map<HTMLElement, TimelineWaveState>();

	function bindHandlers(events: PointerEventNames) {
		for (const timelineBlock of timelineBlocks) {
			timelineBlock.addEventListener(events.enter, handleTimelineEnter);
			timelineBlock.addEventListener(events.move, handleTimelineMove, { passive: true });
			timelineBlock.addEventListener(events.leave, handleTimelineLeave);
		}
	}

	function handleTimelineEnter(event: PointerEvent | MouseEvent) {
		handleTimelineWave(event, 'in');
	}

	function handleTimelineMove(event: PointerEvent | MouseEvent) {
		const target = event.currentTarget as HTMLElement | null;
		if (!target) return;
		const state = getTimelineWaveState(target);
		state.lastClientX = event.clientX;
		state.lastClientY = event.clientY;
	}

	function handleTimelineLeave(event: PointerEvent | MouseEvent) {
		handleTimelineWave(event, 'out');
	}

	function handleTimelineWave(event: PointerEvent | MouseEvent, type: 'in' | 'out') {
		const target = event.currentTarget as HTMLElement | null;
		if (!target) return;
		const state = getTimelineWaveState(target);
		state.lastClientX = event.clientX;
		state.lastClientY = event.clientY;
		clearTimelineWaveState(state);
		runTimelineWave({ element: target, origin: getWaveOrigin(target, state.lastClientX, state.lastClientY), type, state });
	}

	function getTimelineWaveState(element: HTMLElement) {
		const existing = timelineWaveStates.get(element);
		if (existing) return existing;
		const state: TimelineWaveState = { inTimeoutIds: [], outTimeoutIds: [], lastClientX: 0, lastClientY: 0 };
		timelineWaveStates.set(element, state);
		return state;
	}

	function getWaveOrigin(element: HTMLElement, clientX: number, clientY: number) {
		const { blockSizePx, columns, rows } = getGridMetrics();
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
		const { blockSizePx, columns, rows } = getGridMetrics();
		const containerRect = blockContainerEl.getBoundingClientRect();
		const bounds = getGridBoundsForElement({
			element: params.element,
			containerRect,
			blockSizePx,
			columns,
			rows,
		});
		if (!bounds) return;
		const items = buildWaveItems(bounds, params.origin, getBlocks(), columns);
		if (!items.length) return;

		items.sort((a, b) => a.distance - b.distance);
		const shouldLight = params.type === 'in';
		const targetTimeouts = shouldLight ? params.state.inTimeoutIds : params.state.outTimeoutIds;
		const { stepMs } = getWaveTimings();
		for (const item of items) {
			const delay = Math.round(item.distance * stepMs);
			const timeoutId = window.setTimeout(() => {
				item.block.classList.toggle('is-tl-lit', shouldLight);
			}, delay);
			targetTimeouts.push(timeoutId);
		}
	}

	function buildWaveItems(bounds: GridBounds, origin: BlockCoords, blocks: HTMLDivElement[], columns: number): WaveItem[] {
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

	function clearAllTimers() {
		for (const state of timelineWaveStates.values()) {
			clearTimelineWaveState(state);
		}
	}

	function clearTimelineWaveState(state: TimelineWaveState) {
		for (const timeoutId of state.inTimeoutIds) window.clearTimeout(timeoutId);
		for (const timeoutId of state.outTimeoutIds) window.clearTimeout(timeoutId);
		state.inTimeoutIds = [];
		state.outTimeoutIds = [];
	}

	return { bindHandlers, clearAllTimers };
}
