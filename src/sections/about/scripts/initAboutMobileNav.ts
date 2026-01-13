import { createMobileNavMessageSwap } from 'components/MobileNav/scripts/mobileNavMessageSwap';

const LABEL_INDEX: Record<string, number> = {
	about: 0,
	experience: 1,
};

export function initAboutMobileNav() {
	const mobileNav = document.getElementById('mobile-nav');
	const aboutSection = document.getElementById('about');
	if (!mobileNav || !aboutSection) return;

	const labeledScreens = Array.from(
		aboutSection.querySelectorAll<HTMLElement>('.screen[data-mobile-nav-label]'),
	);
	if (labeledScreens.length === 0) return;

	const messageSwap = createMobileNavMessageSwap({
		container: mobileNav,
		groupId: 'about',
		activeIndex: 0,
		showDuration: 0.8,
		hideDuration: 0.5,
		messages: [
			{
				id: 'about-msg-mobile',
				text: 'about',
				showFromYPercent: -100,
				hideToYPercent: -100,
			},
			{
				id: 'experience-msg-mobile',
				text: 'experience',
				showFromYPercent: -100,
				hideToYPercent: -100,
			},
		],
	});

	if (!messageSwap) return;

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
		const nextIndex = LABEL_INDEX[label];
		messageSwap.setActive(typeof nextIndex === 'number' ? nextIndex : null);
	};

	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				ratios.set(entry.target, entry.intersectionRatio);
			});
			updateActiveLabel();
		},
		{
			root: aboutSection,
			threshold: [0, 0.35, 0.6, 0.85],
		},
	);

	labeledScreens.forEach((screen) => observer.observe(screen));
}
