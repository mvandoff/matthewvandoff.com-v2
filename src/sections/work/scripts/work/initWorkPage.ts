import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { injectWorkNavItems } from 'sections/work/scripts/work/injectWorkNavItems';
import { bindEvents } from './bindEvents';
import { queryDom } from './queryDom';
import { createWorkState } from './state';
import type { WorkContext } from './types';
import { OVERLAY_TRANSITION_TIME } from './workConstants';

gsap.registerPlugin(Flip);

export function initWorkPage() {
	const refs = queryDom();
	const state = createWorkState();
	const ctx: WorkContext = { refs, state };

	// Inject work-only nav items immediately (runs once on DOMContentLoaded)
	injectWorkNavItems(ctx);
	bindEvents(ctx);

	document.documentElement.style.setProperty('--overlay-transition-time', `${OVERLAY_TRANSITION_TIME}ms`);
}
