import { gsap } from 'gsap';
import { createMobileNavMessageSwap } from 'components/MobileNav/scripts/mobileNavMessageSwap';

const LABEL_INDEX: Record<string, number> = {
	welcome: 0,
	'home-me': 1,
	experience: 2,
};

export function initHomeMobileNav() {
	const mobileNav = document.getElementById('mobile-nav');
	const homeSection = document.getElementById('home');
	if (!mobileNav || !homeSection) return;

	const labeledScreens = Array.from(homeSection.querySelectorAll<HTMLElement>('.screen[data-mobile-nav-label]'));
	if (labeledScreens.length === 0) return;
	const experienceScreens = labeledScreens.filter((screen) => screen.dataset.mobileNavLabel === 'experience');
	const experienceTotal = experienceScreens.length;

	const messageSwap = createMobileNavMessageSwap({
		container: mobileNav,
		groupId: 'home',
		activeIndex: 0,
		showDuration: 0.8,
		hideDuration: 0.5,
		messages: [
			{
				id: 'welcome-msg-mobile',
				text: 'welcome',
				className: 'mobile-nav-msg--spinner',
				showFromYPercent: -100,
				hideToYPercent: -100,
			},
			{
				id: 'about-me-msg-mobile',
				text: 'about',
				className: 'mobile-nav-msg--spinner',
				showFromYPercent: -100,
				hideToYPercent: -100,
			},
			{
				id: 'experience-msg-mobile',
				text: 'experience',
				className: 'mobile-nav-msg--spinner',
				showFromYPercent: -100,
				hideToYPercent: -100,
			},
		],
	});

	if (!messageSwap) return;

	const experienceMessage = document.getElementById('experience-msg-mobile');
	const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	let currentExperienceValue: number | null = null;
	let counterTween: GSAPTimeline | null = null;

	const ensureExperienceMarkup = (value: number) => {
		if (!experienceMessage) return null;
		let counter = experienceMessage.querySelector<HTMLElement>('[data-exp-counter]');
		let total = experienceMessage.querySelector<HTMLElement>('[data-exp-total]');
		if (!counter || !total) {
			experienceMessage.innerHTML = `experience <span class="mobile-nav-counter-wrap"><span class="mobile-nav-counter" data-exp-counter><span class="mobile-nav-counter__digit is-current" data-exp-digit>${value}</span></span><span class="mobile-nav-counter__slash">/</span><span class="mobile-nav-counter__total" data-exp-total>${experienceTotal}</span></span>`;
			counter = experienceMessage.querySelector<HTMLElement>('[data-exp-counter]');
			total = experienceMessage.querySelector<HTMLElement>('[data-exp-total]');
		}
		if (counter) {
			const digits = Math.max(1, String(experienceTotal).length);
			counter.style.setProperty('--counter-digits', String(digits));
		}
		if (total) {
			total.textContent = String(experienceTotal);
		}
		return { counter, total };
	};

	const setCounterImmediate = (counter: HTMLElement, value: number) => {
		counter.replaceChildren();
		const digit = document.createElement('span');
		digit.className = 'mobile-nav-counter__digit is-current';
		digit.dataset.expDigit = 'true';
		digit.textContent = String(value);
		counter.appendChild(digit);
	};

	const animateCounterTo = (counter: HTMLElement, value: number, direction: number) => {
		const currentDigit =
			counter.querySelector<HTMLElement>('.mobile-nav-counter__digit.is-current') ??
			counter.querySelector<HTMLElement>('.mobile-nav-counter__digit');

		if (!currentDigit) {
			setCounterImmediate(counter, value);
			return;
		}

		if (counterTween) counterTween.kill();

		counter.querySelectorAll<HTMLElement>('.mobile-nav-counter__digit.is-next').forEach((el) => el.remove());

		const nextDigit = document.createElement('span');
		nextDigit.className = 'mobile-nav-counter__digit is-next';
		nextDigit.dataset.expDigit = 'true';
		nextDigit.textContent = String(value);
		counter.appendChild(nextDigit);

		gsap.set(nextDigit, { yPercent: direction > 0 ? 100 : -100, autoAlpha: 1 });
		gsap.set(currentDigit, { yPercent: 0, autoAlpha: 1 });

		counterTween = gsap.timeline({
			onComplete: () => {
				currentDigit.remove();
				nextDigit.classList.remove('is-next');
				nextDigit.classList.add('is-current');
				gsap.set(nextDigit, { yPercent: 0, autoAlpha: 1 });
			},
		});

		counterTween.to(
			currentDigit,
			{
				yPercent: direction > 0 ? -100 : 100,
				autoAlpha: 0,
				duration: 0.5,
				ease: 'power2.inOut',
			},
			0,
		);
		counterTween.to(
			nextDigit,
			{
				yPercent: 0,
				duration: 0.5,
				ease: 'power2.inOut',
			},
			0,
		);
	};

	const setExperienceMessage = (element: Element) => {
		if (!experienceMessage || experienceTotal === 0) return;
		const index = experienceScreens.indexOf(element as HTMLElement);
		if (index < 0) return;
		const nextValue = index + 1;
		const nextText = `experience ${nextValue}/${experienceTotal}`;
		experienceMessage.setAttribute('aria-label', nextText);
		experienceMessage.setAttribute('aria-live', 'polite');

		const markup = ensureExperienceMarkup(nextValue);
		if (!markup?.counter) return;

		if (currentExperienceValue === null) {
			setCounterImmediate(markup.counter, nextValue);
			currentExperienceValue = nextValue;
			return;
		}

		if (currentExperienceValue === nextValue) return;

		const direction = nextValue > currentExperienceValue ? 1 : -1;
		if (prefersReducedMotion) {
			setCounterImmediate(markup.counter, nextValue);
		} else {
			animateCounterTo(markup.counter, nextValue, direction);
		}
		currentExperienceValue = nextValue;
	};

	// Track visibility ratios so we can pick the most visible screen.
	const ratios = new Map<Element, number>();
	const updateActiveLabel = () => {
		let bestElement: Element | null = null;
		let bestRatio = 0;

		ratios.forEach((ratio, element) => {
			if (ratio > bestRatio) {
				bestRatio = ratio;
				bestElement = element;
			}
		});

		if (!bestElement || bestRatio < 0.35) {
			messageSwap.setActive(null);
			return;
		}

		const label = (bestElement as HTMLElement).dataset.mobileNavLabel ?? '';
		if (label === 'experience') {
			setExperienceMessage(bestElement);
		}
		const nextIndex = LABEL_INDEX[label];
		messageSwap.setActive(typeof nextIndex === 'number' ? nextIndex : null);
	};

	// Use the Home section as the scroll container root on mobile.
	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				ratios.set(entry.target, entry.intersectionRatio);
			});
			updateActiveLabel();
		},
		{
			root: homeSection,
			threshold: [0, 0.35, 0.6, 0.85],
		},
	);

	labeledScreens.forEach((screen) => observer.observe(screen));
}
