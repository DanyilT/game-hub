import { useState } from 'react';
import DownloadGame from '../../../../src/components/layout/game/DownloadGame/DownloadGame';
import { gamesById } from '../../../../src/data/games';

const STATES = {
  unknown: { supported: null, downloaded: false, busy: false, error: null },
  unsupported: { supported: false, downloaded: false, busy: false, error: null },
  available: { supported: true, downloaded: false, busy: false, error: null },
  busy: { supported: true, downloaded: false, busy: true, error: null },
  downloaded: { supported: true, downloaded: true, busy: false, error: null },
  failed: { supported: true, downloaded: false, busy: false, error: 'failed' },
};

/**
 * The game page's Download button: keeps the game on this device to play offline. It shows once the game has said it
 * can be downloaded; downloaded, pointing at it turns it into Remove (which asks first). Here a click pretends to
 * download for a moment.
 */
export default {
  title: 'Game/Download button',
  component: DownloadGame,
  parameters: { layout: 'centered' },
  render: function Render({ state, recorded }) {
    const [offline, setOffline] = useState(STATES[state]);
    const setDownload = (download) => {
      setOffline((previous) => ({ ...previous, busy: true }));
      setTimeout(() => setOffline({ ...STATES.available, downloaded: download }), 1200);
    };
    return <DownloadGame key={state} game={gamesById.get('snake')} offline={offline} recorded={recorded} onSetDownload={setDownload} />;
  },
  argTypes: { state: { control: 'select', options: Object.keys(STATES), description: 'What the game page says' } },
  args: { state: 'available', recorded: false },
};

export const Available = {};
export const Downloading = { args: { state: 'busy' } };
export const Downloaded = { args: { state: 'downloaded', recorded: true } };
/** Before the game has answered, the hub's memory of it shows */
export const RememberedAsDownloaded = { args: { state: 'unknown', recorded: true } };
/** The game can't be downloaded: no button */
export const Unsupported = { args: { state: 'unsupported' } };
