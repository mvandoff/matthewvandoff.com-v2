export function initAboutBtn() {
	// The scroll cue is only designed for the mobile snap layout.
	if (!window.matchMedia('(max-width: 1280px)').matches) return;

	const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const onClick = () => {
		const homeContent = document.getElementById('home-content')!;
		homeContent?.scrollBy({
			top: document.getElementById('home-content')?.clientHeight,
			behavior: prefersReducedMotion ? 'instant' : 'smooth',
		});
	};

	document.getElementById('about-tile')!.addEventListener('click', onClick);
}
