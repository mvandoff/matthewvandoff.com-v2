import gsap from 'gsap';

function adjustGrid() {
	const transition = document.getElementById('transition') as HTMLElement;

	const blockSizePx = getBlockSizePxFromCss(transition);
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;
	const columns = Math.max(1, Math.ceil(viewportWidth / blockSizePx));
	const rowsNeeded = Math.max(1, Math.ceil(viewportHeight / blockSizePx));

	// Update grid styles
	transition.style.gridTemplateColumns = `repeat(${columns}, ${blockSizePx}px)`;
	transition.style.gridTemplateRows = `repeat(${rowsNeeded}, ${blockSizePx}px)`;

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

function getBlockSizePxFromCss(transition: HTMLElement): number {
	const raw = window.getComputedStyle(transition).getPropertyValue('grid-auto-columns');
	if (!Number.isFinite(Number.parseFloat(raw))) throw new Error(`Invalid transition block size: ${raw}`);
	return Number.parseFloat(raw);
}

/**
 * Transition lifecycle overview:
 *
 * 1) Page load:
 *    - Transition overlay starts fully opaque (blocks cover the screen).
 *    - We animate blocks out (opacity -> 0) to reveal the page.
 *
 * 2) In-app navigation:
 *    - Intercept same-origin links.
 *    - Animate blocks in (autoAlpha -> 1) to cover the screen.
 *    - Only once the screen is covered do we navigate to the destination URL.
 */

export function initTransition() {
	/**
	 * The transition overlay is a CSS grid whose row count depends on viewport dimensions.
	 * We build the grid dynamically to ensure full coverage across responsive breakpoints.
	 */
	adjustGrid();

	/**
	 * Page-load reveal timeline.
	 * Build the timeline first, then play it to reveal the page.
	 */
	const pageLoadTimeline = gsap.timeline({
		paused: true,
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
	pageLoadTimeline.play(0);

	/**
	 * In-app navigation interception.
	 *
	 * We only intercept:
	 * - Same-origin links
	 * - Non-anchor links
	 * - Non-_blank targets
	 * - Links not explicitly opting out via `data-transition-prevent`
	 */
	const validLinks: HTMLAnchorElement[] = Array.from(
		document.querySelectorAll<HTMLAnchorElement>('a[href]'),
	).filter(
		(link: HTMLAnchorElement) => {
			const href = link.getAttribute('href')!;

			// Ignore "dead" anchors or placeholders (no href / empty href).
			if (!href) return false;

			return (
				!href.startsWith('#') && // Not an anchor link
				new URL(link.href).origin === window.location.origin && // Same origin
				link.getAttribute('target') !== '_blank' && // Not opening in a new tab
				!link.hasAttribute('data-transition-prevent') // No 'data-transition-prevent' attribute
			);
		},
	);

	// Add event listeners to pre-processed valid links
	validLinks.forEach((link: HTMLAnchorElement) => {
		link.addEventListener('pointerdown', (event: MouseEvent) => {
			event.preventDefault();

			// Intercept mouseleave event. Prevents the current page nav link from re-highlighting when transition starts.
			validLinks.forEach((vl: HTMLAnchorElement) =>
				vl.addEventListener('mouseleave', (e) => e.stopImmediatePropagation(), true),
			);
			link.classList.add('transitioning');

			const destination: string = link.href;

			/**
			 * Cover the current page before navigation.
			 * The destination load happens only once the overlay fully covers the viewport.
			 */
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

	/**
	 * If the page is restored from bfcache (back/forward cache), our one-shot transition state
	 * and listeners can be stale. For consistency, we hard-reload on persisted pageshow.
	 */
	window.addEventListener('pageshow', (event: PageTransitionEvent) => {
		if (event.persisted) {
			window.location.reload();
		}
	});

	/**
	 * Rebuild the transition grid on resize so it always covers the viewport.
	 */
	window.addEventListener('resize', adjustGrid);
}
