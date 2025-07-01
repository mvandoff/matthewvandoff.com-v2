import { gsap } from 'gsap';
import SplitText from 'gsap/SplitText';

export function initScrambleOnHover() {
	let targets = document.querySelectorAll('h2');

	targets.forEach((target) => {
		let originalText = target.textContent as string;
		let customHoverText = target.getAttribute('data-scramble'); // if this attribute is present, take a custom hover text

		let split = new SplitText(target, {
			type: 'words, chars',
			wordsClass: 'word',
			charsClass: 'char',
		});

		target.addEventListener('mouseenter', () => {
			gsap.to(target, {
				duration: 1,
				scrambleText: {
					text: customHoverText ? customHoverText : originalText,
					chars: SCRAMBLE_CHARS,
				},
			});
		});

		target.addEventListener('mouseleave', () => {
			gsap.to(target, {
				duration: 1,
				scrambleText: {
					text: originalText,
					speed: 2,
					chars: SCRAMBLE_CHARS,
				},
			});
		});
	});
}

const SCRAMBLE_CHARS = '◊∆▫▹|zx';
