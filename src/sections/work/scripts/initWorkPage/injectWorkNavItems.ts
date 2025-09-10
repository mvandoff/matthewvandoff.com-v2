// Simple creation utility used once on DOMContentLoaded via initWorkPage.
export function injectWorkNavItems(onBack: () => void): void {
	const mainNav = document.getElementById('main-nav');
	if (!mainNav) return;

	// Clean up any existing (e.g., due to HMR) to avoid duplicates.
	mainNav.querySelector('#work-back-btn')?.remove();
	mainNav.querySelector('#work-scroll-msg')?.remove();

	const backBtn = document.createElement('button');
	backBtn.id = 'work-back-btn';
	backBtn.className = 'work-nav-item';
	backBtn.textContent = '<- back to projects';

	const scrollMsg = document.createElement('span');
	scrollMsg.id = 'work-scroll-msg';
	scrollMsg.className = 'work-nav-item';
	scrollMsg.textContent = 'scroll to explore';

	mainNav.appendChild(backBtn);
	mainNav.appendChild(scrollMsg);

	backBtn.addEventListener('pointerdown', onBack);
}
