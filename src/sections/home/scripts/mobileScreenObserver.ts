export type MobileScreenListener = (activeScreen: HTMLElement | null) => void;

type MobileScreenObserver = {
	subscribe: (listener: MobileScreenListener) => () => void;
	getActiveScreen: () => HTMLElement | null;
	getScreens: () => HTMLElement[];
};

const MIN_ACTIVE_RATIO = 0.35;

let sharedObserver: MobileScreenObserver | null = null;

function getMostVisibleScreen(ratios: Map<HTMLElement, number>): HTMLElement | null {
	let bestScreen: HTMLElement | null = null;
	let bestRatio = 0;

	ratios.forEach((ratio, screen) => {
		if (ratio > bestRatio) {
			bestRatio = ratio;
			bestScreen = screen;
		}
	});

	if (!bestScreen || bestRatio < MIN_ACTIVE_RATIO) return null;
	return bestScreen;
}

export function getHomeMobileScreenObserver(): MobileScreenObserver | null {
	if (sharedObserver) return sharedObserver;

	const homeSection = document.getElementById('home');
	if (!homeSection) return null;

	const screens = Array.from(homeSection.querySelectorAll<HTMLElement>('.screen[data-mobile-nav-label]'));
	if (screens.length === 0) return null;

	const listeners = new Set<MobileScreenListener>();
	const ratios = new Map<HTMLElement, number>();
	let activeScreen: HTMLElement | null = null;

	const notifyListeners = () => {
		listeners.forEach((listener) => listener(activeScreen));
	};

	const updateActiveScreen = () => {
		const nextActiveScreen = getMostVisibleScreen(ratios);
		if (nextActiveScreen === activeScreen) return;
		activeScreen = nextActiveScreen;
		notifyListeners();
	};

	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				ratios.set(entry.target as HTMLElement, entry.intersectionRatio);
			});
			updateActiveScreen();
		},
		{
			root: homeSection,
			threshold: [0, 0.35, 0.6, 0.85],
		},
	);

	screens.forEach((screen) => {
		ratios.set(screen, 0);
		observer.observe(screen);
	});

	sharedObserver = {
		subscribe(listener) {
			listeners.add(listener);
			listener(activeScreen);
			return () => {
				listeners.delete(listener);
			};
		},
		getActiveScreen() {
			return activeScreen;
		},
		getScreens() {
			return screens;
		},
	};

	return sharedObserver;
}
