import * as THREE from 'three';
import FOG from 'vanta/dist/vanta.fog.min';

const fallbackFogColors = {
	highlightColor: 0xb3b3b3,
	midtoneColor: 0x8c7373,
	lowlightColor: 0x462582,
	baseColor: 0x313131,
};

function parseCssColorToHexInt(value: string, fallback: number): number {
	const raw = value.trim();
	if (!raw) return fallback;
	if (raw.startsWith('#')) {
		const hex = raw.slice(1);
		const normalized =
			hex.length === 3
				? hex
						.split('')
						.map((char) => char + char)
						.join('')
				: hex.length === 4
					? hex
							.slice(0, 3)
							.split('')
							.map((char) => char + char)
							.join('')
					: hex.length >= 6
						? hex.slice(0, 6)
						: '';
		if (normalized.length === 6) {
			const parsed = Number.parseInt(normalized, 16);
			return Number.isFinite(parsed) ? parsed : fallback;
		}
	}

	const rgbMatch = raw.match(/rgba?\(\s*([0-9]+)[,\s]+([0-9]+)[,\s]+([0-9]+)/i);
	if (rgbMatch) {
		const r = Number(rgbMatch[1]);
		const g = Number(rgbMatch[2]);
		const b = Number(rgbMatch[3]);
		if ([r, g, b].every((channel) => Number.isFinite(channel))) {
			return (
				(Math.max(0, Math.min(255, r)) << 16) | (Math.max(0, Math.min(255, g)) << 8) | Math.max(0, Math.min(255, b))
			);
		}
	}

	return fallback;
}

function getFogColors() {
	const rootStyle = getComputedStyle(document.documentElement);
	const highlight = parseCssColorToHexInt(rootStyle.getPropertyValue('--main-200'), fallbackFogColors.highlightColor);
	const midtone = parseCssColorToHexInt(rootStyle.getPropertyValue('--main-500'), fallbackFogColors.midtoneColor);
	const lowlight = parseCssColorToHexInt(rootStyle.getPropertyValue('--main-700'), fallbackFogColors.lowlightColor);
	const base = parseCssColorToHexInt(rootStyle.getPropertyValue('--main-900'), fallbackFogColors.baseColor);

	return {
		highlightColor: highlight,
		midtoneColor: midtone,
		lowlightColor: lowlight,
		baseColor: base,
	};
}

export function initThree() {
	const fogEl = document.querySelector<HTMLElement>('#mb-up-tile');
	if (!fogEl) return;
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	const fogColors = getFogColors();
	FOG({
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
}
