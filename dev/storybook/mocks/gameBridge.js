import { useCallback, useEffect, useRef, useState } from 'react';
import { setDownloaded } from '../../../src/lib/offline';
import { GAME_STATUS } from './data';
import { scenario } from './scenario';

// Storybook's stand-in for src/lib/gameBridge.js (.storybook/main.js swaps it in). The game in the frame
// is the real one, from its own site, but it can't talk to Storybook (its gamehub.js only trusts
// GameHub's addresses), so this reports what the story's controls say instead (scenario.game): whether
// it has connected, its numbers for the panel, the save, the download, and a replay's progress.

export const SAVE_LIMIT = 64 * 1024;
export const flushSaves = async () => {};

const OFFLINE = {
  unknown: { supported: null, downloaded: false, busy: false, error: null },
  unsupported: { supported: false, downloaded: false, busy: false, error: null },
  available: { supported: true, downloaded: false, busy: false, error: null },
  downloaded: { supported: true, downloaded: true, busy: false, error: null },
};

/** What useGameBridge returns, from the scenario (the arguments it needs are the game's id and the replay) */
export const useGameBridge = ({ gameId, replay = null }) => {
  const game = scenario.game;
  // When the player last pressed a key in the game: just now, so the play time counts while the story is open
  const activity = useRef(game.playing ? Date.now() : 0);
  const [frameKey, setFrameKey] = useState(0);
  const [offline, setOffline] = useState(OFFLINE[game.download] ?? OFFLINE.unknown);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Keeps "playing" while the story is open (the real bridge hears the player's keys)
  useEffect(() => {
    if (!game.playing) return undefined;
    const tick = setInterval(() => { activity.current = Date.now(); }, 30_000);
    return () => clearInterval(tick);
  }, [game.playing]);

  // Downloading takes a moment, as it does in the game's page
  const setDownload = useCallback((download) => {
    setOffline((previous) => ({ ...previous, busy: true, error: null }));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setOffline({ supported: true, downloaded: download, busy: false, error: null });
      setDownloaded(gameId, download);
    }, 1200);
  }, [gameId]);

  const reloadGame = useCallback(() => setFrameKey((key) => key + 1), []);
  const resetProgress = useCallback(async () => {
    await new Promise((resolve) => { setTimeout(resolve, 600); });
    setFrameKey((key) => key + 1);
  }, []);

  const status = game.status && GAME_STATUS[gameId]
    ? { ...GAME_STATUS[gameId], ongoing: game.ongoing ?? GAME_STATUS[gameId].ongoing }
    : null;
  const length = 32_000; // ms of the game's time
  return {
    frameKey,
    connected: game.connected,
    gameVersion: game.version,
    saving: game.save === 'saving',
    savedAt: game.save === 'saved' ? new Date(Date.now() - 2 * 60_000) : null,
    saveFailed: game.save === 'failed',
    offline,
    setDownload,
    reloadGame,
    resetProgress,
    activity,
    gameStatus: game.connected && game.version === 3 ? status : null,
    replayState: replay ? { state: game.replay, position: game.replay === 'ended' ? length : length * game.replayAt, length } : null,
    controlReplay: () => {},
  };
};
