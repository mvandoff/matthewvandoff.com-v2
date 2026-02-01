export function initAboutBtn() {
	const homeSection = document.getElementById('home')!;
	const scrollTile = document.getElementById('about-tile')!;

	// The scroll cue is only designed for the mobile snap layout.
	if (!window.matchMedia('(max-width: 1280px)').matches) return;

	const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	const onClick = () => {
		homeSection.scrollTo({
			top: homeSection?.clientHeight,
			behavior: prefersReducedMotion ? 'auto' : 'smooth',
			left: 0,
		});
	};

	scrollTile.addEventListener('click', onClick);
}
