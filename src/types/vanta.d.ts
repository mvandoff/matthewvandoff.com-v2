declare module 'vanta/dist/*' {
	import type * as THREE from 'three';

	type VantaOptions = {
		el: HTMLElement | string;
		THREE?: typeof THREE;
		mouseControls?: boolean;
		touchControls?: boolean;
		gyroControls?: boolean;
		minHeight?: number;
		minWidth?: number;
		scale?: number;
		scaleMobile?: number;
		[key: string]: unknown;
	};

	type VantaEffect = {
		destroy: () => void;
		resize?: () => void;
		setOptions?: (options: Partial<VantaOptions>) => void;
	};

	const WAVES: (options: VantaOptions) => VantaEffect;
	export default WAVES;
}

declare module 'vanta/dist/vanta.waves.min' {
	export { default } from 'vanta/dist/vanta.waves.min.js';
}
