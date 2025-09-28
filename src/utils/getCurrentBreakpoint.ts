function getCurrentBreakpoint() {
	const width = window.innerWidth;

	if (width <= 767) return 'sm';
	if (width <= 1023) return 'md';
	return 'lg';
}

export default getCurrentBreakpoint;
