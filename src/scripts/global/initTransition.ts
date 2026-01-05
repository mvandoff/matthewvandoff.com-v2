import gsap from 'gsap';

import { waitForAboutLayoutReady } from './aboutLayoutReady';

function adjustGrid() {
	const transition = document.getElementById('transition');
	if (!transition) return console.warn('Transition element not found');

	const blockSizePx = getBlockSizePxFromCss(transition, 64);
	const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
	const viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
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

function getBlockSizePxFromCss(transition: HTMLElement, fallbackPx: number): number {
	const computedStyle = window.getComputedStyle(transition);
	const raw = computedStyle.getPropertyValue('grid-auto-columns').trim();
	if (!raw) return fallbackPx;
	const match = raw.match(/^(-?\d*\.?\d+)px$/);
	if (!match) return fallbackPx;
	const value = Number(match[1]);
	return Number.isFinite(value) && value > 0 ? value : fallbackPx;
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
 *
 * Special case (About page):
 * - About runs DOM-driven layout snapping on load (`initAbout()`), which can cause layout shift.
 * - To prevent that shift from being visible, we delay the page-load “reveal” animation on the
 *   About route until the About script signals that layout is ready.
 */

export async function initTransition() {
	/**
	 * The transition overlay is a CSS grid whose row count depends on viewport dimensions.
	 * We build the grid dynamically to ensure full coverage across responsive breakpoints.
	 */
	adjustGrid();

	/**
	 * Page-load reveal timeline.
	 * We build the timeline first, but keep it paused until any required “readiness” gates resolve.
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

	/**
	 * Gate the reveal on About's layout being settled.
	 * On non-About routes this returns immediately.
	 */
	await waitForAboutLayoutReady({ timeoutMs: 3000 });

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
