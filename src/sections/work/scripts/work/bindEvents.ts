import type { WorkContext } from './types';
import { openOverlay } from './openOverlay';
import { closeOverlay } from './closeOverlay';
import { setProjectBackground } from './setProjectBackground';

export function bindEvents(ctx: WorkContext) {
	const { refs } = ctx;
	const { projectListItems, imageItems } = refs;

	// Open overlay on pointerdown
	projectListItems.forEach((li, index) => {
		li.addEventListener('pointerdown', () => {
			const projId = li.dataset.projId;
			if (projId) refs.section.setAttribute('active-proj', projId);

			setProjectBackground(projId);
			openOverlay(ctx, index);
		});
	});

	// Close on ESC
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') closeOverlay(ctx);
	});

	// Hover preview logic
	projectListItems.forEach((li, i) => {
		li.addEventListener('mouseenter', () => {
			imageItems.forEach((img) => (img.style.display = 'none'));
			if (imageItems[i]) imageItems[i].style.display = 'block';
			projectListItems.forEach((p) => p.classList.remove('selected'));
			li.classList.add('selected');
		});
	});
}
