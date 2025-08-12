import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { SplitText } from 'gsap/SplitText';
import { setProjectBackground } from './setProjectBackground';

gsap.registerPlugin(Flip, SplitText);

export function initGalleryOverlayTransitionFlip() {
	const projectButtons = document.querySelectorAll<HTMLElement>('.project-list-item');
	const imageItems = document.querySelectorAll<HTMLElement>('.main-img-item');
	const overlayItems = document.querySelectorAll<HTMLElement>('.overlay-item');
	const overlayNav = document.querySelector<HTMLElement>('.overlay-nav')!;
	const navItems = document.querySelectorAll<HTMLElement>("[data-overlay='nav-item']");
	const closeButton = document.querySelector<HTMLElement>("[data-overlay='close']");
	const headings = document.querySelectorAll<HTMLElement>('.main-title');
	const workIntro = document.querySelector<HTMLElement>('#work-intro');
	const section = document.getElementById('work')!;

	if (
		!workIntro ||
		!section ||
		!overlayNav ||
		!closeButton ||
		projectButtons.length === 0 ||
		imageItems.length === 0 ||
		overlayItems.length === 0 ||
		navItems.length === 0 ||
		headings.length === 0
	) {
		throw Error();
	}

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

	let activeListItem: HTMLElement | null = null;

	function openOverlay(index: number) {
		if (index < 0 || index >= projectButtons.length || index >= imageItems.length || index >= overlayItems.length) {
			return;
		}
		section.classList.replace('overlay-closed', 'overlay-open');

		// Set active class to the clicked list item
		projectButtons.forEach((item) => item.classList.remove('active'));
		activeListItem = projectButtons[index] as HTMLElement;
		activeListItem.classList.add('active');

		const title = activeListItem.querySelector<HTMLElement>('.main-title');
		const imageContainer = imageItems[index];
		const image = imageContainer.querySelector<HTMLElement>('.image');
		if (!title || !image) throw Error();

		// Record the state of the title and image
		const titleState = Flip.getState(title, { props: 'fontSize' });
		const imageState = Flip.getState(image);

		// Show the overlay and get elements for animation
		const overlayItem = overlayItems[index];
		const content = overlayItem.querySelector<HTMLElement>('.overlay-row');

		gsap.set(overlayItem, { display: 'block', autoAlpha: 1 });
		if (content) gsap.fromTo(content, { autoAlpha: 0 }, { autoAlpha: 1, delay: 0.5 });

		const textTarget = document.querySelector<HTMLElement>("[data-overlay='text-target']");
		const imgTarget = document.querySelector<HTMLElement>("[data-overlay='img-target']");

		if (textTarget) textTarget.appendChild(title);
		if (imgTarget) imgTarget.appendChild(image);

		Flip.from(titleState);
		Flip.from(imageState);

		gsap.to(workIntroLineSpans, {
			yPercent: 110,
			stagger: 0.05,
			ease: 'sine.inOut',
			duration: 0.5,
		});

		gsap.set(overlayNav, { display: 'flex' });
		gsap.fromTo(navItems, { yPercent: 110 }, { yPercent: 0, stagger: 0.1 });
		gsap.set(imageItems, { autoAlpha: 0 });

		projectButtons.forEach((listItem, i) => {
			if (i !== index) {
				const otherTitle = listItem.querySelector<HTMLElement>('.main-title');
				if (otherTitle) {
					gsap.to(otherTitle, {
						yPercent: 100,
						autoAlpha: 0,
						duration: 0.45,
						delay: Math.max(0, 0.2 - i * 0.05),
					});
				}
			}
		});
	}

	function closeOverlay() {
		if (!activeListItem) return;

		setProjectBackground();
		section.classList.replace('overlay-open', 'overlay-closed');
		// document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });

		// Find active overlay
		const index = Array.from(projectButtons).indexOf(activeListItem);
		if (index < 0 || index >= overlayItems.length || index >= imageItems.length) {
			activeListItem = null;
			return;
		}

		const overlayItem = overlayItems[index]!;
		const title = document.querySelector<HTMLElement>("[data-overlay='text-target'] .main-title");
		const image = document.querySelector<HTMLElement>("[data-overlay='img-target'] .image");
		const overlayContent = overlayItem.querySelector<HTMLElement>('.overlay-row');

		if (!title || !image) {
			activeListItem = null;
			return;
		}

		const titleState = Flip.getState(title, { props: 'fontSize' });
		const imageState = Flip.getState(image);

		gsap.to(navItems, {
			yPercent: 110,
			onComplete: () => {
				overlayNav.style.display = 'none';
			},
		});

		if (overlayContent) {
			gsap.to(overlayContent, {
				autoAlpha: 0,
				onComplete: () => {
					overlayItem.style.display = 'none';
				},
			});
		} else {
			overlayItem.style.display = 'none';
		}

		gsap.fromTo(
			workIntroLineSpans,
			{ yPercent: 110 },
			{
				yPercent: 0,
				stagger: 0.05,
				ease: 'power2.out',
			},
		);

		const button = activeListItem.querySelector<HTMLElement>('.button');
		if (button) button.appendChild(title);
		imageItems[index]!.appendChild(image);
		gsap.set(imageItems[index]!, { autoAlpha: 1 });

		Flip.from(titleState);
		Flip.from(imageState);

		activeListItem.classList.remove('active');
		activeListItem = null;

		gsap.to(headings, { yPercent: 0, autoAlpha: 1, delay: 0.3, stagger: 0.05 });
	}

	// Add click event listeners to list items
	projectButtons.forEach((li, index) => {
		li.addEventListener('pointerdown', () => {
			setProjectBackground(li.dataset.projId);
			openOverlay(index);
		});
	});

	// Close overlay on ESC key
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') closeOverlay();
	});

	// Close button (guaranteed by early bail)
	closeButton.addEventListener('pointerdown', closeOverlay);

	// Show corresponding image on hover of a list item, based on index
	projectButtons.forEach((listItem, i) => {
		listItem.addEventListener('mouseenter', () => {
			gsap.set(imageItems, { autoAlpha: 0 }); // hide all
			if (imageItems[i]) gsap.set(imageItems[i], { autoAlpha: 1 }); // show matching
		});
	});
}
