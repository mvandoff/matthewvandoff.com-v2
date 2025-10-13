const PROJECT_BACKGROUNDS = {
	syfr: 'black',
	btsm: 'rgb(255 255 255)',
	mvdc: 'black',
	default: 'black',
} as const;

/** Sets the project's predefined color, or if no project is given, unsets the background color. */
export function setProjectBackground(projId?: string) {
	const section = document.getElementById('work');
	const mainNav = document.getElementById('main-nav');
	const mobileNav = document.getElementById('mobile-nav');
	if (!section) throw Error();

	const bgColor = projId
		? PROJECT_BACKGROUNDS[projId as keyof typeof PROJECT_BACKGROUNDS]
		: PROJECT_BACKGROUNDS.default;

	document.documentElement.style.background = bgColor;
	section.style.background = bgColor;
	if (mainNav) mainNav.style.background = bgColor;
	if (mobileNav) mobileNav.style.background = bgColor;
}
