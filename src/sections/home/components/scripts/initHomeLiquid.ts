import * as THREE from 'three';
import FOG from 'vanta/dist/vanta.fog.min';
import { getLiquidOpacity, initIntroLiquidMirror } from './initIntroLiquidMirror';

const MOBILE_QUERY = '(max-width: 1280px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const CLEANUP_KEY = '__mbLiquidCleanup__' as const;
const WATCHER_CLEANUP_KEY = '__mbLiquidWatcherCleanup__' as const;
const MAIN_HUE_EVENT = 'mb-main-hue-change';
const LIQUID_READY_ATTR = 'data-liquid-ready';

const fallbackFogColors = {
	highlightColor: 0xb3b3b3,
	midtoneColor: 0x8c7373,
	lowlightColor: 0x462582,
	baseColor: 0x313131,
} as const;

let colorProbe: HTMLElement | null = null;

declare global {
	interface Window {
		__mbLiquidCleanup__?: () => void;
		__mbLiquidWatcherCleanup__?: () => void;
	}
}

/**
 * Initializes the Home mobile liquid effect and keeps one watcher instance per page lifecycle.
 */
export function initHomeLiquid() {
	if (window[WATCHER_CLEANUP_KEY]) return;

	const mobileMedia = window.matchMedia(MOBILE_QUERY);
	const reducedMotionMedia = window.matchMedia(REDUCED_MOTION_QUERY);
	let refreshQueued = false;

	const refresh = () => {
		if (refreshQueued) return;
		refreshQueued = true;
		requestAnimationFrame(() => {
			refreshQueued = false;
			if (!mobileMedia.matches || reducedMotionMedia.matches) {
				window[CLEANUP_KEY]?.();
				return;
			}
			mountHomeLiquid();
		});
	};

	mobileMedia.addEventListener('change', refresh);
	reducedMotionMedia.addEventListener('change', refresh);

	const cleanupWatcher = () => {
		mobileMedia.removeEventListener('change', refresh);
		reducedMotionMedia.removeEventListener('change', refresh);
		window[WATCHER_CLEANUP_KEY] = undefined;
		window[CLEANUP_KEY]?.();
	};

	window[WATCHER_CLEANUP_KEY] = cleanupWatcher;
	document.addEventListener('astro:before-swap', cleanupWatcher, { once: true });
	refresh();
}

const getColorProbe = () => {
	if (colorProbe?.isConnected) return colorProbe;
	const probe = document.createElement('span');
	probe.style.cssText =
		'position:absolute;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none;width:0;height:0;';
	probe.setAttribute('aria-hidden', 'true');
	(document.body ?? document.documentElement).appendChild(probe);
	colorProbe = probe;
	return probe;
};

// Resolve CSS vars to computed color strings so Vanta can consume theme colors directly.
const resolveCssColorVar = (varName: string, fallback: number) => {
	const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
	if (!raw) return fallback;
	const probe = getColorProbe();
	probe.style.color = `var(${varName})`;
	const resolved = getComputedStyle(probe).color.trim();
	return resolved || raw;
};

const getFogColors = () => {
	const highlight = resolveCssColorVar('--main-100', fallbackFogColors.highlightColor);
	const midtone = resolveCssColorVar('--main-400', fallbackFogColors.midtoneColor);
	const lowlight = resolveCssColorVar('--main-600', fallbackFogColors.lowlightColor);
	const base = resolveCssColorVar('--main-950', fallbackFogColors.baseColor);

	return {
		highlightColor: highlight,
		midtoneColor: midtone,
		lowlightColor: lowlight,
		baseColor: base,
	};
};

const getRadiusPx = (el: HTMLElement) => {
	const styles = getComputedStyle(el);
	const radii = [
		styles.borderTopLeftRadius,
		styles.borderTopRightRadius,
		styles.borderBottomRightRadius,
		styles.borderBottomLeftRadius,
	].map((value) => Number.parseFloat(value) || 0);
	return Math.max(0, Math.min(...radii));
};

