import { getBackgroundImage } from 'sections/about/scripts/getBackgroundImage';

export function initAbout() {
	const bgContainer = document.getElementById('bg-container');
	if (!bgContainer) throw new Error('bgContainer element not found');

	let blocks: HTMLDivElement[] = [];
	let columns = 0;
	let blockSize = 0;

	function rebuildGrid() {
		if (!bgContainer) throw new Error('bgContainer element not found');

		// Get computed style of the grid and extract the number of columns
		const computedStyle = window.getComputedStyle(bgContainer);
		const gridTemplateColumns = computedStyle.getPropertyValue('grid-template-columns');

		// Gets the number after 'repeat(' in the grid-template-columns string
		// If it doesn't match, fallback to the number of space-separated values
		columns = Number(gridTemplateColumns.match(/repeat\(\s*(\d+)\s*,/)?.[1]) || gridTemplateColumns.split(' ').length;

		blockSize = window.innerWidth / columns;
		const rowsNeeded = Math.ceil(window.innerHeight / blockSize);

		// Update grid styles
		bgContainer.style.gridTemplateRows = `repeat(${rowsNeeded}, ${blockSize}px)`;

		// Calculate the total number of blocks needed
		const totalBlocks = columns * rowsNeeded;

		// Clear existing blocks
		bgContainer.innerHTML = '';

		// Generate blocks dynamically using reduce and append them all at once
		blocks = Array.from({ length: totalBlocks }).reduce<HTMLDivElement[]>((acc) => {
			const block = document.createElement('div') as HTMLDivElement;
			block.classList.add('bg-block');
			acc.push(block);
			return acc;
		}, []);

		if (blocks.length) bgContainer.append(...blocks);
	}

	rebuildGrid();

	// Original per-block mouseenter (works when blocks are reachable)
	// blocks?.forEach((block) => block.addEventListener('mouseenter', () => triggerBlockHover(block)));

	// Fallback: when the background container is behind interactive foreground elements
	// we can't rely on native pointer events. Use mousemove -> block index mapping
	// to simulate hover. Throttle with requestAnimationFrame for performance.
	let lastIndex: number | null = null;
	let raf = 0;

	function handleMouseMove(e: MouseEvent) {
		if (raf || !bgContainer) return;
		raf = requestAnimationFrame(() => {
			raf = 0;
			const rect = bgContainer.getBoundingClientRect();
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

function triggerBlockHover(block: HTMLDivElement) {
	// Restart the CSS keyframe animation on repeated hovers.
	block.classList.remove('fade-out');
	// Force reflow so the animation reliably restarts.
	void block.offsetWidth;
	block.classList.add('fade-out');
}
