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

// Resolve CSS vars to computed colors so Vanta can consume theme colors directly.
const resolveCssColorVar = (varName: string, fallback: number) => {
	const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
	if (!raw) return fallback;
	const probe = getColorProbe();
	probe.style.color = `var(${varName})`;
	return getComputedStyle(probe).color.trim() || raw;
};

const getFogColors = () => ({
	highlightColor: resolveCssColorVar('--main-100', fallbackFogColors.highlightColor),
	midtoneColor: resolveCssColorVar('--main-400', fallbackFogColors.midtoneColor),
	lowlightColor: resolveCssColorVar('--main-600', fallbackFogColors.lowlightColor),
	baseColor: resolveCssColorVar('--main-950', fallbackFogColors.baseColor),
});

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

	// Clear any previous page instance before wiring a new one.
	window[CLEANUP_KEY]?.();

	const scope = fogEl.closest<HTMLElement>('.screen-hero') ?? document.body;
	// The intro tile uses a local mirrored liquid stage so it can tilt independently.
	const getTargets = () => Array.from(scope.querySelectorAll<HTMLElement>('.liquid:not(.intro-container)'));
	if (getTargets().length === 0) return;
	fogEl.setAttribute(LIQUID_READY_ATTR, 'true');

	const effect = FOG({
		el: fogEl,
		THREE,
		mouseControls: false,
		touchControls: false,
		gyroControls: false,
		minHeight: 0,
		minWidth: 0,
		...getFogColors(),
		blurFactor: 0.26,
		zoom: 0.08,
		speed: 0.5,
	});

	let colorUpdateQueued = false;
	// Theme changes can fire rapidly; coalesce Vanta writes to one frame.
	const scheduleColorUpdate = () => {
		if (colorUpdateQueued) return;
		colorUpdateQueued = true;
		requestAnimationFrame(() => {
			colorUpdateQueued = false;
			if (typeof effect?.setOptions !== 'function') return;
			effect.setOptions(getFogColors());
		});
	};
	window.addEventListener(MAIN_HUE_EVENT, scheduleColorUpdate);

	const cleanupIntroMirror = initIntroLiquidMirror({ scope, sourceStage: fogEl });

	let maskUpdateQueued = false;
	// Coalesce geometry updates from resize + observer callbacks into one RAF pass.
	const scheduleMaskUpdate = () => {
		if (maskUpdateQueued) return;
		maskUpdateQueued = true;
		requestAnimationFrame(() => {
			maskUpdateQueued = false;
			if (!fogEl.isConnected || !alphaMaskEl.isConnected) return;

			const stageRect = fogEl.getBoundingClientRect();
			if (!stageRect.width || !stageRect.height) return;

			alphaMaskEl.setAttribute('x', '0');
			alphaMaskEl.setAttribute('y', '0');
			alphaMaskEl.setAttribute('width', `${Math.round(stageRect.width)}`);
			alphaMaskEl.setAttribute('height', `${Math.round(stageRect.height)}`);

			const rects = getTargets()
				.map((target) => {
					const targetRect = target.getBoundingClientRect();
					if (!targetRect.width || !targetRect.height) return null;

					const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
					rect.setAttribute('x', `${Math.round(targetRect.left - stageRect.left)}`);
					rect.setAttribute('y', `${Math.round(targetRect.top - stageRect.top)}`);
					rect.setAttribute('width', `${Math.round(targetRect.width)}`);
					rect.setAttribute('height', `${Math.round(targetRect.height)}`);
					rect.setAttribute('fill', '#fff');
					// The mask alpha controls how strongly fog appears in this target.
					rect.setAttribute('fill-opacity', `${getLiquidOpacity(target.dataset.liquidOpacity)}`);

					const radius = getRadiusPx(target);
					if (radius > 0) {
						rect.setAttribute('rx', `${radius}`);
						rect.setAttribute('ry', `${radius}`);
					}

					return rect;
				})
				.filter(Boolean) as SVGRectElement[];

			alphaMaskEl.replaceChildren(...rects);
		});
	};

	const resizeObserver = new ResizeObserver(scheduleMaskUpdate);
	resizeObserver.observe(fogEl);
	resizeObserver.observe(scope);
	window.addEventListener('resize', scheduleMaskUpdate);
	scheduleMaskUpdate();

	let cleanedUp = false;
	const cleanup = () => {
		if (cleanedUp) return;
		cleanedUp = true;
		window.removeEventListener(MAIN_HUE_EVENT, scheduleColorUpdate);
		window.removeEventListener('resize', scheduleMaskUpdate);
		resizeObserver.disconnect();
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
	// Detach the active effect before Astro swaps the page DOM.
	document.addEventListener('astro:before-swap', cleanup, { once: true });
};

export function initHomeLiquid() {
	// `Liquid.astro` listens to `DOMContentLoaded` and `astro:page-load`; keep one watcher per page instance.
	if (window[WATCHER_CLEANUP_KEY]) return;

	const mobileMedia = window.matchMedia(MOBILE_QUERY);
	const reducedMotionMedia = window.matchMedia(REDUCED_MOTION_QUERY);
	let refreshQueued = false;

	const refresh = () => {
		if (refreshQueued) return;
		refreshQueued = true;
		// Breakpoint and reduced-motion changes can arrive in bursts while resizing.
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
	// Page swap should remove both the active liquid effect and the page-local media watcher.
	document.addEventListener('astro:before-swap', cleanupWatcher, { once: true });

	refresh();
}
