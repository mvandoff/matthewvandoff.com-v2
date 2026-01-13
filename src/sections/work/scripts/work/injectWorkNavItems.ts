import type { WorkContext } from 'sections/work/scripts/work/types';
import { SELECTORS } from './selectors';
import { closeOverlay } from 'sections/work/scripts/work/openCloseOverlay/closeOverlay';
import { createMobileNavMessageSwap } from 'components/MobileNav/scripts/mobileNavMessageSwap';
import { setWorkMobileNavMessageSwap } from 'sections/work/scripts/work/openCloseOverlay/swapWorkNavItems';

// Simple creation utility used once on DOMContentLoaded via initWorkPage.
export function injectWorkNavItems(ctx: WorkContext) {
	const mainNav = document.querySelector<HTMLElement>(SELECTORS.mainNav);
	if (mainNav) {
		// Clean duplicates (HMR resilient)
		mainNav.querySelector(SELECTORS.workBackBtn)?.remove();
		mainNav.querySelector(SELECTORS.workScrollMsg)?.remove();

		const backBtn = document.createElement('button');
		backBtn.id = 'work-back-btn';
		backBtn.className = 'work-nav-item';
		backBtn.textContent = '<- back to projects';

		const scrollMsg = document.createElement('span');
		scrollMsg.id = 'work-scroll-msg';
		scrollMsg.className = 'work-nav-item';
		scrollMsg.textContent = 'scroll to explore';

		mainNav.appendChild(backBtn);
		mainNav.appendChild(scrollMsg);

		backBtn.addEventListener('pointerdown', () => closeOverlay(ctx));
	}

	const mobileNav = document.getElementById('mobile-nav');
	if (mobileNav) {
		mobileNav.querySelector('#work-back-btn-mobile')?.remove();

		const mobileBackBtn = document.createElement('button');
		mobileBackBtn.id = 'work-back-btn-mobile';
		mobileBackBtn.className = 'work-nav-item';
		mobileBackBtn.textContent = '[ back ]';

		const mobileMessageSwap = createMobileNavMessageSwap({
			container: mobileNav,
			groupId: 'work',
			activeIndex: 0,
			showDuration: 1.25,
			hideDuration: 0.75,
			messages: [
				{
					id: 'work-help-msg-mobile',
					text: 'select project',
					showFromYPercent: -100,
					hideToYPercent: -100,
				},
				{
					id: 'work-scroll-msg-mobile',
					text: 'scroll to explore',
					showFromYPercent: 100,
					hideToYPercent: 100,
				},
			],
		});

		setWorkMobileNavMessageSwap(mobileMessageSwap);

		mobileNav.append(mobileBackBtn);
		mobileBackBtn.addEventListener('pointerdown', () => closeOverlay(ctx));
	}
}
