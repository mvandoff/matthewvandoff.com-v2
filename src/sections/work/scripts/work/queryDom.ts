import type { WorkDomRefs } from './types';
import { SELECTORS } from './selectors';

export function queryDom(): WorkDomRefs {
	// Helper to query a single element and throw if not found
	const requireEl = <T extends HTMLElement>(selector: string): T => {
		const el = document.querySelector<T>(selector);
		if (!el) throw new Error(`Expected DOM element for selector "${selector}" but found null`);
		return el;
	};

	return {
		projectListItems: Array.from(document.querySelectorAll<HTMLElement>(SELECTORS.projectListItem)),
		imageItems: Array.from(document.querySelectorAll<HTMLElement>(SELECTORS.mainImageItem)),
		overlayItems: Array.from(document.querySelectorAll<HTMLElement>(SELECTORS.overlayItem)),
		overlayNav: document.querySelector(SELECTORS.overlayNav),
		navItems: Array.from(document.querySelectorAll<HTMLElement>(SELECTORS.overlayNavItem)),
		closeButton: document.querySelector(SELECTORS.overlayClose),
		headings: Array.from(document.querySelectorAll<HTMLElement>(SELECTORS.projectTitle)),
		section: requireEl<HTMLElement>(SELECTORS.rootSection),
	};
}
