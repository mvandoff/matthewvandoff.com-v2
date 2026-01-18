import type { BlockCoords, GridBounds, PointerEventNames, WaveTimings } from './timelineWave';

export type BlockTimings = { fadeInMs: number; fadeOutMs: number; holdMs: number };
export type BlockState = { holdTimeoutId: number | null; activatedAt: number };

export function getBlockTimingsFromCss(blockContainer: HTMLElement, fallback: BlockTimings): BlockTimings {
	const computedStyle = window.getComputedStyle(blockContainer);
	const fadeInMs = parseCssTimeToMs(computedStyle.getPropertyValue('--bg-block-fade-in'), fallback.fadeInMs);
	const fadeOutMs = parseCssTimeToMs(computedStyle.getPropertyValue('--bg-block-fade-out'), fallback.fadeOutMs);
	const holdMs = parseCssTimeToMs(computedStyle.getPropertyValue('--bg-block-hold'), fallback.holdMs);
	return { fadeInMs, fadeOutMs, holdMs };
}

export function getWaveTimingsFromCss(blockContainer: HTMLElement, fallback: WaveTimings): WaveTimings {
	const computedStyle = window.getComputedStyle(blockContainer);
	const fadeInMs = parseCssTimeToMs(computedStyle.getPropertyValue('--bg-block-wave-fade-in'), fallback.fadeInMs);
	const fadeOutMs = parseCssTimeToMs(computedStyle.getPropertyValue('--bg-block-wave-fade-out'), fallback.fadeOutMs);
	const stepMs = parseCssTimeToMs(computedStyle.getPropertyValue('--bg-block-wave-step'), fallback.stepMs);
	return { fadeInMs, fadeOutMs, stepMs };
}

export function getBlockSizePxFromCss(blockContainer: HTMLElement, fallbackPx: number): number {
	const computedStyle = window.getComputedStyle(blockContainer);
	const raw = computedStyle.getPropertyValue('--block-size').trim();
	if (!raw) return fallbackPx;
	const match = raw.match(/^(-?\d*\.?\d+)px$/);
	if (!match) return fallbackPx;
	const value = Number(match[1]);
	return Number.isFinite(value) && value > 0 ? value : fallbackPx;
}

export function clearAllBlockTimers(blockStates: Map<HTMLDivElement, BlockState>) {
	for (const { holdTimeoutId } of blockStates.values()) {
		if (holdTimeoutId) window.clearTimeout(holdTimeoutId);
	}
	blockStates.clear();
}

export function triggerBlockHover(block: HTMLDivElement, blockStates: Map<HTMLDivElement, BlockState>, timings: BlockTimings) {
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

export function createBlocks(totalBlocks: number) {
	return Array.from({ length: totalBlocks }, () => {
		const block = document.createElement('div') as HTMLDivElement;
		block.classList.add('bg-block');
		return block;
	});
}

export function createDebugLabelOverlay(params: {
	columns: number;
	rows: number;
	blockSizePx: number;
	widthPx: number;
	heightPx: number;
}) {
	const { columns, rows, blockSizePx, widthPx, heightPx } = params;
	const overlay = document.createElement('div');
	overlay.className = 'bg-grid-debug';

	const colLabels = document.createElement('div');
	colLabels.className = 'bg-grid-debug-cols';
	colLabels.style.gridTemplateColumns = `repeat(${columns}, ${blockSizePx}px)`;
	colLabels.style.gridTemplateRows = `${blockSizePx}px`;
	colLabels.style.top = `${blockSizePx}px`;
	colLabels.style.width = `${widthPx}px`;
	colLabels.style.height = `${blockSizePx}px`;

	for (let col = 0; col < columns; col += 1) {
		const label = document.createElement('div');
		label.className = 'bg-grid-debug-label';
		label.textContent = String(col);
		colLabels.append(label);
	}

	const rowLabels = document.createElement('div');
	rowLabels.className = 'bg-grid-debug-rows';
	rowLabels.style.gridTemplateColumns = `${blockSizePx}px`;
	rowLabels.style.gridTemplateRows = `repeat(${rows}, ${blockSizePx}px)`;
	rowLabels.style.width = `${blockSizePx}px`;
	rowLabels.style.height = `${heightPx}px`;

	for (let row = 0; row < rows; row += 1) {
		const label = document.createElement('div');
		label.className = 'bg-grid-debug-label';
		label.textContent = String(row);
		rowLabels.append(label);
	}

	overlay.append(colLabels, rowLabels);
	return overlay;
}

export function getPointerEventNames(usePointerEvents: boolean): PointerEventNames {
	return usePointerEvents
		? { enter: 'pointerenter', move: 'pointermove', leave: 'pointerleave' }
		: { enter: 'mouseenter', move: 'mousemove', leave: 'mouseleave' };
}

export function getBlockCoordsFromClient(params: {
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

export function getGridBoundsForElement(params: {
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

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}
