const MOBILE_LAYOUT_QUERY = '(max-width: 1280px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const READY_ATTR = 'data-joystick-ready';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const applyDeadZone = (value: number, deadZone: number) => {
	if (Math.abs(value) <= deadZone) return 0;
	const sign = Math.sign(value);
	const scaled = (Math.abs(value) - deadZone) / (1 - deadZone);
	return sign * clamp(scaled, 0, 1);
};

type InitOptions = {
	tileId?: string;
	cardSelector?: string;
};

export function initJoyStickTile(options: InitOptions = {}) {
	if (!window.matchMedia(MOBILE_LAYOUT_QUERY).matches) return;
	if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;

	const tileId = options.tileId ?? 'joystick-tile';
	const cardSelector = options.cardSelector ?? '.screen-hero .intro-container';

	const tile = document.getElementById(tileId);
	const pad = tile?.querySelector<HTMLElement>('[data-joystick-pad]');
	const thumb = tile?.querySelector<HTMLElement>('[data-joystick-thumb]');
	const card = document.querySelector<HTMLElement>(cardSelector);
	if (!tile || !pad || !thumb || !card) return;
	if (tile.hasAttribute(READY_ATTR)) return;
	tile.setAttribute(READY_ATTR, 'true');

	const maxTiltDeg = Number(tile.dataset.maxTiltDeg ?? 9);
	const maxTranslatePx = Number(tile.dataset.maxTranslatePx ?? 7);
	const deadZone = Number(tile.dataset.deadZone ?? 0.05);

	let activePointerId: number | null = null;

	const setCardTilt = (xNormRaw: number, yNormRaw: number, padRect: DOMRect, thumbRect: DOMRect) => {
		const xNorm = applyDeadZone(clamp(xNormRaw, -1, 1), deadZone);
		const yNorm = applyDeadZone(clamp(yNormRaw, -1, 1), deadZone);

		card.style.setProperty('--mb-hero-tilt-x', `${yNorm * maxTiltDeg}deg`);
		card.style.setProperty('--mb-hero-tilt-y', `${-xNorm * maxTiltDeg}deg`);
		card.style.setProperty('--mb-hero-tilt-tx', `${xNorm * maxTranslatePx}px`);
		card.style.setProperty('--mb-hero-tilt-ty', `${-yNorm * maxTranslatePx}px`);

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
		setCardTilt(xNorm, yNorm, padRect, thumbRect);
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

