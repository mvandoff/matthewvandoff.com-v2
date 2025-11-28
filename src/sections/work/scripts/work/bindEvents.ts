import type { WorkContext } from './types';
import { openOverlay } from './openCloseOverlay/openOverlay';
import { setProjectBackground } from './openCloseOverlay/setProjectBackground';
import { closeOverlay } from 'sections/work/scripts/work/openCloseOverlay/closeOverlay';

export function bindEvents(ctx: WorkContext) {
	const { refs } = ctx;
	const { projectListItems, imageItems } = refs;

	// Open overlay on pointerdown
	projectListItems.forEach((li, index) => {
		li.addEventListener('pointerdown', () => {
			const projId = li.dataset.projId;
			if (projId !== 'mvdc' && projId !== 'btsm' && projId !== 'syfr') throw new Error();

			ctx.state.activeProjId = projId;

			document.querySelector('html')!.setAttribute('active-proj', projId);

			imageItems.forEach((imageItem) => {
				imageItem.style.display = imageItem.dataset.projId === projId ? 'block' : 'none';
			});

			openOverlay(ctx, index);
			setProjectBackground(projId);
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
