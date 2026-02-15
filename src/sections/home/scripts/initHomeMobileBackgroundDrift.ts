import { gsap } from 'gsap';

/**
 * Home mobile background drift (main gradient radials)
 * ---------------------------------------------------
 *
 * How it works:
 * 1) As `#home-content` scrolls, we normalize scrollTop -> progress (0..1).
 * 2) We tween an internal progress value with GSAP so gradient motion lags behind scroll.
 * 3) For each frame, we apply subtle per-radial positional drift and size variation and write CSS vars on `main`:
 *    `--home-bg-radial-{1|2|3}-{x|y|size-x|size-y}`.
 * 4) We also modulate each radial alpha with a phased sine wave and write:
 *    `--home-bg-radial-{1|2|3}-alpha`.
 * 5) CSS consumes all vars in `home-global.css` to move centers + vary glow intensity.
 *
 * Radial roles:
 * - radial 1: neutral glow
 * - radial 2: main color glow
 * - radial 3: companion/shadow for radial 2
 */
const MOBILE_QUERY = '(max-width: 1280px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const CLEANUP_KEY = '__homeMobileBackgroundDriftCleanup__';
const TAU = Math.PI * 2;

/**
 * Motion tuning:
 * - `TWEEN_*` controls delayed follow behavior.
 * - `RADIAL_DRIFT_SPECS` controls each radial's base center, base size, and drift range.
 * - `ALPHA_VARIATION` adds phased glow changes so layers don't pulse in sync.
 */
const TWEEN_DURATION = 1.05;
const TWEEN_EASE = 'power2.out';
const PROGRESS_EASE = 'sine.inOut';

type RadialDriftSpec = {
	baseX: number;
	baseY: number;
	driftX: number;
	driftY: number;
	baseSizeX: number;
	baseSizeY: number;
	sizeDriftX: number;
	sizeDriftY: number;
	sizePhase: number;
	baseAlpha: number;
};

const RADIAL_DRIFT_SPECS: readonly [RadialDriftSpec, RadialDriftSpec, RadialDriftSpec] = [
	{
		baseX: 12,
		baseY: 5,
		driftX: 6,
		driftY: 8,
		baseSizeX: 120,
		baseSizeY: 120,
		sizeDriftX: 5,
		sizeDriftY: 4,
		sizePhase: 0.08,
		baseAlpha: 0.04,
	},
	{
		baseX: 85,
		baseY: 10,
		driftX: -5,
		driftY: 7,
		baseSizeX: 130,
		baseSizeY: 130,
		sizeDriftX: 6,
		sizeDriftY: 5,
		sizePhase: 0.31,
		baseAlpha: 0.08,
	},
	{
		baseX: 85,
		baseY: 10,
		driftX: 4,
		driftY: 6,
		baseSizeX: 130,
		baseSizeY: 130,
		sizeDriftX: 5,
		sizeDriftY: 4,
		sizePhase: 0.57,
		baseAlpha: 0.1,
	},
] as const;

const ALPHA_VARIATION = {
	amount: 0.03,
	cyclesAcrossScroll: 4.25,
	phaseOffsets: [0, 0.21, 0.46] as const,
} as const;

const SIZE_VARIATION = {
	cyclesAcrossScroll: 2.35,
} as const;

const BACKGROUND_CSS_VARS = [
	'--home-bg-radial-1-x',
	'--home-bg-radial-1-y',
	'--home-bg-radial-1-size-x',
	'--home-bg-radial-1-size-y',
	'--home-bg-radial-1-alpha',
	'--home-bg-radial-2-x',
	'--home-bg-radial-2-y',
	'--home-bg-radial-2-size-x',
	'--home-bg-radial-2-size-y',
	'--home-bg-radial-2-alpha',
	'--home-bg-radial-3-x',
	'--home-bg-radial-3-y',
	'--home-bg-radial-3-size-x',
	'--home-bg-radial-3-size-y',
	'--home-bg-radial-3-alpha',
] as const;

declare global {
	interface Window {
		__homeMobileBackgroundDriftCleanup__?: () => void;
	}
}

function clamp01(value: number) {
	return Math.max(0, Math.min(1, value));
}

function getScrollProgress(scrollContainer: HTMLElement) {
	// Use the container's own scroll range because mobile home scrolls inside `#home-content`.
	const maxScrollTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
	if (maxScrollTop === 0) return 0;
	return clamp01(scrollContainer.scrollTop / maxScrollTop);
}

