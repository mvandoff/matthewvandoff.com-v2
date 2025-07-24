import gsap from 'gsap';

function adjustGrid() {
	const transition = document.getElementById('transition');
	if (!transition) return console.warn('Transition element not found');

	// Get computed style of the grid and extract the number of columns
	const computedStyle = window.getComputedStyle(transition);
	const gridTemplateColumns = computedStyle.getPropertyValue('grid-template-columns');

	// Gets the number after 'repeat(' in the grid-template-columns string
	// If it doesn't match, fallback to the number of space-separated values
	const columns =
		Number(gridTemplateColumns.match(/repeat\(\s*(\d+)\s*,/)?.[1]) || gridTemplateColumns.split(' ').length;

	const blockSize = window.innerWidth / columns;
	const rowsNeeded = Math.ceil(window.innerHeight / blockSize);

	// Update grid styles
	transition.style.gridTemplateRows = `repeat(${rowsNeeded}, ${blockSize}px)`;

	// Calculate the total number of blocks needed
	const totalBlocks = columns * rowsNeeded;

	// Clear existing blocks
	transition.innerHTML = '';

	// Generate blocks dynamically
	for (let i = 0; i < totalBlocks; i++) {
		const block: HTMLDivElement = document.createElement('div');
		block.classList.add('transition-block');
		transition.appendChild(block);
	}

	// Set initial state for page load animation - blocks start visible
	gsap.set('.transition-block', { opacity: 1 });
}

export async function initTransition() {
	adjustGrid();

	const pageLoadTimeline = gsap.timeline({
		onStart: () => {
			gsap.set('#transition', { background: 'transparent' });
		},
		onComplete: () => {
			gsap.set('#transition', { display: 'none' });
		},
		defaults: {
			ease: 'linear',
		},
	});

	// Animate blocks out on page load
	pageLoadTimeline.to(
		'.transition-block',
		{
			opacity: 0,
			duration: 0.1,
			stagger: { amount: 0.75, from: 'random' },
		},
		0.1,
	);

	// Pre-process all valid links
	const validLinks: HTMLAnchorElement[] = Array.from(document.querySelectorAll('a')).filter(
		(link: HTMLAnchorElement) => {
			const href: string = link.getAttribute('href') || '';

			try {
				const hostname: string = new URL(link.href, window.location.origin).hostname;

				return (
					hostname === window.location.hostname && // Same domain
					!href.startsWith('#') && // Not an anchor link
					link.getAttribute('target') !== '_blank' && // Not opening in a new tab
					!link.hasAttribute('data-transition-prevent') // No 'data-transition-prevent' attribute
				);
			} catch (error) {
				// Invalid URL, exclude from valid links
				console.warn('Invalid URL found:', link.href, error);
				return false;
			}
		},
	);

	// Add event listeners to pre-processed valid links
	validLinks.forEach((link: HTMLAnchorElement) => {
		link.addEventListener('pointerdown', (event: MouseEvent) => {
			event.preventDefault();
			link.classList.add('transitioning');
			const destination: string = link.href;

			// Show loading grid with animation
			gsap.set('#transition', { display: 'grid' });
			gsap.fromTo(
				'.transition-block',
				{ autoAlpha: 0 },
				{
					autoAlpha: 1,
					duration: 0.001,
					ease: 'linear',
					stagger: { amount: 0.75, from: 'random' },
					onComplete: () => {
						window.location.href = destination;
					},
				},
			);
		});
	});

	window.addEventListener('pageshow', (event: PageTransitionEvent) => {
		if (event.persisted) {
			window.location.reload();
		}
	});

	window.addEventListener('resize', adjustGrid);
}
