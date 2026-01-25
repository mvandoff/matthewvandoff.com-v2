export function initHomeScrollCue() {
	const homeSection = document.getElementById('home');
	const scrollTile = document.getElementById('mb-scroll-tile');
	const downTile = document.getElementById('mb-down-tile');
	if (!homeSection || (!scrollTile && !downTile)) return;

	// The scroll cue is only designed for the mobile snap layout.
	if (!window.matchMedia('(max-width: 1280px)').matches) return;

	const cueButton =
		scrollTile?.querySelector<HTMLButtonElement>('.mb-scroll-cue') ??
		(downTile instanceof HTMLButtonElement ? downTile : downTile?.querySelector<HTMLButtonElement>('button'));
	if (!cueButton) return;

	const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	const screens = Array.from(homeSection.querySelectorAll<HTMLElement>('.screen[data-mobile-nav-label]'));
	const nextScreen = screens[1] ?? null;

	const onClick = () => {
		if (!nextScreen) return;

		const homeRect = homeSection.getBoundingClientRect();
		const screenRect = nextScreen.getBoundingClientRect();
		const targetTop = Math.max(0, homeSection.scrollTop + screenRect.top - homeRect.top);

		homeSection.scrollTo({
			top: targetTop,
			behavior: prefersReducedMotion ? 'auto' : 'smooth',
		});
	};

	cueButton.addEventListener('click', onClick);
}
