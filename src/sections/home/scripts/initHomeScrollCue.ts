export function initHomeScrollCue() {
	const homeSection = document.getElementById('home');
	const scrollTile = document.getElementById('mb-scroll-tile');
	if (!homeSection || !scrollTile) return;

	// The scroll cue is only designed for the mobile snap layout.
	if (!window.matchMedia('(max-width: 1280px)').matches) return;

	const cueButton = scrollTile.querySelector<HTMLButtonElement>('.mb-scroll-cue');
	if (!cueButton) return;

	const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	const screens = Array.from(homeSection.querySelectorAll<HTMLElement>('.screen[data-mobile-nav-label]'));
	const nextScreen = screens[1] ?? null;

	const onClick = () => {
		if (!nextScreen) return;

		nextScreen.scrollIntoView({
			behavior: prefersReducedMotion ? 'auto' : 'smooth',
			block: 'start',
		});
	};

	cueButton.addEventListener('click', onClick);
}
