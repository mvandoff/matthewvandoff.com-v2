import { gsap } from 'gsap';
import type { MobileNavMessageSwap } from 'components/MobileNav/scripts/mobileNavMessageSwap';

let open = false;
let mobileMessageSwap: MobileNavMessageSwap | null = null;

export function setWorkMobileNavMessageSwap(swap: MobileNavMessageSwap | null) {
	mobileMessageSwap = swap;
}

export function swapWorkNavItems() {
	const nextOpen = !open;
	mobileMessageSwap?.setActive(nextOpen ? 1 : 0);

	document.querySelectorAll('#main-nav a, #menu-btn')?.forEach((navItem) => {
		gsap.to(navItem, {
			yPercent: open ? 0 : -100,
			autoAlpha: open ? 1 : 0,
			duration: open ? 1.25 : 0.75,
		});
	});

	document.querySelectorAll('.work-nav-item:not([data-mobile-nav-swap])')?.forEach((workNavItem) => {
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

	open = nextOpen;
}
