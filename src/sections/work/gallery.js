import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(Flip, SplitText);

export function initGalleryOverlayTransitionFlip() {
	const projectButtons = document.querySelectorAll('.main-title__item');
	const imageItems = document.querySelectorAll('.main-img__item');
	const overlayItems = document.querySelectorAll('.overlay-item');
	const overlayNav = document.querySelector('.overlay-nav');
	const navItems = document.querySelectorAll("[data-overlay='nav-item']");
	const closeButton = document.querySelector("[data-overlay='close']");
	const headings = document.querySelectorAll('.main-title');
	const workIntro = document.querySelector('#work-intro');

	// Split the work intro text into lines
	const workIntroSplit = new SplitText(workIntro, {
		type: 'lines',
		linesClass: 'work-intro-line',
	});
	const workIntroLines = workIntroSplit.lines;

	// Wrap each line in a div with overflow: hidden and move text into a span
	workIntroLines.forEach((line) => {
		const wrapper = document.createElement('div');
		wrapper.className = 'work-intro-line';
		wrapper.style.overflow = 'hidden';
		const span = document.createElement('span');
		span.className = 'work-intro-line-inner';
		span.style.display = 'inline-block';
		span.textContent = line.textContent;
		wrapper.appendChild(span);
		line.parentNode.replaceChild(wrapper, line);
	});
	const workIntroLineSpans = Array.from(document.querySelectorAll('.work-intro-line-inner'));

	let activeListItem = null;

	function openOverlay(index) {
		// Set active class to the clicked list item
		projectButtons.forEach((item) => item.classList.remove('active'));
		activeListItem = projectButtons[index];
		activeListItem.classList.add('active');

		// Record the state of the title
		const title = activeListItem.querySelector('.main-title');
		const titleState = Flip.getState(title, { props: 'fontSize' });

		// Record the state of the image
		const image = imageItems[index].querySelector('.image');
		const imageState = Flip.getState(image);

		// Show the overlay and get elements for animation
		const overlayItem = overlayItems[index];
		const content = overlayItem.querySelector('.overlay-row');

		gsap.set(overlayItem, { display: 'block', autoAlpha: 110 });
		gsap.fromTo(content, { autoAlpha: 0 }, { autoAlpha: 1, delay: 0.5 });

		const textTarget = overlayItem.querySelector("[data-overlay='text-target']");
		const imgTarget = overlayItem.querySelector("[data-overlay='img-target']");

		// Append the elements to overlay targets
		textTarget.appendChild(title);
		imgTarget.appendChild(image);

		// Animate with GSAP Flip
		Flip.from(titleState);
		Flip.from(imageState);

		// Animate out work intro lines (animate the inner span)
		gsap.to(workIntroLineSpans, {
			yPercent: 110,
			stagger: 0.05,
			ease: 'sine.inOut',
			duration: 0.5,
		});

		gsap.set(overlayNav, { display: 'flex' });
		gsap.fromTo(
			navItems,
			{
				yPercent: 110,
			},
			{
				yPercent: 0,
				stagger: 0.1,
			},
		);

		gsap.set(imageItems, { autoAlpha: 0 });

		projectButtons.forEach((listItem, i) => {
			if (i !== index) {
				const otherTitle = listItem.querySelector('.main-title');
				gsap.to(otherTitle, { yPercent: 100, autoAlpha: 0, duration: 0.45, delay: 0.2 - i * 0.05 });
			}
		});
	}

	function closeOverlay() {
		if (!activeListItem) return;

		// Find active overlay
		const index = Array.from(projectButtons).indexOf(activeListItem);
		const overlayItem = overlayItems[index];
		const title = overlayItem.querySelector("[data-overlay='text-target'] .main-title");
		const image = overlayItem.querySelector("[data-overlay='img-target'] .image");
		const overlayContent = overlayItem.querySelector('.overlay-row');

		// Record the state of title and image in overlay
		const titleState = Flip.getState(title, { props: 'fontSize' });
		const imageState = Flip.getState(image);

		// Reset overlay display and move elements back to their original containers
		gsap.to(navItems, {
			yPercent: 110,
			onComplete: () => {
				overlayNav.style.display = 'none';
			},
		});
		gsap.to(overlayContent, {
			autoAlpha: 0,
			onComplete: () => {
				overlayItem.style.display = 'none';
			},
		});

		// Animate work intro lines back in (animate the inner span)
		gsap.fromTo(
			workIntroLineSpans,
			{ yPercent: 110 },
			{
				yPercent: 0,
				stagger: 0.05,
				ease: 'power2.out',
			},
		);

		activeListItem.querySelector('.button').appendChild(title);
		imageItems[index].appendChild(image);
		gsap.set(imageItems[index], { autoAlpha: 1 });

		// Animate elements back with GSAP Flip
		Flip.from(titleState);
		Flip.from(imageState);

		// Remove active class
		activeListItem.classList.remove('active');
		activeListItem = null;

		gsap.to(headings, { yPercent: 0, autoAlpha: 1, delay: 0.3, stagger: 0.05 });
	}

	// Add click event listeners to list items
	projectButtons.forEach((listItem, index) => {
		listItem.addEventListener('pointerdown', () => {
			openOverlay(index);
		});
	});

	// Close overlay on ESC key
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') closeOverlay();
	});

	closeButton.addEventListener('pointerdown', closeOverlay);

	// Show corresponding image on hover of a list item, based on index
	projectButtons.forEach((listItem, i) => {
		listItem.addEventListener('mouseenter', () => {
			gsap.set(imageItems, { autoAlpha: 0 }); // hide all
			gsap.set(imageItems[i], { autoAlpha: 1 }); // show image with matching index
		});
	});
}
