import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
gsap.registerPlugin(SplitText);

export function initWorkIntro() {
	const workIntro = document.querySelector<HTMLElement>('#work-intro');

	// Split the work intro text into lines
	const workIntroSplit = new SplitText(workIntro, {
		type: 'lines',
		linesClass: 'work-intro-line',
	});
	const workIntroLines = workIntroSplit.lines as HTMLElement[];

	// Wrap each line in a div with overflow: hidden and move text into a span
	workIntroLines.forEach((line) => {
		const wrapper = document.createElement('div');
		wrapper.className = 'work-intro-line';
		wrapper.style.overflow = 'hidden';

		const span = document.createElement('span');
		span.className = 'work-intro-line-inner';
		span.style.display = 'inline-block';
		span.textContent = line.textContent ?? '';

		wrapper.appendChild(span);
		line.parentNode?.replaceChild(wrapper, line);
	});

	const workIntroLineSpans = Array.from(document.querySelectorAll<HTMLElement>('.work-intro-line-inner'));

	return workIntroLineSpans;
}
