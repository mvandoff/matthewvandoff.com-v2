import type { WorkState } from './types';

export function createWorkState(): WorkState {
	return { activeListItem: null, activeProjId: null, activeProjContainer: null };
}
