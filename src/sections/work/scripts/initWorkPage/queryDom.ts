import type { WorkDomRefs } from './types';
import { SELECTORS } from './selectors';

export function queryDom(): WorkDomRefs {
	return {
		projectListItems: Array.from(document.querySelectorAll<HTMLElement>(SELECTORS.projectListItem)),
		imageItems: Array.from(document.querySelectorAll<HTMLElement>(SELECTORS.mainImageItem)),
		overlayItems: Array.from(document.querySelectorAll<HTMLElement>(SELECTORS.overlayItem)),
		overlayNav: document.querySelector<HTMLElement>(SELECTORS.overlayNav),
		navItems: Array.from(document.querySelectorAll<HTMLElement>(SELECTORS.overlayNavItem)),
		closeButton: document.querySelector<HTMLElement>(SELECTORS.overlayClose),
		headings: Array.from(document.querySelectorAll<HTMLElement>(SELECTORS.projectTitle)),
		section: document.querySelector<HTMLElement>(SELECTORS.rootSection),
	};
}
