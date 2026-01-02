export function initAbout() {
	const blockContainer = document.getElementById('bg-blocks');
	if (!blockContainer) throw new Error('bg-blocks element not found');

	let blocks: HTMLDivElement[] = [];
	let columns = 0;
	let blockSize = 0;
	const blockStates = new Map<HTMLDivElement, { holdTimeoutId: number | null; activatedAt: number }>();

	function getBlockTimings() {
		if (!blockContainer) throw new Error('bg-blocks element not found');
		const computedStyle = window.getComputedStyle(blockContainer);
		const fadeInMs = parseCssTimeToMs(computedStyle.getPropertyValue('--bg-block-fade-in'), 150);
		const fadeOutMs = parseCssTimeToMs(computedStyle.getPropertyValue('--bg-block-fade-out'), 3000);
		const holdMs = parseCssTimeToMs(computedStyle.getPropertyValue('--bg-block-hold'), 3000);
		return { fadeInMs, fadeOutMs, holdMs };
	}

	function clearAllBlockTimers() {
		for (const { holdTimeoutId } of blockStates.values()) {
			if (holdTimeoutId) window.clearTimeout(holdTimeoutId);
		}
		blockStates.clear();
	}

	function triggerBlockHover(block: HTMLDivElement) {
		const now = performance.now();
		const timings = getBlockTimings();
		const state = blockStates.get(block) ?? { holdTimeoutId: null, activatedAt: -Infinity };
		blockStates.set(block, state);

		const isLit = block.classList.contains('is-lit');
		if (isLit) {
			const isFadingIn = now - state.activatedAt < timings.fadeInMs;
			if (isFadingIn) return;
		}

		if (!isLit) {
			block.classList.add('is-lit');
			state.activatedAt = now;
		}

		if (state.holdTimeoutId) window.clearTimeout(state.holdTimeoutId);
		state.holdTimeoutId = window.setTimeout(() => {
			state.holdTimeoutId = null;
			block.classList.remove('is-lit');
		}, timings.holdMs);
	}

	function rebuildGrid() {
		if (!blockContainer) throw new Error('bg-blocks element not found');
		clearAllBlockTimers();

		// Get computed style of the grid and extract the number of columns
		const computedStyle = window.getComputedStyle(blockContainer);
		const gridTemplateColumns = computedStyle.getPropertyValue('grid-template-columns');

		// Gets the number after 'repeat(' in the grid-template-columns string
		// If it doesn't match, fallback to the number of space-separated values
		columns = Number(gridTemplateColumns.match(/repeat\(\s*(\d+)\s*,/)?.[1]) || gridTemplateColumns.split(' ').length;

		const rect = blockContainer.getBoundingClientRect();
		const containerWidth = rect.width || window.innerWidth;
		const containerHeight = rect.height || window.innerHeight;
		blockSize = containerWidth / columns;
		const rowsNeeded = Math.ceil(containerHeight / blockSize);

		// Update grid styles
		blockContainer.style.gridTemplateRows = `repeat(${rowsNeeded}, ${blockSize}px)`;

		// Calculate the total number of blocks needed
		const totalBlocks = columns * rowsNeeded;

		// Clear existing blocks
		blockContainer.innerHTML = '';

		// Generate blocks dynamically using reduce and append them all at once
		blocks = Array.from({ length: totalBlocks }).reduce<HTMLDivElement[]>((acc) => {
			const block = document.createElement('div') as HTMLDivElement;
			block.classList.add('bg-block');
			acc.push(block);
			return acc;
		}, []);

		if (blocks.length) blockContainer.append(...blocks);
	}

	rebuildGrid();

	// Fallback: when the blocks overlay interactive content
	// we can't rely on native pointer events. Use mousemove -> block index mapping
	// to simulate hover. Throttle with requestAnimationFrame for performance.
	let lastIndex: number | null = null;
	let raf = 0;

	function handleMouseMove(e: MouseEvent) {
		if (raf || !blockContainer) return;
		raf = requestAnimationFrame(() => {
			raf = 0;
			const rect = blockContainer.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;
			if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
				if (lastIndex !== null) lastIndex = null;
				return;
			}
			const col = Math.floor(x / blockSize);
			const row = Math.floor(y / blockSize);
			const idx = row * columns + col;
			if (idx !== lastIndex && blocks[idx]) {
				lastIndex = idx;
				triggerBlockHover(blocks[idx]);
			}
		});
	}

	document.addEventListener('mousemove', handleMouseMove);

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
