import type { WorkContext } from 'sections/work/scripts/work/types';
import { SELECTORS } from './selectors';
import { closeOverlay } from 'sections/work/scripts/work/closeOverlay';

// Simple creation utility used once on DOMContentLoaded via initWorkPage.
export function injectWorkNavItems(ctx: WorkContext) {
	const mainNav = document.querySelector<HTMLElement>(SELECTORS.mainNav);
	if (!mainNav) return;

	// Clean duplicates (HMR resilient)
	mainNav.querySelector(SELECTORS.workBackBtn)?.remove();
	mainNav.querySelector(SELECTORS.workScrollMsg)?.remove();

	const backBtn = document.createElement('button');
	// Hard-code ID (simpler than slicing '#' off selector string)
	backBtn.id = 'work-back-btn';
	backBtn.className = 'work-nav-item';
	backBtn.textContent = '<- back to projects';

	const scrollMsg = document.createElement('span');
	// Hard-code ID
	scrollMsg.id = 'work-scroll-msg';
	scrollMsg.className = 'work-nav-item';
	scrollMsg.textContent = 'scroll to explore';

	mainNav.appendChild(backBtn);
	mainNav.appendChild(scrollMsg);

	backBtn.addEventListener('pointerdown', () => closeOverlay(ctx));
}
