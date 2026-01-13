import { gsap } from 'gsap';

export type MobileNavMessageConfig = {
	id: string;
	text: string;
	className?: string;
	showFromYPercent?: number;
	hideToYPercent?: number;
	showDuration?: number;
	hideDuration?: number;
};

export type MobileNavMessageSwapOptions = {
	groupId: string;
	messages: MobileNavMessageConfig[];
	container?: HTMLElement | null;
	activeIndex?: number | null;
	showDuration?: number;
	hideDuration?: number;
	ease?: string;
	display?: string;
};

export type MobileNavMessageSwap = {
	setActive: (index: number | null, opts?: { immediate?: boolean }) => void;
	toggle: () => void;
	getActiveIndex: () => number | null;
	elements: HTMLElement[];
};

/**
 * Builds a controller that injects a stacked message group into the mobile nav,
 * creates/rehydrates message spans, and swaps visibility with GSAP (yPercent + autoAlpha)
 * while setting `display: none` on hidden items to avoid layout shifts.
 */
export function createMobileNavMessageSwap(options: MobileNavMessageSwapOptions): MobileNavMessageSwap | null {
	const {
		groupId,
		messages,
		container = document.getElementById('mobile-nav'),
		activeIndex = null,
		showDuration = 0.85,
		hideDuration = 0.6,
		ease = 'power3.out',
		display = 'flex',
	} = options;

	if (!container || messages.length === 0) return null;

	let group = container.querySelector<HTMLElement>(`[data-mobile-nav-group="${groupId}"]`);
	if (!group) {
		// Group wrapper keeps all messages stacked in the same layout slot.
		group = document.createElement('div');
		group.dataset.mobileNavGroup = groupId;
		group.className = 'mobile-nav-msg-group';
		container.prepend(group);
	}

	const elements = messages.map((message, index) => {
		let el = document.getElementById(message.id);
		if (!el) {
			el = document.createElement('span');
			el.id = message.id;
		}
		if (el.parentElement !== group) {
			group.appendChild(el);
		}

		const classNames = ['mobile-nav-msg', message.className].filter(Boolean).join(' ');
		el.className = classNames;
		el.textContent = message.text;
		el.dataset.mobileNavSwap = groupId;
		el.dataset.mobileNavIndex = String(index);
		return el;
	});

	let currentIndex: number | null = null;

	const setActive = (nextIndex: number | null, opts: { immediate?: boolean } = {}) => {
		if (nextIndex === currentIndex && !opts.immediate) return;

		elements.forEach((el, index) => {
			const config = messages[index];
			const isActive = nextIndex === index;
			const fromY = config.showFromYPercent ?? -100;
			const toY = config.hideToYPercent ?? -100;
			const showMs = config.showDuration ?? showDuration;
			const hideMs = config.hideDuration ?? hideDuration;

			gsap.killTweensOf(el);

			if (opts.immediate) {
				// Immediate path is used for initial paint/hydration.
				el.style.display = isActive ? display : 'none';
				gsap.set(el, {
					yPercent: isActive ? 0 : toY,
					autoAlpha: isActive ? 1 : 0,
					pointerEvents: isActive ? 'auto' : 'none',
				});
				return;
			}

			if (isActive) {
				el.style.display = display;
				gsap.fromTo(
					el,
					{ yPercent: fromY, autoAlpha: 0 },
					{ yPercent: 0, autoAlpha: 1, duration: showMs, ease, pointerEvents: 'auto' },
				);
			} else {
				gsap.to(el, {
					yPercent: toY,
					autoAlpha: 0,
					duration: hideMs,
					ease,
					pointerEvents: 'none',
					onComplete: () => {
						// Fully remove hidden items from layout to avoid shifts.
						el.style.display = 'none';
					},
				});
			}
		});

		currentIndex = nextIndex;
	};

	const toggle = () => {
		if (messages.length <= 1) return;
		// Cycle through message list when consumers want a simple flip.
		const nextIndex = currentIndex === null ? 0 : (currentIndex + 1) % messages.length;
		setActive(nextIndex);
	};

	setActive(activeIndex, { immediate: true });

	return {
		setActive,
		toggle,
		getActiveIndex: () => currentIndex,
		elements,
	};
}
