import type { PointerEventNames } from './timelineWave';
import { getBlockCoordsFromClient, triggerBlockHover, type BlockState, type BlockTimings } from './homeBlockGrid';

type GridMetrics = { blockSizePx: number; columns: number; rows: number };

type BlockTrailDeps = {
	blockContainerEl: HTMLElement;
	mainNavEl: HTMLElement;
	getBlocks: () => HTMLDivElement[];
	getGridMetrics: () => GridMetrics;
	getTimings: () => BlockTimings;
	getBlockStates: () => Map<HTMLDivElement, BlockState>;
};

type IgnoreRect = { left: number; right: number; top: number; bottom: number };

export function createBlockTrailController(deps: BlockTrailDeps) {
	const { blockContainerEl, mainNavEl, getBlocks, getGridMetrics, getTimings, getBlockStates } = deps;
	let lastIndex: number | null = null;
	let raf = 0;
	let pendingClientX = 0;
	let pendingClientY = 0;
	const blockTrailIgnoreSelector = '[data-block-trail="ignore"]';
	const blockTrailIgnorePaddingPx = 8;
	const blockTrailIgnoreEls = Array.from(document.querySelectorAll<HTMLElement>(blockTrailIgnoreSelector));
	let blockTrailIgnoreRects: IgnoreRect[] = [];

	// Cache ignore layer bounds once; they don't move in this layout.
	function refreshIgnoreRects() {
		blockTrailIgnoreRects = blockTrailIgnoreEls.map((ignoreEl) => {
			const rect = ignoreEl.getBoundingClientRect();
			return {
				left: rect.left - blockTrailIgnorePaddingPx,
				right: rect.right + blockTrailIgnorePaddingPx,
				top: rect.top - blockTrailIgnorePaddingPx,
				bottom: rect.bottom + blockTrailIgnorePaddingPx,
			};
		});
	}

	function isPointerOverIgnoredLayer(target: EventTarget | null, clientX: number, clientY: number) {
		const targetEl = target instanceof Element ? target : null;
		if (targetEl?.closest(blockTrailIgnoreSelector) !== null) return true;
		// Fall back to cached bounds for a padded hitbox without per-move layout reads.
		for (const rect of blockTrailIgnoreRects) {
			if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
				return true;
			}
		}
		return false;
	}

	function schedulePointerUpdate() {
		if (raf) return;
		raf = requestAnimationFrame(() => {
			raf = 0;
			const { blockSizePx, columns, rows } = getGridMetrics();
			const coords = getBlockCoordsFromClient({
				clientX: pendingClientX,
				clientY: pendingClientY,
				containerRect: blockContainerEl.getBoundingClientRect(),
				blockSizePx,
				columns,
				rows,
			});
			if (!coords) {
				if (lastIndex !== null) lastIndex = null;
				return;
			}
			const block = getBlocks()[coords.index];
			if (block) triggerBlockHover(block, getBlockStates(), getTimings());
			lastIndex = coords.index;
		});
	}

	const navRect = mainNavEl.getBoundingClientRect();
	function handlePointerMove(e: PointerEvent | MouseEvent) {
		if (isPointerOverIgnoredLayer(e.target, e.clientX, e.clientY)) {
			lastIndex = null;
			return;
		}
		if (navRect.height > 0 && e.clientY >= navRect.top && e.clientY <= navRect.bottom) {
			lastIndex = null;
			return;
		}
		// Use the block grid bounds (not just #home) so the trail works in the extra columns
		// that extend into the left/right gutters on wide viewports.
		const rect = blockContainerEl.getBoundingClientRect();
		if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
			lastIndex = null;
			return;
		}
		pendingClientX = e.clientX;
		pendingClientY = e.clientY;
		schedulePointerUpdate();
	}

	function bindHandlers(events: PointerEventNames) {
		document.addEventListener(events.move, handlePointerMove, { passive: true });
	}

	function resetPointerState() {
		lastIndex = null;
	}

	return { bindHandlers, refreshIgnoreRects, resetPointerState };
}
