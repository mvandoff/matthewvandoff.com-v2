type TimelineEnterDistortionState = {
	rafId: number;
	lastStartTs: number;
	filterId: string;
	turbulenceEl: SVGFETurbulenceElement;
	displacementEl: SVGFEDisplacementMapElement;
	originalInlineFilter: string;
	lastSeed: number;
};

export function initTimelineEnterDistortion(params: {
	timelineBlocks: HTMLElement[];
	enterEventName: 'pointerenter' | 'mouseenter';
	getBlockSizePx: () => number;
	filterTemplateId?: string;
	durationMs?: number;
}) {
	const {
		timelineBlocks,
		enterEventName,
		getBlockSizePx,
		filterTemplateId = 'timeline-enter-distort-template',
		durationMs = 650,
	} = params;
	if (!timelineBlocks.length) return;
	if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;

	const templateFilterEl = document.getElementById(filterTemplateId) as SVGFilterElement | null;
	if (!templateFilterEl) return;
	const defsEl = templateFilterEl.parentElement;
	if (!defsEl || defsEl.tagName.toLowerCase() !== 'defs') return;

	// Capture non-null refs for use inside callbacks (TS won’t narrow captured variables).
	const templateFilter = templateFilterEl;
	const defs = defsEl;

	const states = new WeakMap<HTMLElement, TimelineEnterDistortionState>();
	const instanceId = Math.random().toString(36).slice(2, 9);
	let filterIndex = 0;

	function quantize(value: number, step: number) {
		if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) return value;
		return Math.round(value / step) * step;
	}

	function clamp(value: number, min: number, max: number) {
		return Math.min(max, Math.max(min, value));
	}

	function createFilterInstance() {
		const filter = templateFilter.cloneNode(true) as SVGFilterElement;
		filterIndex += 1;
		filter.id = `timeline-enter-distort-${instanceId}-${filterIndex}`;

		const turbulenceEl = filter.querySelector('feTurbulence') as SVGFETurbulenceElement | null;
		const displacementEl = filter.querySelector('feDisplacementMap') as SVGFEDisplacementMapElement | null;
		if (!turbulenceEl || !displacementEl) return null;

		const seed = getRandomSeed();
		turbulenceEl.setAttribute('seed', String(seed));
		displacementEl.setAttribute('scale', '0');
		defs.appendChild(filter);

		return { filterId: filter.id, turbulenceEl, displacementEl, seed };
	}

	function setBaseFrequency(params: { turbulenceEl: SVGFETurbulenceElement; blockSizePx: number; intensity01: number }) {
		const { turbulenceEl, blockSizePx, intensity01 } = params;
		const safeBlockSizePx = Math.max(1, blockSizePx);
		const baseFreq = 1 / (safeBlockSizePx * 1.25);
		const freq = baseFreq * (1 + intensity01 * 1.5);
		const step = baseFreq / 4;
		const baseFreqX = quantize(freq, step);
		const baseFreqY = quantize(freq * 1.8, step);
		turbulenceEl.setAttribute('baseFrequency', `${baseFreqX.toFixed(4)} ${baseFreqY.toFixed(4)}`);
	}

	function getRandomSeed() {
		return Math.floor(Math.random() * 9999) + 1;
	}

	function randomizeTurbulenceSeed(state: TimelineEnterDistortionState) {
		let nextSeed = getRandomSeed();
		if (nextSeed === state.lastSeed) {
			nextSeed = (nextSeed % 9999) + 1;
		}
		state.lastSeed = nextSeed;
		state.turbulenceEl.setAttribute('seed', String(nextSeed));
	}

	function startDistortion(target: HTMLElement) {
		let state = states.get(target);
		if (!state) {
			const instance = createFilterInstance();
			if (!instance) return;
			state = {
				rafId: 0,
				lastStartTs: -Infinity,
				filterId: instance.filterId,
				turbulenceEl: instance.turbulenceEl,
				displacementEl: instance.displacementEl,
				originalInlineFilter: '',
				lastSeed: instance.seed,
			};
				states.set(target, state);
			}

			const activeState = state;
			const now = performance.now();
			if (now - activeState.lastStartTs < 150) return;
			activeState.lastStartTs = now;

			if (activeState.rafId) cancelAnimationFrame(activeState.rafId);

			target.classList.add('is-distorting');
			activeState.originalInlineFilter = target.style.filter;
			target.style.filter = `url(#${activeState.filterId})`;
			randomizeTurbulenceSeed(activeState);

			const oscillations = 2.5;
			const blockSizePx = getBlockSizePx();
			const maxScale = Math.min(42, Math.max(18, blockSizePx * 0.6));

		const stepScale = 2;
		const stepIntensity = 1 / 8;

		function frame(ts: number) {
			const t = clamp((ts - now) / durationMs, 0, 1);

			const envelope = (1 - t) * (1 - t);
			const wave = Math.sin(t * oscillations * Math.PI * 2);
			const rawIntensity = envelope * wave;
				const steppedIntensity = quantize(rawIntensity, stepIntensity);

				const rawScale = steppedIntensity * maxScale;
				const scale = quantize(rawScale, stepScale);
				activeState.displacementEl.setAttribute('scale', scale.toFixed(1));
				setBaseFrequency({ turbulenceEl: activeState.turbulenceEl, blockSizePx, intensity01: clamp(envelope, 0, 1) });

				if (t >= 1) {
					activeState.displacementEl.setAttribute('scale', '0');
					setBaseFrequency({ turbulenceEl: activeState.turbulenceEl, blockSizePx, intensity01: 0 });
					target.style.filter = activeState.originalInlineFilter;
					target.classList.remove('is-distorting');
					activeState.rafId = 0;
					return;
				}

				activeState.rafId = requestAnimationFrame(frame);
			}

			activeState.rafId = requestAnimationFrame(frame);
		}

		for (const timelineBlock of timelineBlocks) {
			timelineBlock.addEventListener(enterEventName, () => startDistortion(timelineBlock));
	}
}
