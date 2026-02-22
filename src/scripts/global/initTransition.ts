import gsap from 'gsap';

/**
 * Block-grid page transition with an embedded logo.
 *
 * Implementation details:
 * - The overlay is rebuilt as a CSS grid sized from `--transition-block-size` so it always covers the viewport.
 * - A centered logo rect is computed in viewport space, then snapped to block-aligned width for clean slicing.
 * - Each generated block checks whether it overlaps that logo rect.
 * - Overlapping blocks get `.transition-block--logo` plus CSS custom properties that describe:
 *   - the full logo render size (`--transition-logo-width/height`)
 *   - that block's offset into the shared logo image (`--transition-logo-pos-x/y`)
 * - In `Transition.astro`, a `::before` pseudo-element uses the same background image on every logo block
 *   and shifts `background-position` per block so the blocks assemble into one logo.
 *
 * Because the logo is rendered inside the transition blocks (not as a separate overlay element),
 * the existing GSAP block opacity/autoAlpha staggers automatically make the logo reveal/hide in chunks
 * during both page-load reveal and nav-click cover transitions.
 */
const mvdLogoMaskUrl = new URL('../../assets/images/mvd-logo-mask.svg', import.meta.url).href;

const TRANSITION_STAGGER_FROM: 'random' = 'random';

// Primary animation timing controls for the reveal (page load) and cover (nav click) phases.
// `staggerAmount` controls the overall wave duration more than the per-block duration does.
const TRANSITION_TIMING = {
	pageLoadStartDelay: 0.1,
	pageLoadBlockDuration: 0.1,
	pageLoadStaggerAmount: 1,
	navCoverBlockDuration: 0.001,
	navCoverStaggerAmount: 0.75,
} as const;

// Centered logo sizing heuristic for the transition grid.
// Width is snapped to whole blocks so the sliced logo aligns cleanly with the block grid.
const TRANSITION_LOGO_LAYOUT = {
	// Leave a small number of columns free so the logo does not run edge-to-edge.
	horizontalBlockMargin: 2,
	// Minimum logo width in block units, split by viewport size.
	mobileMinBlocks: 6,
	desktopMinBlocks: 6,
	// Preferred logo width before clamping, based on viewport width.
	viewportWidthRatio: 0.5,
	maxWidthPx: 720,
	mobileBreakpointPx: 640,
} as const;

const MVD_LOGO_VIEWBOX_WIDTH = 73;
const MVD_LOGO_VIEWBOX_HEIGHT = 23;

type Rect = {
	left: number;
	top: number;
	width: number;
	height: number;
};

function adjustGrid() {
	const transition = document.getElementById('transition') as HTMLElement;

	const blockSizePx = getBlockSizePxFromCss(transition);
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;
	const columns = Math.max(1, Math.ceil(viewportWidth / blockSizePx));
	const rowsNeeded = Math.max(1, Math.ceil(viewportHeight / blockSizePx));

	// Keep explicit grid tracks in sync with the current viewport so the overlay fully covers the screen.
	transition.style.gridTemplateColumns = `repeat(${columns}, ${blockSizePx}px)`;
	transition.style.gridTemplateRows = `repeat(${rowsNeeded}, ${blockSizePx}px)`;

	// Compute a centered logo footprint in viewport coordinates before creating blocks.
	const totalBlocks = columns * rowsNeeded;
	const logoRect = getCenteredLogoRect({
		blockSizePx,
		columns,
		viewportWidth,
		viewportHeight,
	});

	// Rebuild blocks from scratch so resize updates both coverage and logo slicing offsets.
	transition.innerHTML = '';
	transition.style.setProperty('--transition-logo-url', `url("${mvdLogoMaskUrl}")`);

	// Generate blocks and tag only the ones that should render a slice of the logo image.
	for (let i = 0; i < totalBlocks; i++) {
		const block: HTMLDivElement = document.createElement('div');
		block.classList.add('transition-block');
		applyLogoSliceStyles({
			block,
			blockIndex: i,
			columns,
			blockSizePx,
			logoRect,
		});
		transition.appendChild(block);
	}

	// Page-load reveal expects the overlay to start fully visible.
	gsap.set('.transition-block', { opacity: 1 });
}

function getBlockSizePxFromCss(transition: HTMLElement): number {
	const raw = window.getComputedStyle(transition).getPropertyValue('grid-auto-columns');
	if (!Number.isFinite(Number.parseFloat(raw))) throw new Error(`Invalid transition block size: ${raw}`);
	return Number.parseFloat(raw);
}

