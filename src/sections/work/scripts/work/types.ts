export interface WorkDomRefs {
	projectListItems: HTMLElement[];
	imageItems: HTMLElement[];
	overlayItems: HTMLElement[];
	overlayNav: HTMLElement | null;
	navItems: HTMLElement[];
	closeButton: HTMLElement | null;
	headings: HTMLElement[];
	section: HTMLElement;
}

export interface WorkState {
	activeListItem: HTMLElement | null;
	activeProjId: 'syfr' | 'btsm' | 'mvdc' | null;
	activeProjContainer: HTMLElement | null;
}

export interface WorkContext {
	refs: WorkDomRefs;
	state: WorkState;
}
