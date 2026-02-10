import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { createMobileNavMessageSwap } from 'components/MobileNav/scripts/mobileNavMessageSwap';
import { getHomeMobileScreenObserver } from './mobileScreenObserver';

const NAV_HIDE_DURATION = 0.75;
const NAV_SHOW_DURATION = 1.5;
const NAV_EASE_NAME = 'home-mobile-nav-osmo-ease';
const NAV_EASE_CURVE = '0.625, 0.05, 0, 1';
type Direction = 1 | -1;

const LABEL_INDEX: Record<string, number> = {
	welcome: 0,
	'home-me': 1,
	experience: 2,
};

const HOME_MOBILE_MESSAGES = [
	['welcome-msg-mobile', 'welcome'],
	['about-me-msg-mobile', 'about'],
	['experience-msg-mobile', 'experience'],
].map(([id, text]) => ({
	id,
	text,
	className: 'mobile-nav-msg--spinner',
	showFromYPercent: 100,
	hideToYPercent: -100,
}));

const getOffsets = (direction: Direction) => (direction > 0 ? { fromY: 100, toY: -100 } : { fromY: -100, toY: 100 });

function createDigit(value: number, className: string) {
	const digit = document.createElement('span');
	digit.className = `mobile-nav-counter__digit ${className}`;
	digit.dataset.expDigit = 'true';
	digit.textContent = String(value);
	return digit;
}