function clearBackgroundVars(mainEl: HTMLElement) {
	BACKGROUND_CSS_VARS.forEach((variableName) => {
		mainEl.style.removeProperty(variableName);
	});
}

export function initHomeMobileBackgroundDrift() {
	// Re-init safe for Astro client-side page transitions.
	window[CLEANUP_KEY]?.();

	const mainEl = document.querySelector<HTMLElement>('main');
	const homeContent = document.querySelector<HTMLElement>('#home-content');
	if (!mainEl || !homeContent) return;

	const mobileMedia = window.matchMedia(MOBILE_QUERY);
	const reducedMotionMedia = window.matchMedia(REDUCED_MOTION_QUERY);
	const progressEase = gsap.parseEase(PROGRESS_EASE);
	const progressState = { value: 0 };
	let progressTween: GSAPTween | null = null;
	let isListening = false;

	const applyProgress = (progress: number) => {
		const easedProgress = progressEase(clamp01(progress));
		RADIAL_DRIFT_SPECS.forEach((radial, index) => {
			const x = radial.baseX + radial.driftX * easedProgress;
			const y = radial.baseY + radial.driftY * easedProgress;
			const sizeWave = Math.sin((progress * SIZE_VARIATION.cyclesAcrossScroll + radial.sizePhase) * TAU);
			const sizeX = radial.baseSizeX + sizeWave * radial.sizeDriftX;
			const sizeY = radial.baseSizeY + sizeWave * radial.sizeDriftY;

			// Phase-shifted pulsing keeps glow variation organic without synchronized flashes.
			const phase = ALPHA_VARIATION.phaseOffsets[index] ?? 0;
			const wave01 = 0.5 + 0.5 * Math.sin((progress * ALPHA_VARIATION.cyclesAcrossScroll + phase) * TAU);
			const alpha = clamp01(radial.baseAlpha + wave01 * ALPHA_VARIATION.amount);

			// Bridge JS -> CSS by updating vars used in the `main` radial-gradient definitions.
			mainEl.style.setProperty(`--home-bg-radial-${index + 1}-x`, `${x.toFixed(2)}%`);
			mainEl.style.setProperty(`--home-bg-radial-${index + 1}-y`, `${y.toFixed(2)}%`);
			mainEl.style.setProperty(`--home-bg-radial-${index + 1}-size-x`, `${sizeX.toFixed(2)}%`);
			mainEl.style.setProperty(`--home-bg-radial-${index + 1}-size-y`, `${sizeY.toFixed(2)}%`);
			mainEl.style.setProperty(`--home-bg-radial-${index + 1}-alpha`, `${alpha.toFixed(3)}`);
		});
	};

	const animateToScrollProgress = () => {
		const nextProgress = getScrollProgress(homeContent);
		progressTween?.kill();
		// This tween creates the delayed "follow" behavior instead of strict scroll lock.
		progressTween = gsap.to(progressState, {
			value: nextProgress,
			duration: TWEEN_DURATION,
			ease: TWEEN_EASE,
			overwrite: true,
			onUpdate: () => {
				applyProgress(progressState.value);
			},
		});
	};

	const addListeners = () => {
		if (isListening) return;
		isListening = true;
		homeContent.addEventListener('scroll', animateToScrollProgress, { passive: true });
		window.addEventListener('resize', animateToScrollProgress);
	};

	const removeListeners = () => {
		if (!isListening) return;
		isListening = false;
		homeContent.removeEventListener('scroll', animateToScrollProgress);
		window.removeEventListener('resize', animateToScrollProgress);
	};

	const refresh = () => {
		const shouldAnimate = mobileMedia.matches && !reducedMotionMedia.matches;
		if (!shouldAnimate) {
			// Desktop / reduced-motion: remove listeners and let CSS fallback positions take over.
			removeListeners();
			progressTween?.kill();
			progressTween = null;
			clearBackgroundVars(mainEl);
			return;
		}

		addListeners();
		progressState.value = getScrollProgress(homeContent);
		applyProgress(progressState.value);
	};
	// Re-run setup if viewport crosses mobile breakpoint or reduced-motion changes.
	mobileMedia.addEventListener('change', refresh);
	reducedMotionMedia.addEventListener('change', refresh);

	refresh();

	window[CLEANUP_KEY] = () => {
		removeListeners();
		progressTween?.kill();
		progressTween = null;
		clearBackgroundVars(mainEl);
		mobileMedia.removeEventListener('change', refresh);
		reducedMotionMedia.removeEventListener('change', refresh);
	};
}
