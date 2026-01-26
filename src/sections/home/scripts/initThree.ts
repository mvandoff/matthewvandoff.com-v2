import * as THREE from 'three';
import FOG from 'vanta/dist/vanta.fog.min';

const fallbackFogColors = {
	highlightColor: 0xb3b3b3,
	midtoneColor: 0x8c7373,
	lowlightColor: 0x462582,
	baseColor: 0x313131,
};
const MAIN_HUE_EVENT = 'mb-main-hue-change';
let colorProbe: HTMLElement | null = null;

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

const resolveCssColorVar = (varName: string, fallback: number) => {
	const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
	if (!raw) return fallback;
	const probe = getColorProbe();
	probe.style.color = `var(${varName})`;
	const resolved = getComputedStyle(probe).color.trim();
	return resolved || raw;
};

function getFogColors() {
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
}

export function initThree() {
	const fogEl = document.querySelector<HTMLElement>('#mb-liquid-tile');
	if (!fogEl) return;
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	const fogColors = getFogColors();
	const effect = FOG({
		el: fogEl,
		THREE,
		mouseControls: true,
		touchControls: true,
		gyroControls: false,
		minHeight: 0,
		minWidth: 0,
		highlightColor: fogColors.highlightColor,
		midtoneColor: fogColors.midtoneColor,
		lowlightColor: fogColors.lowlightColor,
		baseColor: fogColors.baseColor,
		// baseColor: 'black',
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
}
