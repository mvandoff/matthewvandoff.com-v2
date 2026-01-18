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
				text: 'about me',
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
