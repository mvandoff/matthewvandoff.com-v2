const DEFAULT_INTRO_SELECTOR = '.intro-container.liquid';
const DEFAULT_READY_ATTR = 'data-liquid-local-ready';
const LOCAL_STAGE_CLASS = 'mb-liquid-local-stage';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const getLiquidOpacity = (rawValue: string | undefined | null, fallback = 1) => {
	const parsed = Number.parseFloat(rawValue ?? '');
	if (!Number.isFinite(parsed)) return fallback;
	return clamp(parsed, 0, 1);
};

const getRectInScope = (target: HTMLElement, scope: HTMLElement) => {
	const targetRect = target.getBoundingClientRect();
	const scopeRect = scope.getBoundingClientRect();
	return {
		left: targetRect.left - scopeRect.left,
		top: targetRect.top - scopeRect.top,
		width: targetRect.width,
		height: targetRect.height,
	};
};

interface IntroLiquidMirrorOptions {
	scope: HTMLElement;
	sourceStage: HTMLElement;
	introSelector?: string;
	readyAttr?: string;
}

/**
 * Creates an intro-local liquid layer by mirroring pixels from the shared Vanta stage.
 *
 * Why:
 * - We need the intro card's liquid to tilt with joystick transforms without tilting every
 *   other `.liquid` region in the hero.
 * - Running another Vanta/WebGL instance just for intro is unnecessary overhead.
 *
 * How:
 * - Inject a local canvas inside the intro container.
 * - Each frame, sample the matching source rectangle from the shared stage canvas and draw it
 *   into the local canvas with `data-liquid-opacity` applied.
 * - The intro container's existing transform pipeline then moves/tilts that local layer.
 */
export const initIntroLiquidMirror = ({
	scope,
	sourceStage,
	introSelector = DEFAULT_INTRO_SELECTOR,
	readyAttr = DEFAULT_READY_ATTR,
}: IntroLiquidMirrorOptions) => {
	const intro = scope.querySelector<HTMLElement>(introSelector);
	if (!intro) return;
	if (intro.hasAttribute(readyAttr)) return;

	const stage = document.createElement('div');
	stage.className = LOCAL_STAGE_CLASS;
	stage.setAttribute('aria-hidden', 'true');

	const canvas = document.createElement('canvas');
	canvas.setAttribute('aria-hidden', 'true');
	stage.append(canvas);
	intro.prepend(stage);
	intro.setAttribute(readyAttr, 'true');

	const ctx = canvas.getContext('2d', { alpha: true });
	if (!ctx) {
		stage.remove();
		intro.removeAttribute(readyAttr);
		return;
	}

	// Read the same declarative opacity contract used by the SVG mask path.
	const introOpacity = getLiquidOpacity(intro.dataset.liquidOpacity);

	// The home mobile layout uses scroll snapping, so the hero can be fully offscreen while the
	// page is still active. Pause the mirror loop in that case to avoid unnecessary draws.
	const observedScreen = intro.closest<HTMLElement>('.screen') ?? scope;
	let frameHandle: number | null = null;
	let isDisposed = false;
	let isScreenVisible = true;

	const cancelFrame = () => {
		if (frameHandle === null) return;
		cancelAnimationFrame(frameHandle);
		frameHandle = null;
	};

	let intersectionObserver: IntersectionObserver | null = null;
	if ('IntersectionObserver' in window) {
		intersectionObserver = new IntersectionObserver(
			(entries) => {
				const [entry] = entries;
				if (!entry || isDisposed) return;
				isScreenVisible = entry.isIntersecting;
				if (isScreenVisible) scheduleDraw();
				else cancelFrame();
			},
			{ threshold: 0 },
		);
		intersectionObserver.observe(observedScreen);
	}

	const cleanup = () => {
		if (isDisposed) return;
		isDisposed = true;
		cancelFrame();
		intersectionObserver?.disconnect();
		stage.remove();
		intro.removeAttribute(readyAttr);
	};

	// Mirror the shared Vanta canvas into a local intro canvas each frame.
	// This keeps one WebGL effect while allowing intro-only transforms.
	const draw = () => {
		frameHandle = null;
		if (isDisposed) return;
		if (!isScreenVisible) return;

		if (!sourceStage.isConnected || !intro.isConnected || !stage.isConnected) {
			cleanup();
			return;
		}

		const source = sourceStage.querySelector<HTMLCanvasElement>('canvas');
		if (!source || !source.width || !source.height) {
			scheduleDraw();
			return;
		}

		const stageWidth = sourceStage.clientWidth;
		const stageHeight = sourceStage.clientHeight;
		if (!stageWidth || !stageHeight) {
			scheduleDraw();
			return;
		}

		const introRect = getRectInScope(intro, scope);
		if (!introRect.width || !introRect.height) {
			scheduleDraw();
			return;
		}

		const scaleX = source.width / stageWidth;
		const scaleY = source.height / stageHeight;
		const sx = clamp(introRect.left * scaleX, 0, source.width - 1);
		const sy = clamp(introRect.top * scaleY, 0, source.height - 1);
		const sw = clamp(introRect.width * scaleX, 1, source.width - sx);
		const sh = clamp(introRect.height * scaleY, 1, source.height - sy);
		const targetWidth = Math.max(1, Math.round(sw));
		const targetHeight = Math.max(1, Math.round(sh));

		if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
			canvas.width = targetWidth;
			canvas.height = targetHeight;
		}

		// With alpha < 1, old pixels must be cleared or opacity compounds frame-over-frame.
		if (introOpacity < 1) ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.globalAlpha = introOpacity;
		ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
		ctx.globalAlpha = 1;
		scheduleDraw();
	};

	function scheduleDraw() {
		if (isDisposed) return;
		if (!isScreenVisible) return;
		if (frameHandle !== null) return;
		frameHandle = requestAnimationFrame(draw);
	}

	scheduleDraw();
	return cleanup;
};
