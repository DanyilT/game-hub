import { useMemo } from 'react';
import { runRows } from './data';
import { scenario, signedIn } from './scenario';

// Storybook's stand-in for src/lib/runs.js (.storybook/main.js swaps it in): the same module, except that
// the runs to watch again come from the story (data.js) instead of this browser's IndexedDB. A guest's
// have no checks (they're never sent to the server).

export * from '../../../src/lib/runs.js';

/** The player's runs of the game, newest first: [{ key, endedAt, run, check }], or null until known */
export const useRuns = (player, gameId) => {
  const show = scenario.game.runs;
  const guest = !signedIn();
  return useMemo(() => {
    if (!player) return null;
    if (!show) return [];
    return runRows(gameId).map((row) => (guest ? { ...row, check: null } : row));
  }, [player, gameId, show, guest]);
};
