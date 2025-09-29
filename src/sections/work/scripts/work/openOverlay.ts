import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import type { WorkContext } from './types';
import { swapWorkNavItems } from 'sections/work/scripts/work/swapWorkNavItems';
import { SELECTORS } from './selectors';
import getCurrentBreakpoint from 'utils/getCurrentBreakpoint';

export function openOverlay(ctx: WorkContext, index: number) {
	const { refs, state } = ctx;
	const { projectListItems, imageItems, section } = refs;

	if (!section) return;

	const bp = getCurrentBreakpoint();

	section.classList.replace('overlay-closed', 'overlay-open');

	// Set / update active item
	projectListItems.forEach((li) => li.classList.remove('active'));
	const listItem = projectListItems[index];
	if (!listItem) return;

	listItem.classList.add('active');
	document.getElementById(`proj-${listItem.dataset.projId}`)!.classList.add('active');
	state.activeListItem = listItem;

	const title = listItem.querySelector<HTMLElement>(SELECTORS.projectTitle);
	const imageContainer = imageItems[index];
	const image = imageContainer?.querySelector<HTMLElement>('img');
	if (!title || !image) return;

	const titleState = Flip.getState(title, { props: 'fontSize' });
	const imageState = Flip.getState(image);

	const textTarget = document.querySelector<HTMLElement>(SELECTORS.overlayTextTarget);
	const imgTarget = document.querySelector<HTMLElement>(SELECTORS.overlayImgTarget);
	if (textTarget) textTarget.appendChild(title);

	Flip.from(titleState);
	if (bp === 'lg') {
		if (imgTarget) imgTarget.appendChild(image);
		Flip.from(imageState);
	}

	projectListItems.forEach((other, i) => {
		if (i !== index) {
			const otherTitle = other.querySelector<HTMLElement>(SELECTORS.projectTitle);
			if (otherTitle) {
				gsap.to(otherTitle, {
					yPercent: 100,
					autoAlpha: 0,
					duration: 0.45,
					delay: Math.max(0, 0.2 - i * 0.05),
				});
			}
		}
	});

	swapWorkNavItems();
}
