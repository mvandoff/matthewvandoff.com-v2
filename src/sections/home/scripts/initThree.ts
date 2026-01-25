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

	const clamp01 = (channel: number) => Math.max(0, Math.min(1, channel));

	const hue2rgb = (p: number, q: number, t: number) => {
		if (t < 0) t += 1;
		if (t > 1) t -= 1;
		if (t < 1 / 6) return p + (q - p) * 6 * t;
		if (t < 1 / 2) return q;
		if (t < 2 / 3) return p + (q - p) * 6 * (2 / 3 - t);
		return p;
	};

	const hslToHexInt = (hueDegrees: number, saturation: number, lightness: number) => {
		const h = ((((hueDegrees % 360) + 360) % 360) / 360) % 1;
		const s = clamp01(saturation);
		const l = clamp01(lightness);

		let r: number;
		let g: number;
		let b: number;

		if (s === 0) {
			r = g = b = l;
		} else {
			const p = l <= 0.5 ? l * (1 + s) : l + s - l * s;
			const q = 2 * l - p;
			r = hue2rgb(q, p, h + 1 / 3);
			g = hue2rgb(q, p, h);
			b = hue2rgb(q, p, h - 1 / 3);
		}

		return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
	};

	const parseHueToDegrees = (hueValue: string) => {
		const match = hueValue.trim().match(/^([+-]?\d*\.?\d+)(deg|rad|turn|grad)?$/i);
		if (!match) return null;
		const magnitude = Number.parseFloat(match[1]);
		if (!Number.isFinite(magnitude)) return null;

		const unit = (match[2] || 'deg').toLowerCase();
		switch (unit) {
			case 'deg':
				return magnitude;
			case 'rad':
				return (magnitude * 180) / Math.PI;
			case 'turn':
				return magnitude * 360;
			case 'grad':
				return magnitude * 0.9;
			default:
				return null;
		}
	};

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

	const hslCommaMatch = raw.match(
		/hsla?\(\s*([+-]?\d*\.?\d+(?:deg|rad|turn|grad)?)\s*,\s*([+-]?\d*\.?\d+)\%\s*,\s*([+-]?\d*\.?\d+)\%\s*(?:,\s*([+-]?\d*\.?\d+%?)\s*)?\)/i
	);
	if (hslCommaMatch) {
		const hue = parseHueToDegrees(hslCommaMatch[1]);
		const s = Number.parseFloat(hslCommaMatch[2]);
		const l = Number.parseFloat(hslCommaMatch[3]);
		if (hue !== null && Number.isFinite(s) && Number.isFinite(l)) {
			return hslToHexInt(hue, s / 100, l / 100);
		}
	}

	const hslSpaceMatch = raw.match(
		/hsla?\(\s*([+-]?\d*\.?\d+(?:deg|rad|turn|grad)?)\s+([+-]?\d*\.?\d+)\%\s+([+-]?\d*\.?\d+)\%\s*(?:\/\s*([+-]?\d*\.?\d+%?)\s*)?\)/i
	);
	if (hslSpaceMatch) {
		const hue = parseHueToDegrees(hslSpaceMatch[1]);
		const s = Number.parseFloat(hslSpaceMatch[2]);
		const l = Number.parseFloat(hslSpaceMatch[3]);
		if (hue !== null && Number.isFinite(s) && Number.isFinite(l)) {
			return hslToHexInt(hue, s / 100, l / 100);
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
	const fogEl = document.querySelector<HTMLElement>('#mb-liquid-tile');
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
