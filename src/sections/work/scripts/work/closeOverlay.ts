import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import type { WorkContext } from './types';
import { swapWorkNavItems } from 'sections/work/scripts/work/swapWorkNavItems';
import { setProjectBackground } from './setProjectBackground';
import { SELECTORS } from './selectors';

export function closeOverlay(ctx: WorkContext) {
	const { refs, state } = ctx;
	const { projectListItems, imageItems, headings, section } = refs;

	if (!state.activeListItem || !section) return;

	setProjectBackground();
	section.classList.replace('overlay-open', 'overlay-closed');

	const index = projectListItems.indexOf(state.activeListItem);
	const title = document.querySelector<HTMLElement>(`${SELECTORS.overlayTextTarget} ${SELECTORS.projectTitle}`);
	const image = document.querySelector<HTMLElement>(`${SELECTORS.overlayImgTarget} img`);
	if (!title || !image || index < 0) {
		state.activeListItem = null;
		return;
	}

	const titleState = Flip.getState(title, { props: 'fontSize, color' });
	const imageState = Flip.getState(image);

	const button = state.activeListItem.querySelector<HTMLElement>(SELECTORS.projectButton);
	if (button) button.appendChild(title);
	imageItems[index]?.appendChild(image);
	gsap.set(imageItems[index], { autoAlpha: 1 });

	Flip.from(titleState, { onComplete: () => document.querySelector('html')!.removeAttribute('active-proj') });
	Flip.from(imageState);

	state.activeListItem.classList.remove('active');
	state.activeListItem = null;

	gsap.to(headings, { yPercent: 0, autoAlpha: 1, delay: 0.3, stagger: 0.05 });
	swapWorkNavItems();
}
