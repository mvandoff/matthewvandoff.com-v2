import { gsap } from 'gsap';

let open = false;

export function swapWorkNavItems() {
	document.querySelectorAll('#main-nav a')?.forEach((navItem) => {
		gsap.to(navItem, {
			yPercent: open ? 0 : -100,
			autoAlpha: open ? 1 : 0,
			duration: open ? 1.25 : 0.75,
		});
	});

	document.querySelectorAll('.work-nav-item')?.forEach((workNavItem) => {
		gsap.fromTo(
			workNavItem,
			{
				yPercent: open ? 0 : 100,
			},
			{
				yPercent: open ? 100 : 0,
				opacity: open ? 0 : 1,
				pointerEvents: open ? 'none' : 'all',
				duration: open ? 1 : 1.5,
			},
		);
	});

	open = !open;
}
