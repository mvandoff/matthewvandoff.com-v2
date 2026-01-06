/**
 * About page: scroll-driven image distortion
 * -----------------------------------------
 *
 * This powers the “digital distortion” effect on the About headshot.
 *
 * How it works:
 * - The About page defines an SVG filter (`#about-scroll-distort`) composed of:
 *   - `feTurbulence` to generate a noisy displacement field
 *   - `feDisplacementMap` to apply that noise to the image
 * - On scroll, we estimate scroll velocity and map it to an intensity (0..1).
 * - We then update the filter attributes (noise frequency + displacement scale)
 *   and a CSS custom property (`--about-scroll-blur`) to blur the image slightly.
 *
 * Why the effect looks “blocky”:
 * - Values are quantized (snapped) to small steps.
 * - The noise frequency is derived from the site's block grid size so the
 *   distortion cells line up with the background block grid.
 */

export function initAboutScrollDistortion(params: {
	meDistortEl: HTMLElement | null;
	turbulenceEl: SVGFETurbulenceElement | null;
	displacementEl: SVGFEDisplacementMapElement | null;
	getBlockSizePx: () => number;
}) {
	const { meDistortEl, turbulenceEl, displacementEl, getBlockSizePx } = params;
	if (!meDistortEl || !turbulenceEl || !displacementEl) return;
	if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;

	// Capture non-null refs for use inside rAF callbacks (TS won’t narrow captured variables).
	const wrapperEl = meDistortEl;
	const turbulence = turbulenceEl;
	const displacement = displacementEl;

	let latestScrollY = window.scrollY;
	let lastScrollY = latestScrollY;
	let ticking = false;
	let velocityPxPerMs = 0;
	let lastFrameTs = performance.now();
	let lastScrollTs = lastFrameTs;
	let lastDirection: 1 | -1 = 1;

	function quantize(value: number, step: number) {
		if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) return value;
		return Math.round(value / step) * step;
	}

	function applyIntensity(intensity01: number, direction: 1 | -1) {
		const blockSizePx = Math.max(1, getBlockSizePx());
		const intensitySteps = 6;
		const steppedIntensity01 = quantize(intensity01, 1 / intensitySteps);

		// Snap the effect to “grid” increments to keep it blocky.
		const blurStepPx = 0.25;
		const displacementStepPx = 2;

		const blurPx = quantize(steppedIntensity01 * 1.75, blurStepPx);
		const displacementScale = quantize(steppedIntensity01 * Math.min(32, blockSizePx * 0.55), displacementStepPx);

		// Align distortion cell size with the site’s block grid.
		const baseFreq = 1 / (blockSizePx * 1.25); // period ~= 1.25 blocks
		const freq = baseFreq * (1 + steppedIntensity01 * 1.5);
		const baseFreqX = quantize(freq, baseFreq / 4);
		const baseFreqY = quantize(freq * 1.8, baseFreq / 4);

		// `scale` supports negative values; we flip it based on scroll direction to make the
		// distortion feel “dragged” by the scroll.
		const signedScale = displacementScale * direction;

		wrapperEl.style.setProperty('--about-scroll-blur', `${blurPx.toFixed(2)}px`);
		displacement.setAttribute('scale', signedScale.toFixed(1));
		turbulence.setAttribute('baseFrequency', `${baseFreqX.toFixed(4)} ${baseFreqY.toFixed(4)}`);
	}

	function update(ts: number) {
		const dt = Math.max(1, ts - lastFrameTs);
		lastFrameTs = ts;

		const dy = latestScrollY - lastScrollY;
		lastScrollY = latestScrollY;

		const instantaneousPxPerMs = dy / dt;
		velocityPxPerMs = velocityPxPerMs * 0.85 + instantaneousPxPerMs * 0.15;

		const idleMs = ts - lastScrollTs;
		if (idleMs > 80) velocityPxPerMs *= 0.85;

		const speed = Math.abs(velocityPxPerMs); // px/ms
		const intensity01 = Math.min(1, speed / 1.5); // ~1500px/s maps to 1.0

		// Avoid rapid direction flipping around 0 velocity (reads as "shaking").
		// Only update direction once the scroll is meaningfully moving.
		if (speed > 0.05) lastDirection = velocityPxPerMs >= 0 ? (1 as const) : (-1 as const);

		applyIntensity(intensity01, lastDirection);

		// Keep animating while the user is still scrolling / decelerating.
		if (intensity01 > 0.001 || idleMs < 200) {
			requestAnimationFrame(update);
		} else {
			applyIntensity(0, 1);
			ticking = false;
		}
	}

	function handleScroll() {
		latestScrollY = window.scrollY;
		lastScrollTs = performance.now();
		if (ticking) return;
		ticking = true;
		lastFrameTs = lastScrollTs;
		requestAnimationFrame(update);
	}

	window.addEventListener('scroll', handleScroll, { passive: true });
}
