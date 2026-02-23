import { createMobileNavMessageSwap } from 'components/MobileNav/scripts/mobileNavMessageSwap';
import { gsap } from 'gsap';
import { getHomeMobileScreenObserver } from './mobileScreenObserver';

const NAV_HIDE_DURATION = 0.75;
const NAV_SHOW_DURATION = 1.5;
const MOBILE_NAV_EASE = 'mobile-nav-ease';
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
}));

function buildExperienceMessage(messageEl: HTMLElement, experienceTotal: number) {
	const counterWrap = document.createElement('span');
	counterWrap.className = 'mobile-nav-counter-wrap';

	const counter = document.createElement('span');
	counter.className = 'mobile-nav-counter';
	const valueTrack = document.createElement('span');
	valueTrack.className = 'mobile-nav-counter__track';
	valueTrack.style.display = 'grid';

	const valueSlots = Array.from({ length: 2 }, () => {
		const value = document.createElement('span');
		value.className = 'mobile-nav-counter__value';
		value.style.gridArea = '1 / 1';
		return value;
	});
	valueSlots[0].textContent = '1';

	const slash = document.createElement('span');
	slash.className = 'mobile-nav-counter__slash';
	slash.textContent = '/';

	const total = document.createElement('span');
	total.className = 'mobile-nav-counter__total';
	total.dataset.expTotal = '';
	total.textContent = String(experienceTotal);

	valueTrack.append(valueSlots[0], valueSlots[1]);
	counter.append(valueTrack);
	counterWrap.append(counter, slash, total);
	messageEl.replaceChildren('experience ', counterWrap);

	return { valueSlots, counter };
}

const getOffsets = (direction: Direction) => (direction > 0 ? { fromY: 100, toY: -100 } : { fromY: -100, toY: 100 });

export function initHomeMobileNav() {
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
		messages: HOME_MOBILE_MESSAGES,
	})!;

	const experienceMessage = document.getElementById('experience-msg-mobile') as HTMLElement;
	const { valueSlots: experienceValueSlots, counter: experienceCounter } = buildExperienceMessage(
		experienceMessage,
		experienceTotal,
	);
	experienceCounter.style.setProperty('--counter-digits', String(Math.max(1, String(experienceTotal).length)));
	gsap.set(experienceValueSlots[0], { yPercent: 0, autoAlpha: 1 });
	gsap.set(experienceValueSlots[1], { yPercent: 100, autoAlpha: 0 });

	const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	let currentScreenIndex: number | null = null;
	let currentExperienceValue: number | null = null;
	let activeExperienceSlot = 0;

	const animateExperienceCurrent = (nextValue: number, direction: Direction, immediate = false) => {
		const nextSlot = activeExperienceSlot === 0 ? 1 : 0;
		const outgoing = experienceValueSlots[activeExperienceSlot];
		const incoming = experienceValueSlots[nextSlot];
		gsap.killTweensOf([outgoing, incoming]);
		incoming.textContent = String(nextValue);

		if (immediate || currentExperienceValue === null) {
			gsap.set(outgoing, { yPercent: 100, autoAlpha: 0 });
			gsap.set(incoming, { yPercent: 0, autoAlpha: 1 });
			activeExperienceSlot = nextSlot;
			return;
		}

		const { fromY, toY } = getOffsets(direction);
		gsap.set(incoming, { yPercent: fromY, autoAlpha: 0 });
		gsap.to(outgoing, {
			yPercent: toY,
			autoAlpha: 0,
			duration: NAV_HIDE_DURATION,
			ease: MOBILE_NAV_EASE,
		});
		gsap.to(incoming, {
			yPercent: 0,
			autoAlpha: 1,
			duration: NAV_SHOW_DURATION,
			ease: MOBILE_NAV_EASE,
		});
		activeExperienceSlot = nextSlot;
	};

	const setExperienceMessage = (screen: HTMLElement, direction: Direction, immediate = false) => {
		const screenIndex = experienceScreens.indexOf(screen);
		const nextValue = screenIndex + 1;
		experienceMessage.setAttribute('aria-label', `experience ${nextValue}/${experienceTotal}`);
		experienceMessage.setAttribute('aria-live', 'polite');

		if (currentExperienceValue === nextValue) return;
		animateExperienceCurrent(nextValue, direction, immediate);
		currentExperienceValue = nextValue;
	};

	screenObserver.subscribe((activeScreen) => {
		if (!activeScreen) {
			messageSwap.setActive(null, { immediate: true });
			currentScreenIndex = null;
			return;
		}

		const isInitialScreen = currentScreenIndex === null;
		const nextScreenIndex = labeledScreens.indexOf(activeScreen);
		const direction: Direction = currentScreenIndex === null || nextScreenIndex >= currentScreenIndex ? 1 : -1;
		currentScreenIndex = nextScreenIndex;
		const label = activeScreen.dataset.mobileNavLabel ?? '';
		const labelIndex = LABEL_INDEX[label];
		if (labelIndex !== undefined) {
			messageSwap.setActive(labelIndex, {
				immediate: prefersReducedMotion || isInitialScreen,
				direction,
			});
		}
		if (label === 'experience') {
			setExperienceMessage(activeScreen, direction, prefersReducedMotion || isInitialScreen);
		}
	});
}
