import { getBackgroundImage } from 'sections/about/scripts/getBackgroundImage';

export function initAbout() {
	const bgContainer = document.getElementById('bg-container');
	if (!bgContainer) return console.warn('bgContainer element not found');

	// Get computed style of the grid and extract the number of columns
	const computedStyle = window.getComputedStyle(bgContainer);
	const gridTemplateColumns = computedStyle.getPropertyValue('grid-template-columns');

	// Gets the number after 'repeat(' in the grid-template-columns string
	// If it doesn't match, fallback to the number of space-separated values
	const columns =
		Number(gridTemplateColumns.match(/repeat\(\s*(\d+)\s*,/)?.[1]) || gridTemplateColumns.split(' ').length;

	const blockSize = window.innerWidth / columns;
	const rowsNeeded = Math.ceil(window.innerHeight / blockSize);

	// Update grid styles
	bgContainer.style.gridTemplateRows = `repeat(${rowsNeeded}, ${blockSize}px)`;

	// Calculate the total number of blocks needed
	const totalBlocks = columns * rowsNeeded;

	// Clear existing blocks
	bgContainer.innerHTML = '';

	// Generate blocks dynamically using reduce and append them all at once
	const blocks = Array.from({ length: totalBlocks }).reduce<HTMLDivElement[]>((acc, _, i) => {
		const block = document.createElement('div') as HTMLDivElement;
		block.classList.add('bg-block');
		// block.style.backgroundSize = `${bgContainer.clientWidth}px ${bgContainer.clientHeight}px`;
		// block.style.backgroundRepeat = 'no-repeat';

		// const col = i % columns;
		// const row = Math.floor(i / columns);

		// const x = col * blockSize;
		// const y = row * blockSize;

		// block.style.backgroundPosition = `-${x}px -${y}px`;
		// block.dataset.colorCycle = '-1';

		acc.push(block);
		return acc;
	}, []);

	if (blocks.length) bgContainer.append(...blocks);

	blocks?.forEach((block) => {
		block.addEventListener('mouseenter', () => {
			block.style.backgroundColor = '#ff00008b';
			setTimeout(() => {
				block.classList.add('fade-out');
				block.style.background = 'transparent';
				setTimeout(() => block.classList.remove('fade-out'), 3000);
			}, 1000);
		});
	});
}

function getRandomColor() {
	const h = Math.floor(Math.random() * 360);
	const s = 20 + Math.floor(Math.random() * 25); // 20–44% (muted)
	const l = 8 + Math.floor(Math.random() * 18); // 8–25% (dark)

	return `hsl(${h} ${s}% ${l}%)`;
}

const BG_IMAGE = getBackgroundImage();
let COLORS = [getRandomColor()];

// block.dataset.colorCycle = String(Number(block.dataset.colorCycle) + 1);
// const colorCycle = Number(block.dataset.colorCycle);
// block.style.backgroundColor = COLORS[Number(block.dataset.colorCycle)];
// if (!COLORS[colorCycle + 1]) COLORS.push(getRandomColor());
