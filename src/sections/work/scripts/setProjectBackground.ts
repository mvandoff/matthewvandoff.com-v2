const SYFR_BG = '#1e1a4d';
const BTSM_BG = '#312e2b';
const MVDC_BG = 'var(--main-950)';

/** Sets the project's predefined color, or if no project is given, unsets the background color. */
export function setProjectBackground(projId: string) {
	const section = document.getElementById('work');
	if (!section) return;

	if (projId === 'syfr') {
		document.documentElement.style.background = SYFR_BG;
		section.style.background = SYFR_BG;
	} else if (projId === 'btsm') {
		document.documentElement.style.background = BTSM_BG;
		section.style.background = BTSM_BG;
	} else if (projId === 'mvdc') {
		document.documentElement.style.background = MVDC_BG;
		section.style.background = MVDC_BG;
	} else if (!projId) {
		document.documentElement.style.background = 'black';
		section.style.background = 'black';
	}
}
