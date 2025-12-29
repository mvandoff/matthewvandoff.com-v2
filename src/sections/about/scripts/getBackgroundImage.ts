const lineColor = 'rgba(69, 69, 69, 0.07)';
export function getBackgroundImage() {
	return `repeating-linear-gradient(
			45deg,
			${lineColor} 0px,
			${lineColor} 1px,
			transparent 1px,
			transparent 11px,
			${lineColor} 11px,
			${lineColor} 12px,
			transparent 12px,
			transparent 32px
		),
		repeating-linear-gradient(
			0deg,
			${lineColor} 0px,
			${lineColor} 1px,
			transparent 1px,
			transparent 11px,
			${lineColor} 11px,
			${lineColor} 12px,
			transparent 12px,
			transparent 32px
		),
		repeating-linear-gradient(
			135deg,
			${lineColor} 0px,
			${lineColor} 1px,
			transparent 1px,
			transparent 11px,
			${lineColor} 11px,
			${lineColor} 12px,
			transparent 12px,
			transparent 32px
		),
		repeating-linear-gradient(
			90deg,
			${lineColor} 0px,
			${lineColor} 1px,
			transparent 1px,
			transparent 11px,
			${lineColor} 11px,
			${lineColor} 12px,
			transparent 12px,
			transparent 32px
		),
		radial-gradient(circle at 40% 20%,
  rgba(15, 19, 53, 0.8) 0%,
  rgba(0, 200, 255, 0.10) 26%,
  rgba(0, 0, 0, 0) 58%)
		`;
}

// linear-gradient(50deg, rgba(44, 15, 53, 0.78), black)
