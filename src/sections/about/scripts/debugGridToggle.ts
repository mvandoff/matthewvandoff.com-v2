type DebugGridOptions = {
	container: HTMLElement;
	className?: string;
	storageKey?: string;
	toggleKey?: string;
	urlParam?: string;
};

export function initDebugGridToggle(options: DebugGridOptions) {
	const {
		container,
		className = 'is-debug-grid',
		storageKey = 'debug-block-grid',
		toggleKey = 'g',
		urlParam = 'grid',
	} = options;
	const normalizedToggleKey = toggleKey.toLowerCase();

	const hasDebugGridParam = new URLSearchParams(window.location.search).has(urlParam);
	if (hasDebugGridParam || readStoredDebugGrid(storageKey)) {
		container.classList.add(className);
	}

	const handleKeydown = (event: KeyboardEvent) => {
		if (event.repeat) return;
		if (event.key.toLowerCase() !== normalizedToggleKey) return;
		if (isEditableTarget(event.target)) return;
		const isEnabled = container.classList.toggle(className);
		writeStoredDebugGrid(storageKey, isEnabled);
	};

	document.addEventListener('keydown', handleKeydown);
}

function isEditableTarget(target: EventTarget | null) {
	if (!(target instanceof Element)) return false;
	if (target instanceof HTMLElement && target.isContentEditable) return true;
	return target.matches('input, textarea, select, [contenteditable="true"]');
}

function readStoredDebugGrid(key: string) {
	try {
		return window.localStorage.getItem(key) === 'true';
	} catch {
		return false;
	}
}

function writeStoredDebugGrid(key: string, enabled: boolean) {
	try {
		window.localStorage.setItem(key, String(enabled));
	} catch {
		// Ignore storage failures (private mode, disabled storage).
	}
}