const mountHomeLiquid = () => {
	const fogEl = document.querySelector<HTMLElement>('#mb-liquid-stage');
	const alphaMaskEl = document.querySelector<SVGMaskElement>('#mb-liquid-alpha-mask');
	if (!fogEl || !alphaMaskEl) return;
	if (fogEl.hasAttribute(LIQUID_READY_ATTR)) return;

	window[CLEANUP_KEY]?.();

	const scope = fogEl.closest<HTMLElement>('.screen-hero') ?? document.body;
	const getTargets = () => Array.from(scope.querySelectorAll<HTMLElement>('.liquid:not(.intro-container)'));
	if (getTargets().length === 0) return;
	fogEl.setAttribute(LIQUID_READY_ATTR, 'true');

	const fogColors = getFogColors();
	const effect = FOG({
		el: fogEl,
		THREE,
		mouseControls: false,
		touchControls: false,
		gyroControls: false,
		minHeight: 0,
		minWidth: 0,
		highlightColor: fogColors.highlightColor,
		midtoneColor: fogColors.midtoneColor,
		lowlightColor: fogColors.lowlightColor,
		baseColor: fogColors.baseColor,
		blurFactor: 0.26,
		zoom: 0.08,
		speed: 0.5,
	});

	let updateQueued = false;
	const scheduleColorUpdate = () => {
		if (updateQueued) return;
		updateQueued = true;
		requestAnimationFrame(() => {
			updateQueued = false;
			if (typeof effect?.setOptions !== 'function') return;
			effect.setOptions(getFogColors());
		});
	};

	window.addEventListener(MAIN_HUE_EVENT, scheduleColorUpdate);
	const cleanupIntroMirror = initIntroLiquidMirror({ scope, sourceStage: fogEl });

	let resizeObserver: ResizeObserver | null = null;
	const observedTargets = new WeakSet<HTMLElement>();
	let maskUpdateQueued = false;
	// Geometry can change from multiple sources in one frame; coalesce to one mask rebuild.
	const scheduleMaskUpdate = () => {
		if (maskUpdateQueued) return;
		maskUpdateQueued = true;
		requestAnimationFrame(() => {
			maskUpdateQueued = false;
			if (!fogEl.isConnected || !alphaMaskEl.isConnected) return;
			updateMask();
		});
	};

	// Rebuild the SVG alpha mask so fog only renders inside current `.liquid` target bounds.
	const updateMask = () => {
		const stageRect = fogEl.getBoundingClientRect();
		if (!stageRect.width || !stageRect.height) return;
		const rects: SVGRectElement[] = [];
		alphaMaskEl.setAttribute('x', '0');
		alphaMaskEl.setAttribute('y', '0');
		alphaMaskEl.setAttribute('width', `${Math.round(stageRect.width)}`);
		alphaMaskEl.setAttribute('height', `${Math.round(stageRect.height)}`);
		const targets = getTargets();

		targets.forEach((target) => {
			const targetRect = target.getBoundingClientRect();
			if (!targetRect.width || !targetRect.height) return;

			const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
			// Store target coordinates in stage-local space so the mask tracks the fog canvas exactly.
			rect.setAttribute('x', `${Math.round(targetRect.left - stageRect.left)}`);
			rect.setAttribute('y', `${Math.round(targetRect.top - stageRect.top)}`);
			rect.setAttribute('width', `${Math.round(targetRect.width)}`);
			rect.setAttribute('height', `${Math.round(targetRect.height)}`);
			rect.setAttribute('fill', '#fff');
			rect.setAttribute('fill-opacity', `${getLiquidOpacity(target.dataset.liquidOpacity)}`);

			const radius = getRadiusPx(target);
			if (radius > 0) {
				rect.setAttribute('rx', `${radius}`);
				rect.setAttribute('ry', `${radius}`);
			}

			rects.push(rect);
			// Observe each target once; this catches late mobile layout settling without re-observing every rebuild.
			if (resizeObserver && !observedTargets.has(target)) {
				resizeObserver.observe(target);
				observedTargets.add(target);
			}
		});

		alphaMaskEl.replaceChildren(...rects);
	};

	updateMask();
	resizeObserver = new ResizeObserver(scheduleMaskUpdate);
	resizeObserver.observe(fogEl);
	// Scope-level observation catches container/grid shifts even when individual targets don't resize.
	resizeObserver.observe(scope);
	window.addEventListener('resize', scheduleMaskUpdate);
	scheduleMaskUpdate();

	let cleanedUp = false;
	const cleanup = () => {
		if (cleanedUp) return;
		cleanedUp = true;
		window.removeEventListener(MAIN_HUE_EVENT, scheduleColorUpdate);
		window.removeEventListener('resize', scheduleMaskUpdate);
		resizeObserver?.disconnect();
		resizeObserver = null;
		cleanupIntroMirror?.();
		if (typeof effect?.destroy === 'function') effect.destroy();
		alphaMaskEl.replaceChildren();
		fogEl.replaceChildren();
		fogEl.removeAttribute(LIQUID_READY_ATTR);
		if (colorProbe?.isConnected) colorProbe.remove();
		colorProbe = null;
		window[CLEANUP_KEY] = undefined;
	};

	window[CLEANUP_KEY] = cleanup;
	document.addEventListener('astro:before-swap', cleanup, { once: true });
};
