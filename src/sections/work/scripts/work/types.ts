export interface WorkDomRefs {
	projectListItems: HTMLElement[];
	imageItems: HTMLElement[];
	overlayItems: HTMLElement[];
	overlayNav: HTMLElement | null;
	navItems: HTMLElement[];
	closeButton: HTMLElement | null;
	headings: HTMLElement[];
	section: HTMLElement | null;
}

export interface WorkState {
	activeListItem: HTMLElement | null;
}

export interface WorkContext {
	refs: WorkDomRefs;
	state: WorkState;
}
