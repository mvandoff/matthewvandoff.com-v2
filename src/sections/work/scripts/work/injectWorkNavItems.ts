import type { WorkContext } from 'sections/work/scripts/work/types';
import { SELECTORS } from './selectors';
import { closeOverlay } from 'sections/work/scripts/work/closeOverlay';

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
		const mobileBackBtn = document.createElement('button');
		mobileBackBtn.id = 'work-back-btn-mobile';
		mobileBackBtn.className = 'work-nav-item';
		mobileBackBtn.textContent = '[ back ]';

		const mobileScrollMsg = document.createElement('span');
		mobileScrollMsg.id = 'work-scroll-msg-mobile';
		mobileScrollMsg.className = 'work-nav-item';
		mobileScrollMsg.textContent = 'scroll to explore';

		mobileNav.prepend(mobileBackBtn);
		mobileNav.prepend(mobileScrollMsg);
		mobileBackBtn.addEventListener('pointerdown', () => closeOverlay(ctx));
	}
}
