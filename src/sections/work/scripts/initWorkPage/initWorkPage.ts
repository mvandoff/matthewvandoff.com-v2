import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { queryDom } from './queryDom';
import { createWorkState } from './state';
import { bindEvents } from './bindEvents';
import { injectWorkNavItems } from 'sections/work/scripts/initWorkPage/injectWorkNavItems';
import { closeOverlay } from './closeOverlay';
import type { WorkContext } from './types';

gsap.registerPlugin(Flip);

export function initWorkPage() {
	const refs = queryDom();
	const state = createWorkState();
	const ctx: WorkContext = { refs, state };

	// Inject work-only nav items immediately (runs once on DOMContentLoaded)
	injectWorkNavItems(ctx);
	bindEvents(ctx);
}
