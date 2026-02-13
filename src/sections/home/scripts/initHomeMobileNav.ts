import { createMobileNavMessageSwap } from 'components/MobileNav/scripts/mobileNavMessageSwap';
import { getHomeMobileScreenObserver } from './mobileScreenObserver';

const NAV_HIDE_DURATION = 0.75;
const NAV_SHOW_DURATION = 1.5;
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
	experienceMessage.innerHTML = `experience <span class="mobile-nav-counter-wrap"><span class="mobile-nav-counter"><span class="mobile-nav-counter__value" data-exp-current>1</span></span><span class="mobile-nav-counter__slash">/</span><span class="mobile-nav-counter__total" data-exp-total>${experienceTotal}</span></span>`;
	const experienceCurrent = experienceMessage.querySelector<HTMLElement>('[data-exp-current]')!;
	const experienceCounter = experienceMessage.querySelector<HTMLElement>('.mobile-nav-counter')!;
	experienceCounter.style.setProperty('--counter-digits', String(Math.max(1, String(experienceTotal).length)));

	const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	let currentScreenIndex: number | null = null;
	let currentExperienceValue: number | null = null;

	const setExperienceMessage = (screen: HTMLElement) => {
		const screenIndex = experienceScreens.indexOf(screen);
		const nextValue = screenIndex + 1;
		experienceMessage.setAttribute('aria-label', `experience ${nextValue}/${experienceTotal}`);
		experienceMessage.setAttribute('aria-live', 'polite');

		if (currentExperienceValue === nextValue) return;
		experienceCurrent.textContent = String(nextValue);
		currentExperienceValue = nextValue;
	};

	screenObserver.subscribe((activeScreen) => {
		if (!activeScreen) {
			messageSwap.setActive(null, { immediate: true });
			currentScreenIndex = null;
			return;
		}

		const nextScreenIndex = labeledScreens.indexOf(activeScreen);
		const direction: Direction = currentScreenIndex === null || nextScreenIndex >= currentScreenIndex ? 1 : -1;
		currentScreenIndex = nextScreenIndex;
		const label = activeScreen.dataset.mobileNavLabel ?? '';
		const labelIndex = LABEL_INDEX[label];
		if (labelIndex !== undefined) {
			messageSwap.setActive(labelIndex, {
				immediate: prefersReducedMotion,
				direction,
			});
		}
		if (label === 'experience') {
			setExperienceMessage(activeScreen);
		}
	});
}
