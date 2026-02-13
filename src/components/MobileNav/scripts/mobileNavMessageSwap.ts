import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';

export type MobileNavMessageConfig = {
	id: string;
	text: string;
	className?: string;
};

export type MobileNavMessageSwapOptions = {
	groupId: string;
	messages: MobileNavMessageConfig[];
	container?: HTMLElement | null;
	activeIndex?: number | null;
	showDuration?: number;
	hideDuration?: number;
	display?: string;
};

type Direction = 1 | -1;

export type MobileNavMessageSwap = {
	setActive: (index: number | null, opts?: { immediate?: boolean; direction?: Direction }) => void;
	toggle: () => void;
	getActiveIndex: () => number | null;
	elements: HTMLElement[];
};

const DEFAULT_SHOW_DURATION = 0.85;
const DEFAULT_HIDE_DURATION = 0.6;
const MOBILE_NAV_EASE = 'mobile-nav-ease';
const MOBILE_NAV_EASE_CURVE = '0.625, 0.05, 0, 1';
const DEFAULT_DISPLAY = 'flex';

const getOffsets = (direction: Direction) => (direction > 0 ? { fromY: 100, toY: -100 } : { fromY: -100, toY: 100 });

gsap.registerPlugin(CustomEase);
CustomEase.create(MOBILE_NAV_EASE, MOBILE_NAV_EASE_CURVE);
if (!gsap.parseEase(MOBILE_NAV_EASE)) {
	throw new Error(`[mobileNavMessageSwap] Missing GSAP ease "${MOBILE_NAV_EASE}".`);
}

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
		showDuration = DEFAULT_SHOW_DURATION,
		hideDuration = DEFAULT_HIDE_DURATION,
		display = DEFAULT_DISPLAY,
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

	const resolveDirection = (nextIndex: number | null, direction?: Direction): Direction => {
		if (direction) return direction;
		if (nextIndex === null || currentIndex === null) return 1;
		return nextIndex >= currentIndex ? 1 : -1;
	};

	const setActive = (nextIndex: number | null, opts: { immediate?: boolean; direction?: Direction } = {}) => {
		if (nextIndex === currentIndex && !opts.immediate) return;

		const { fromY, toY } = getOffsets(resolveDirection(nextIndex, opts.direction));

		elements.forEach((el, index) => {
			const isActive = nextIndex === index;

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
					{ yPercent: 0, autoAlpha: 1, duration: showDuration, ease: MOBILE_NAV_EASE, pointerEvents: 'auto' },
				);
			} else {
				gsap.to(el, {
					yPercent: toY,
					autoAlpha: 0,
					duration: hideDuration,
					ease: MOBILE_NAV_EASE,
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