export function initHomeMobileNav() {
	gsap.registerPlugin(CustomEase);
	if (!gsap.parseEase(NAV_EASE_NAME)) {
		CustomEase.create(NAV_EASE_NAME, NAV_EASE_CURVE);
	}

	const mobileNav = document.getElementById('mobile-nav') as HTMLElement;
	const screenObserver = getHomeMobileScreenObserver()!;
	const labeledScreens = screenObserver.getScreens();
	const experienceScreens = labeledScreens.filter((screen) => screen.dataset.mobileNavLabel === 'experience');
	const experienceTotal = experienceScreens.length;
	const messageSwap = createMobileNavMessageSwap({
		container: mobileNav,
		groupId: 'home',
		activeIndex: 0,
		showDuration: NAV_SHOW_DURATION,
		hideDuration: NAV_HIDE_DURATION,
		ease: NAV_EASE_NAME,
		messages: HOME_MOBILE_MESSAGES,
	})!;

	const experienceMessage = document.getElementById('experience-msg-mobile') as HTMLElement;
	experienceMessage.innerHTML = `experience <span class="mobile-nav-counter-wrap"><span class="mobile-nav-counter" data-exp-counter><span class="mobile-nav-counter__digit is-current" data-exp-digit>1</span></span><span class="mobile-nav-counter__slash">/</span><span class="mobile-nav-counter__total" data-exp-total>${experienceTotal}</span></span>`;
	const experienceCounter = experienceMessage.querySelector<HTMLElement>('[data-exp-counter]')!;
	experienceCounter.style.setProperty('--counter-digits', String(Math.max(1, String(experienceTotal).length)));
	const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	let currentScreenIndex: number | null = null;
	let currentLabelIndex: number | null = messageSwap.getActiveIndex();
	let currentExperienceValue: number | null = null;
	let labelTween: GSAPTimeline | null = null;
	let counterTween: GSAPTimeline | null = null;

	const setLabelImmediate = (nextIndex: number | null) => {
		messageSwap.setActive(nextIndex, { immediate: true });
		currentLabelIndex = nextIndex;
	};
	const setCounterImmediate = (value: number) => experienceCounter.replaceChildren(createDigit(value, 'is-current'));

	const animateLabelTo = (nextIndex: number | null, direction: Direction) => {
		if (nextIndex === currentLabelIndex) return;
		if (prefersReducedMotion || nextIndex === null || currentLabelIndex === null) {
			setLabelImmediate(nextIndex);
			return;
		}

		const currentEl = messageSwap.elements[currentLabelIndex]!;
		const nextEl = messageSwap.elements[nextIndex]!;
		const { fromY, toY } = getOffsets(direction);
		labelTween?.kill();

		messageSwap.elements.forEach((el, index) => {
			gsap.killTweensOf(el);
			if (index !== currentLabelIndex && index !== nextIndex) {
				el.style.display = 'none';
				gsap.set(el, { autoAlpha: 0, pointerEvents: 'none' });
			}
		});

		currentEl.style.display = 'flex';
		nextEl.style.display = 'flex';
		gsap.set(currentEl, { yPercent: 0, autoAlpha: 1, pointerEvents: 'none' });
		gsap.set(nextEl, { yPercent: fromY, autoAlpha: 0, pointerEvents: 'auto' });
		currentLabelIndex = nextIndex;

		labelTween = gsap.timeline({
			onComplete: () => {
				currentEl.style.display = 'none';
				gsap.set(currentEl, { autoAlpha: 0, pointerEvents: 'none' });
				gsap.set(nextEl, { yPercent: 0, autoAlpha: 1, pointerEvents: 'auto' });
				labelTween = null;
			},
			onInterrupt: () => {
				labelTween = null;
			},
		});

		labelTween.to(currentEl, { yPercent: toY, autoAlpha: 0, duration: NAV_HIDE_DURATION, ease: NAV_EASE_NAME }, 0);
		labelTween.to(nextEl, { yPercent: 0, autoAlpha: 1, duration: NAV_SHOW_DURATION, ease: NAV_EASE_NAME }, 0);
	};

	const setExperienceMessage = (screen: HTMLElement) => {
		const screenIndex = experienceScreens.indexOf(screen);
		const nextValue = screenIndex + 1;
		experienceMessage.setAttribute('aria-label', `experience ${nextValue}/${experienceTotal}`);
		experienceMessage.setAttribute('aria-live', 'polite');

		if (currentExperienceValue === null) {
			setCounterImmediate(nextValue);
			currentExperienceValue = nextValue;
			return;
		}
		if (currentExperienceValue === nextValue) return;
		if (prefersReducedMotion) {
			setCounterImmediate(nextValue);
			currentExperienceValue = nextValue;
			return;
		}

		const currentDigit =
			experienceCounter.querySelector<HTMLElement>('.mobile-nav-counter__digit.is-current') ??
			experienceCounter.querySelector<HTMLElement>('.mobile-nav-counter__digit')!;

		counterTween?.kill();
		experienceCounter.querySelectorAll<HTMLElement>('.mobile-nav-counter__digit.is-next').forEach((el) => el.remove());

		const nextDigit = createDigit(nextValue, 'is-next');
		experienceCounter.appendChild(nextDigit);

		const { fromY, toY } = getOffsets(nextValue > currentExperienceValue ? 1 : -1);
		gsap.set(nextDigit, { yPercent: fromY, autoAlpha: 0 });
		gsap.set(currentDigit, { yPercent: 0, autoAlpha: 1 });

		counterTween = gsap.timeline({
			onComplete: () => {
				currentDigit.remove();
				nextDigit.classList.remove('is-next');
				nextDigit.classList.add('is-current');
				gsap.set(nextDigit, { yPercent: 0, autoAlpha: 1 });
				counterTween = null;
			},
			onInterrupt: () => {
				counterTween = null;
			},
		});

		counterTween.to(currentDigit, { yPercent: toY, autoAlpha: 0, duration: NAV_HIDE_DURATION, ease: NAV_EASE_NAME }, 0);
		counterTween.fromTo(
			nextDigit,
			{ yPercent: fromY, autoAlpha: 0 },
			{ yPercent: 0, autoAlpha: 1, duration: NAV_SHOW_DURATION, ease: NAV_EASE_NAME },
			0,
		);
		currentExperienceValue = nextValue;
	};

	screenObserver.subscribe((activeScreen) => {
		if (!activeScreen) {
			labelTween?.kill();
			setLabelImmediate(null);
			currentScreenIndex = null;
			return;
		}

		const nextScreenIndex = labeledScreens.indexOf(activeScreen);
		const direction: Direction = currentScreenIndex === null || nextScreenIndex >= currentScreenIndex ? 1 : -1;
		currentScreenIndex = nextScreenIndex;
		const label = activeScreen.dataset.mobileNavLabel ?? '';
		animateLabelTo(LABEL_INDEX[label]!, direction);
		if (label === 'experience') {
			setExperienceMessage(activeScreen);
		}
	});
}
