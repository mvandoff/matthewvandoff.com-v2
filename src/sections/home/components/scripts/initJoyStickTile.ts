const MOBILE_LAYOUT_QUERY = '(max-width: 1280px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const READY_ATTR = 'data-joystick-ready';

const TILE_ID = 'joystick-tile';
const CARD_SELECTOR = '.screen-hero .intro-container';
const TILT_TARGETS_SELECTOR = '.intro-container, .img-container, .mb-tile, .mb-social-link';

const DEFAULT_MAX_TILT_DEG = 9;
const DEFAULT_MAX_TRANSLATE_PX = 7;
const DEFAULT_DEAD_ZONE = 0.05;
const DEFAULT_PERSPECTIVE_PX = 400;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const applyDeadZone = (value: number, deadZone: number) => {
	if (Math.abs(value) <= deadZone) return 0;
	const sign = Math.sign(value);
	const scaled = (Math.abs(value) - deadZone) / (1 - deadZone);
	return sign * clamp(scaled, 0, 1);
};

export function initJoyStickTile() {
	if (!window.matchMedia(MOBILE_LAYOUT_QUERY).matches) return;
	if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;

	const tile = document.getElementById(TILE_ID);
	const pad = tile?.querySelector<HTMLElement>('[data-joystick-pad]');
	const thumb = tile?.querySelector<HTMLElement>('[data-joystick-thumb]');
	const card = document.querySelector<HTMLElement>(CARD_SELECTOR);
	if (!tile || !pad || !thumb || !card) return;
	if (tile.hasAttribute(READY_ATTR)) return;
	tile.setAttribute(READY_ATTR, 'true');

	const maxTiltDeg = Number(tile.dataset.maxTiltDeg ?? DEFAULT_MAX_TILT_DEG);
	const maxTranslatePx = Number(tile.dataset.maxTranslatePx ?? DEFAULT_MAX_TRANSLATE_PX);
	const deadZone = Number(tile.dataset.deadZone ?? DEFAULT_DEAD_ZONE);
	const perspectivePx = Number(tile.dataset.perspectivePx ?? DEFAULT_PERSPECTIVE_PX);
	const identityTransform = `perspective(${perspectivePx}px) translate3d(0px, 0px, 0) rotateX(0deg) rotateY(0deg)`;

	const tiltTargets = Array.from(document.querySelectorAll<HTMLElement>(TILT_TARGETS_SELECTOR)).filter(
		(target) => target !== tile,
	);
	for (const target of tiltTargets) {
		target.style.transformOrigin = 'center';
		target.style.backfaceVisibility = 'hidden';
		target.style.willChange = 'transform';
	}

	const resetAnimations = new Map<HTMLElement, Animation>();
	const cancelResetAnimation = (target: HTMLElement) => {
		const animation = resetAnimations.get(target);
		if (!animation) return;
		animation.cancel();
		resetAnimations.delete(target);
	};

	let activePointerId: number | null = null;

	const setTilt = (xNormRaw: number, yNormRaw: number, padRect: DOMRect, thumbRect: DOMRect) => {
		const xNorm = applyDeadZone(clamp(xNormRaw, -1, 1), deadZone);
		const yNorm = applyDeadZone(clamp(yNormRaw, -1, 1), deadZone);

		card.style.setProperty('--mb-hero-tilt-x', `${yNorm * maxTiltDeg}deg`);
		card.style.setProperty('--mb-hero-tilt-y', `${-xNorm * maxTiltDeg}deg`);
		card.style.setProperty('--mb-hero-tilt-tx', `${xNorm * maxTranslatePx}px`);
		card.style.setProperty('--mb-hero-tilt-ty', `${-yNorm * maxTranslatePx}px`);

		for (const target of tiltTargets) {
			cancelResetAnimation(target);
			target.style.transform = `perspective(${perspectivePx}px) translate3d(${xNorm * maxTranslatePx}px, ${
				-yNorm * maxTranslatePx
			}px, 0) rotateX(${yNorm * maxTiltDeg}deg) rotateY(${-xNorm * maxTiltDeg}deg)`;
		}

		const thumbRadiusX = thumbRect.width / 2;
		const thumbRadiusY = thumbRect.height / 2;
		const maxThumbX = Math.max(0, padRect.width / 2 - thumbRadiusX);
		const maxThumbY = Math.max(0, padRect.height / 2 - thumbRadiusY);

		thumb.style.setProperty('--mb-joystick-thumb-x', `${xNorm * maxThumbX}px`);
		thumb.style.setProperty('--mb-joystick-thumb-y', `${-yNorm * maxThumbY}px`);
	};

	const reset = () => {
		card.style.setProperty('--mb-hero-tilt-x', '0deg');
		card.style.setProperty('--mb-hero-tilt-y', '0deg');
		card.style.setProperty('--mb-hero-tilt-tx', '0px');
		card.style.setProperty('--mb-hero-tilt-ty', '0px');

		for (const target of tiltTargets) {
			cancelResetAnimation(target);
			if (!target.style.transform) continue;
			const fromTransform = target.style.transform;
			const animation = target.animate([{ transform: fromTransform }, { transform: identityTransform }], {
				duration: 360,
				easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
				fill: 'forwards',
			});
			target.style.transform = identityTransform;
			animation.addEventListener(
				'finish',
				() => {
					animation.cancel();
					target.style.transform = '';
					resetAnimations.delete(target);
				},
				{ once: true },
			);
			resetAnimations.set(target, animation);
		}

		thumb.style.setProperty('--mb-joystick-thumb-x', '0px');
		thumb.style.setProperty('--mb-joystick-thumb-y', '0px');
		tile.classList.remove('is-active');
		delete card.dataset.tiltActive;
		activePointerId = null;
	};

	const updateFromClientPoint = (clientX: number, clientY: number) => {
		const padRect = pad.getBoundingClientRect();
		const thumbRect = thumb.getBoundingClientRect();
		const centerX = padRect.left + padRect.width / 2;
		const centerY = padRect.top + padRect.height / 2;
		const radiusX = Math.max(1, padRect.width / 2);
		const radiusY = Math.max(1, padRect.height / 2);

		const xNorm = (clientX - centerX) / radiusX;
		const yNorm = (centerY - clientY) / radiusY;
		setTilt(xNorm, yNorm, padRect, thumbRect);
	};

	const onPointerDown = (event: PointerEvent) => {
		if (event.button !== 0) return;
		activePointerId = event.pointerId;
		pad.setPointerCapture(event.pointerId);
		tile.classList.add('is-active');
		card.dataset.tiltActive = 'true';
		updateFromClientPoint(event.clientX, event.clientY);
		event.preventDefault();
	};

	const onPointerMove = (event: PointerEvent) => {
		if (activePointerId === null || event.pointerId !== activePointerId) return;
		updateFromClientPoint(event.clientX, event.clientY);
		event.preventDefault();
	};

	const onPointerUp = (event: PointerEvent) => {
		if (activePointerId === null || event.pointerId !== activePointerId) return;
		reset();
	};

	pad.addEventListener('pointerdown', onPointerDown);
	pad.addEventListener('pointermove', onPointerMove);
	pad.addEventListener('pointerup', onPointerUp);
	pad.addEventListener('pointercancel', reset);
	pad.addEventListener('lostpointercapture', reset);
	window.addEventListener('blur', reset);
}