// Returns a centered logo rect sized in whole-block increments so slices line up with the grid.
function getCenteredLogoRect({
	blockSizePx,
	columns,
	viewportWidth,
	viewportHeight,
}: {
	blockSizePx: number;
	columns: number;
	viewportWidth: number;
	viewportHeight: number;
}): Rect {
	const maxLogoBlocks = Math.max(3, columns - TRANSITION_LOGO_LAYOUT.horizontalBlockMargin);
	const minLogoBlocks = Math.min(
		maxLogoBlocks,
		viewportWidth < TRANSITION_LOGO_LAYOUT.mobileBreakpointPx
			? TRANSITION_LOGO_LAYOUT.mobileMinBlocks
			: TRANSITION_LOGO_LAYOUT.desktopMinBlocks,
	);
	const desiredLogoBlocks = Math.max(
		minLogoBlocks,
		Math.round(
			Math.min(viewportWidth * TRANSITION_LOGO_LAYOUT.viewportWidthRatio, TRANSITION_LOGO_LAYOUT.maxWidthPx) /
				blockSizePx,
		),
	);
	const logoBlocks = Math.min(maxLogoBlocks, desiredLogoBlocks);
	const width = logoBlocks * blockSizePx;
	const height = (width * MVD_LOGO_VIEWBOX_HEIGHT) / MVD_LOGO_VIEWBOX_WIDTH;

	return {
		left: (viewportWidth - width) / 2,
		top: (viewportHeight - height) / 2,
		width,
		height,
	};
}

// Applies per-block CSS vars so the block's pseudo-element renders the correct logo slice.
function applyLogoSliceStyles({
	block,
	blockIndex,
	columns,
	blockSizePx,
	logoRect,
}: {
	block: HTMLDivElement;
	blockIndex: number;
	columns: number;
	blockSizePx: number;
	logoRect: Rect;
}) {
	const column = blockIndex % columns;
	const row = Math.floor(blockIndex / columns);
	const blockLeft = column * blockSizePx;
	const blockTop = row * blockSizePx;

	if (
		!rectanglesOverlap(
			{
				left: blockLeft,
				top: blockTop,
				width: blockSizePx,
				height: blockSizePx,
			},
			logoRect,
		)
	) {
		return;
	}

	block.classList.add('transition-block--logo');
	block.style.setProperty('--transition-logo-width', `${logoRect.width}px`);
	block.style.setProperty('--transition-logo-height', `${logoRect.height}px`);
	block.style.setProperty('--transition-logo-pos-x', `${logoRect.left - blockLeft}px`);
	block.style.setProperty('--transition-logo-pos-y', `${logoRect.top - blockTop}px`);
}

function rectanglesOverlap(a: Rect, b: Rect): boolean {
	return a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;
}

/**
 * Transition lifecycle overview:
 *
 * 1) Page load:
 *    - Transition overlay starts fully opaque (blocks cover the screen, including logo slices).
 *    - We animate blocks out (opacity -> 0) to reveal the page.
 *
 * 2) In-app navigation:
 *    - Intercept same-origin links.
 *    - Animate blocks in (autoAlpha -> 1) to cover the screen (logo slices appear with those blocks).
 *    - Only once the screen is covered do we navigate to the destination URL.
 */

export function initTransition() {
	/**
	 * Build the grid once on startup so the first paint already has the correct block count
	 * and per-block logo slicing metadata.
	 */
	adjustGrid();

	// Page-load reveal timeline (auto-plays immediately after creation).
	gsap
		.timeline({
			onStart: () => {
				gsap.set('#transition', { background: 'transparent' });
			},
			onComplete: () => {
				gsap.set('#transition', { display: 'none' });
			},
			defaults: {
				ease: 'linear',
			},
		})
		.to(
			'.transition-block',
			{
				opacity: 0,
				duration: TRANSITION_TIMING.pageLoadBlockDuration,
				stagger: { amount: TRANSITION_TIMING.pageLoadStaggerAmount, from: TRANSITION_STAGGER_FROM },
			},
			TRANSITION_TIMING.pageLoadStartDelay,
		);

	/**
	 * In-app navigation interception.
	 *
	 * We only intercept:
	 * - Same-origin links
	 * - Non-anchor links
	 * - Non-_blank targets
	 * - Links not explicitly opting out via `data-transition-prevent`
	 */
	const validLinks: HTMLAnchorElement[] = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).filter(
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
					duration: TRANSITION_TIMING.navCoverBlockDuration,
					ease: 'linear',
					stagger: { amount: TRANSITION_TIMING.navCoverStaggerAmount, from: TRANSITION_STAGGER_FROM },
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
