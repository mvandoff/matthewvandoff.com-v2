const SYFR_BG = 'indigo';

/** Sets the project's predefined color, or if no project is given, unsets the background color. */
export function setProjectBackground(projId: string) {
	const section = document.getElementById('work');
	if (!section) return;

	if (projId === 'syfr') {
		document.documentElement.style.background = SYFR_BG;
		section.style.background = SYFR_BG;
	} else if (projId === 'btsm') {
		document.documentElement.style.background = SYFR_BG;
		section.style.background = SYFR_BG;
	} else if (projId === 'mvdc') {
		document.documentElement.style.background = SYFR_BG;
		section.style.background = SYFR_BG;
	} else if (!projId) {
		document.documentElement.style.background = 'black';
		section.style.background = 'black';
	}
}
