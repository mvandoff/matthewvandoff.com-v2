import iro from '@jaames/iro';

const MAIN_HUE_VAR = '--main-hue-base';
const MAIN_COLOR_PREFIX = '--main-';
const MAIN_COLOR_KEYS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950', '1k'] as const;
const MAIN_COLOR_BASE_KEY = '600';
const DEFAULT_MAIN_HUE = 226;
export const MAIN_HUE_EVENT = 'mb-main-hue-change';
const MAIN_HUE_STORAGE_KEY = 'mb-main-hue';

// Guard to avoid recomputing offsets on every run.
let paletteReady = false;

// Parse any HSL-ish string into numeric H/S/L/A using iro's parser.
const parseHsl = (value: string) => {
	if (!value) return null;
	try {
		return new iro.Color(value).hsl;
	} catch {
		return null;
	}
};

// Prefer the computed base hue var, else fall back to the current CSS palette.
export const getBaseHue = () => {
	const styles = getComputedStyle(document.documentElement);
	const rawHue = styles.getPropertyValue(MAIN_HUE_VAR).trim();
	const parsedHue = Number.parseFloat(rawHue);
	if (Number.isFinite(parsedHue)) return parsedHue;

	const rawBase = styles.getPropertyValue(`${MAIN_COLOR_PREFIX}${MAIN_COLOR_BASE_KEY}`).trim();
	const baseColor = parseHsl(rawBase);
	return baseColor ? baseColor.h : DEFAULT_MAIN_HUE;
};

// Set only the base hue; CSS expressions handle the rest.
export const setBaseHue = (hue: number) => {
	document.documentElement.style.setProperty(MAIN_HUE_VAR, `${Math.round(hue)}`);
};

// Trim extra trailing zeros so we don't bloat inline CSS.
const formatNumber = (value: number, decimals = 2) => {
	const rounded = value.toFixed(decimals);
	return rounded.replace(/\.?0+$/, '');
};

// Build "calc(var(--main-hue-base) +/- offset)" for each palette entry.
const formatHueExpression = (offset: number) => {
	if (!Number.isFinite(offset)) return `var(${MAIN_HUE_VAR})`;
	if (offset === 0) return `var(${MAIN_HUE_VAR})`;
	const operator = offset < 0 ? '-' : '+';
	const magnitude = formatNumber(Math.abs(offset), 2);
	return `calc(var(${MAIN_HUE_VAR}) ${operator} ${magnitude})`;
};

// Serialize an HSL string while preserving alpha when present.
const formatHsl = (hueExpression: string, saturation: number, lightness: number, alpha?: number) => {
	const saturationValue = formatNumber(saturation, 2);
	const lightnessValue = formatNumber(lightness, 2);
	if (Number.isFinite(alpha)) {
		const alphaValue = formatNumber(alpha ?? 1, 3);
		return `hsl(${hueExpression} ${saturationValue}% ${lightnessValue}% / ${alphaValue})`;
	}
	return `hsl(${hueExpression} ${saturationValue}% ${lightnessValue}%)`;
};

// Read literal palette values, compute offsets from the base hue, and rewrite
// each --main-* to use calc(var(--main-hue-base) +/- offset) while preserving S/L/A.
export const prepareDynamicPalette = () => {
	if (paletteReady) return;
	const root = document.documentElement;
	const styles = getComputedStyle(root);
	const existingBaseHue = Number.parseFloat(styles.getPropertyValue(MAIN_HUE_VAR).trim());
	// If CSS already defines a dynamic palette driven by `--main-hue-base`, there is nothing to rewrite.
	if (Number.isFinite(existingBaseHue)) {
		paletteReady = true;
		return;
	}
	// Snapshot current CSS values so designers can tweak in styles.css.
	const palette = MAIN_COLOR_KEYS.map((key) => {
		const raw = styles.getPropertyValue(`${MAIN_COLOR_PREFIX}${key}`).trim();
		return { key, hsl: parseHsl(raw) };
	});
	const baseEntry = palette.find((entry) => entry.key === MAIN_COLOR_BASE_KEY);
	if (!baseEntry?.hsl || !Number.isFinite(baseEntry.hsl.h)) return;

	const baseHue = baseEntry.hsl.h;
	// Seed the runtime base hue from the palette's base color.
	root.style.setProperty(MAIN_HUE_VAR, `${Math.round(baseHue)}`);

	// Rewrite each --main-* into a calc() expression that references the base hue.
	palette.forEach((entry) => {
		if (!entry.hsl) return;
		const { h, s, l, a } = entry.hsl;
		if (!Number.isFinite(h) || !Number.isFinite(s) || !Number.isFinite(l)) return;
		const hueExpression = formatHueExpression(h - baseHue);
		root.style.setProperty(`${MAIN_COLOR_PREFIX}${entry.key}`, formatHsl(hueExpression, s, l, a));
	});

	paletteReady = true;
};

export const readStoredHue = () => {
	try {
		const raw = window.localStorage.getItem(MAIN_HUE_STORAGE_KEY);
		if (!raw) return null;
		const parsed = Number.parseFloat(raw);
		return Number.isFinite(parsed) ? parsed : null;
	} catch {
		return null;
	}
};

export const writeStoredHue = (hue: number) => {
	try {
		window.localStorage.setItem(MAIN_HUE_STORAGE_KEY, String(Math.round(hue)));
	} catch {
		// Ignore storage failures (private mode, disabled storage).
	}
};

export const applyStoredHue = () => {
	const storedHue = readStoredHue();
	if (storedHue === null) return false;
	prepareDynamicPalette();
	setBaseHue(storedHue);
	window.dispatchEvent(
		new CustomEvent(MAIN_HUE_EVENT, {
			detail: { hue: storedHue },
		}),
	);
	return true;
};

export const initMainHue = () => {
	const run = () => {
		applyStoredHue();
	};
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', run, { once: true });
		return;
	}
	run();
};
