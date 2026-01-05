/**
 * About page layout readiness handshake
 * ------------------------------------
 *
 * Problem:
 * - The site uses a full-screen “block grid” transition overlay. On page load, the overlay starts
 *   fully covering the screen and then animates away (revealing the new page underneath).
 * - The About page performs DOM-driven layout adjustments during `initAbout()` (grid sizing +
 *   snapping elements to a block grid). Those adjustments can cause visible layout shift if the
 *   transition starts revealing the page before the layout has settled.
 *
 * Solution:
 * - `initTransition()` waits to start the reveal animation *on the About route* until the About
 *   page signals “layout ready”.
 * - `initAbout()` signals readiness only after it has rebuilt the grid and the browser has had
 *   time to paint the final snapped layout.
 *
 * Signaling mechanisms (redundant on purpose):
 * - A `window` flag (`window.__aboutLayoutReady`) for cheap synchronous checks.
 * - A body class (`.about-blocks-ready`) that is already used for CSS gating on About.
 * - A custom event (`about:layout-ready`) to wake any listeners without DOM polling.
 *
 * This module centralizes the contract so both sides stay consistent and well-documented.
 */

declare global {
	interface Window {
		/**
		 * Set to `true` once `initAbout()` has fully applied its layout adjustments and the
		 * browser has had a chance to paint the resulting layout.
		 */
		__aboutLayoutReady?: boolean;
	}
}

export const ABOUT_LAYOUT_READY_EVENT = 'about:layout-ready' as const;
export const ABOUT_LAYOUT_READY_BODY_CLASS = 'about-blocks-ready' as const;

export function isAboutPath(pathname: string) {
	return pathname === '/about' || pathname === '/about/';
}

export function isAboutLayoutReady() {
	return window.__aboutLayoutReady === true || document.body?.classList.contains(ABOUT_LAYOUT_READY_BODY_CLASS) === true;
}

/**
 * Called by the About page once its DOM-driven layout is settled.
 *
 * Why “double rAF”:
 * - The first `requestAnimationFrame` runs just before the next paint.
 * - Scheduling another rAF *inside* ensures we’ve crossed at least one paint boundary, so the
 *   snapped layout has actually been painted once before we allow the transition to reveal.
 *
 * This keeps the transition from revealing mid-adjustment (layout shift becomes visible).
 */
export function markAboutLayoutReadyAfterPaint() {
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			window.__aboutLayoutReady = true;
			document.body?.classList.add(ABOUT_LAYOUT_READY_BODY_CLASS);
			window.dispatchEvent(new Event(ABOUT_LAYOUT_READY_EVENT));
		});
	});
}

/**
 * Wait until the About page reports layout readiness, with a timeout so we can never deadlock
 * the transition (e.g. if About JS fails to execute for some reason).
 *
 * This is intentionally conservative:
 * - We listen for the explicit event.
 * - We also observe the body class, since that’s easy to set and already used in styles.
 * - We do an immediate check to avoid waiting if readiness was already signaled.
 * - After readiness is observed, we wait one more animation frame to give the browser a chance
 *   to paint the final state before we begin revealing.
 */
export async function waitForAboutLayoutReady(options?: { timeoutMs?: number }) {
	const timeoutMs = options?.timeoutMs ?? 3000;
	if (!isAboutPath(window.location.pathname)) return;
	if (isAboutLayoutReady()) return;

	await new Promise<void>((resolve) => {
		let resolved = false;
		let observer: MutationObserver | null = null;
		let timeoutId: number | null = null;

		const cleanup = () => {
			if (timeoutId !== null) window.clearTimeout(timeoutId);
			if (observer) observer.disconnect();
			window.removeEventListener(ABOUT_LAYOUT_READY_EVENT, onReady);
		};

		const finish = () => {
			if (resolved) return;
			resolved = true;
			cleanup();
			resolve();
		};

		const onReady = () => finish();
		timeoutId = window.setTimeout(() => finish(), timeoutMs);

		window.addEventListener(ABOUT_LAYOUT_READY_EVENT, onReady, { once: true });

		const tryObserveBodyClass = () => {
			if (!document.body) return false;
			observer = new MutationObserver(() => {
				if (isAboutLayoutReady()) finish();
			});
			observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
			return true;
		};

		// In very early execution, `document.body` might not exist yet.
		if (!tryObserveBodyClass()) {
			document.addEventListener(
				'DOMContentLoaded',
				() => {
					tryObserveBodyClass();
					if (isAboutLayoutReady()) finish();
				},
				{ once: true },
			);
		}

		// If readiness is already true (or flips synchronously), don't wait for observers/events.
		if (isAboutLayoutReady()) finish();
	});

	// Ensure we cross at least one paint boundary after the signal before revealing.
	await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

