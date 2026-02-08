import { gsap } from 'gsap';
import { getHomeMobileScreenObserver } from './mobileScreenObserver';

const SCRAMBLE_CONFIG = {
	duration: 0.7,
	tickCount: 42,
	noiseStride: 3,

	// Timing along the tween's 0..1 progress
	revealStart: 0.08,
	revealSpan: 0.78,
	revealJitter: 0.12,
	settleDuration: 0.18,

	// Glitch probability during settle phase (linearly decays)
	glitchChanceStart: 0.28,
	glitchChanceEnd: 0.03,

	// Prevent layout jitter while width changes during scramble
	lockWidth: true,
} as const;

const SCRAMBLE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+-=<>?/\\|~^[]{}()';
const SCRAMBLE_BLOCKS = '░▒';
const SCRAMBLE_POOL_WEIGHTS = {
	charset: 2,
	blocks: 1,
} as const;

const SCRAMBLE_POOL = `${SCRAMBLE_CHARSET.repeat(SCRAMBLE_POOL_WEIGHTS.charset)}${SCRAMBLE_BLOCKS.repeat(
	SCRAMBLE_POOL_WEIGHTS.blocks,
)}`;

const activeScrambles = new WeakMap<
	HTMLElement,
	{
		tween: GSAPTween;
		cleanup: () => void;
	}
>();

function isWhitespace(char: string) {
	return char.trim().length === 0;
}

function clamp01(value: number) {
	return Math.min(1, Math.max(0, value));
}

export function scrambleCompanyText(companyEl: HTMLElement, prefersReducedMotion: boolean) {
	const sourceText = companyEl.dataset.companySource ?? companyEl.textContent?.trim() ?? '';
	if (!sourceText) return;

	companyEl.dataset.companySource = sourceText;
	if (prefersReducedMotion) {
		companyEl.textContent = sourceText;
		return;
	}

	const active = activeScrambles.get(companyEl);
	active?.cleanup();
	active?.tween.kill();

	const chars = Array.from(sourceText);
	const totalScrambleable = chars.reduce((count, char) => (isWhitespace(char) ? count : count + 1), 0);
	if (totalScrambleable === 0) {
		companyEl.textContent = sourceText;
		return;
	}

	const seedByIndex = new Array<number>(chars.length);
	const revealAtByIndex = new Array<number>(chars.length);
	const settleAtByIndex = new Array<number>(chars.length);

	let scrambleableOrder = 0;
	for (let index = 0; index < chars.length; index += 1) {
		if (isWhitespace(chars[index] ?? '')) continue;

		seedByIndex[index] = Math.floor(Math.random() * SCRAMBLE_POOL.length);

		const base = totalScrambleable <= 1 ? 1 : scrambleableOrder / (totalScrambleable - 1);
		const jitter = (Math.random() - 0.5) * SCRAMBLE_CONFIG.revealJitter;
		const revealAt = clamp01(SCRAMBLE_CONFIG.revealStart + base * SCRAMBLE_CONFIG.revealSpan + jitter);
		revealAtByIndex[index] = revealAt;
		settleAtByIndex[index] = clamp01(revealAt + SCRAMBLE_CONFIG.settleDuration);

		scrambleableOrder += 1;
	}

	const prevInlineDisplay = companyEl.style.display;
	const prevInlineWhiteSpace = companyEl.style.whiteSpace;
	const prevInlineMinWidth = companyEl.style.minWidth;

	if (SCRAMBLE_CONFIG.lockWidth) {
		companyEl.style.display = 'inline-block';
		companyEl.style.whiteSpace = 'pre';
		companyEl.style.minWidth = `${companyEl.getBoundingClientRect().width}px`;
	}

	let didCleanup = false;
	const cleanup = () => {
		if (didCleanup) return;
		didCleanup = true;
		companyEl.textContent = sourceText;
		if (SCRAMBLE_CONFIG.lockWidth) {
			companyEl.style.display = prevInlineDisplay;
			companyEl.style.whiteSpace = prevInlineWhiteSpace;
			companyEl.style.minWidth = prevInlineMinWidth;
		}
		activeScrambles.delete(companyEl);
	};

	const state = { progress: 0 };
	const tween = gsap.to(state, {
		progress: 1,
		duration: SCRAMBLE_CONFIG.duration,
		ease: 'none',
		onUpdate: () => {
			const tick = Math.floor(state.progress * SCRAMBLE_CONFIG.tickCount);

			const scrambled = chars
				.map((char, index) => {
					if (isWhitespace(char)) return char;

					const revealAt = revealAtByIndex[index];
					const settleAt = settleAtByIndex[index];
					if (typeof revealAt !== 'number' || typeof settleAt !== 'number') return char;

					const seed = seedByIndex[index] ?? 0;
					const poolIndex = (seed + tick + index * SCRAMBLE_CONFIG.noiseStride) % SCRAMBLE_POOL.length;
					const noiseChar = SCRAMBLE_POOL[poolIndex] ?? '█';

					if (state.progress < revealAt) return noiseChar;

					if (state.progress < settleAt) {
						const t = (state.progress - revealAt) / Math.max(0.001, settleAt - revealAt);
						const glitchChance =
							SCRAMBLE_CONFIG.glitchChanceEnd +
							(SCRAMBLE_CONFIG.glitchChanceStart - SCRAMBLE_CONFIG.glitchChanceEnd) * (1 - clamp01(t));
						return Math.random() < glitchChance ? noiseChar : char;
					}

					return char;
				})
				.join('');

			companyEl.textContent = scrambled;
		},
		onComplete: cleanup,
		onInterrupt: cleanup,
	});

	activeScrambles.set(companyEl, { tween, cleanup });
}

export function initMobileTimelineScramble() {
	const screenObserver = getHomeMobileScreenObserver();
	if (!screenObserver) return;

	const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const scrambledScreens = new WeakSet<HTMLElement>();

	screenObserver.subscribe((activeScreen) => {
		if (!activeScreen || activeScreen.dataset.mobileNavLabel !== 'experience') return;
		if (scrambledScreens.has(activeScreen)) return;

		const companyEl = activeScreen.querySelector<HTMLElement>('.company');
		if (!companyEl) return;

		scrambleCompanyText(companyEl, prefersReducedMotion);
		scrambledScreens.add(activeScreen);
	});
}
