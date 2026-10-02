import { useEffect, useRef, useState } from 'react';
import { PiCloudArrowDown, PiCloudCheck, PiDownloadSimple, PiCloudX } from 'react-icons/pi';
import { askToConfirm } from '../../../../lib/confirm';
import { showToast } from '../../../../lib/toast';
import styles from './DownloadGame.module.scss';

/**
 * The game page's Download button: keeps the game on this device, to play it offline in GameHub
 * (in the browser or the installed app). The game's own page does the downloading
 * (public/hub-bridge.js), so the button shows once the game has loaded and said it can be
 * downloaded: never where the game or the browser can't do it. A game the hub remembers as
 * downloaded shows that straight away (offline, the game can't reach the hub to say so).
 * Downloaded, it's also how to remove the download: pointing at it (or tabbing to it) turns
 * "Downloaded" into "Remove", and that asks first. Not while the pointer is still on it from
 * downloading, though. In the game page's narrow header it's only the icon.
 * @param {object} game - the catalogue entry
 * @param {object} offline - { supported, downloaded, busy, error } from useGameBridge
 * @param {boolean} recorded - whether the hub remembers it as downloaded (src/lib/offline.js), shown
 *   until the game's page answers, or when it can't (offline, it can't reach the hub)
 * @param {function} onSetDownload - downloads (true) or removes the download (false)
 */
const DownloadGame = ({ game, offline, recorded, onSetDownload }) => {
  const actionRef = useRef(null); // 'download' or 'remove' while one is under way
  // Just downloaded: it says Downloaded until the pointer or focus moves away, rather than Remove under the click
  const [justDownloaded, setJustDownloaded] = useState(false);

  // Says how it went, once the game's page has answered
  useEffect(() => {
    const action = actionRef.current;
    if (!action || offline.busy) return;
    actionRef.current = null;
    if (offline.error === 'unavailable') showToast(`${game.title} can't be downloaded yet.`, { tone: 'error' });
    else if (offline.error) showToast("Couldn't do that. Check your connection and try again.", { tone: 'error' });
    else if (action === 'download') {
      setJustDownloaded(true);
      showToast(`${game.title} is downloaded: it plays offline in GameHub, in this browser or the app.`);
    } else showToast(`The download of ${game.title} is removed.`);
  }, [offline.busy, offline.error, game.title]);

  if (offline.supported === false || (offline.supported === null && !recorded)) return null;

  const { busy } = offline;
  const ready = offline.supported === true;
  const downloaded = ready ? offline.downloaded : recorded;
  const removable = ready && downloaded && !busy;

  let Icon = PiDownloadSimple;
  let label = 'Download';
  let title = 'Download to play offline in GameHub';
  if (busy) {
    Icon = PiCloudArrowDown;
    label = actionRef.current === 'remove' ? 'Removing…' : 'Downloading…';
    title = null;
  } else if (downloaded) {
    Icon = PiCloudCheck;
    label = 'Downloaded';
    title = ready ? 'Downloaded: it plays offline in GameHub. Click to remove the download.' : 'Downloaded: it plays offline in GameHub';
  }

  const toggle = async () => {
    if (busy) return;
    if (downloaded) {
      const yes = await askToConfirm({
        title: 'Remove download?',
        message: `${game.title} won’t play offline any more. Your progress stays.`,
        confirmLabel: 'Remove',
        danger: true,
      });
      if (!yes) return;
    }
    actionRef.current = downloaded ? 'remove' : 'download';
    onSetDownload(!downloaded);
  };

  const classes = [
    styles.download,
    downloaded && styles.downloaded,
    removable && !justDownloaded && styles.removable,
    busy && styles.busy,
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={classes}
      onClick={toggle}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') setJustDownloaded(false);
      }}
      onBlur={() => setJustDownloaded(false)}
      // Busy, it stays focusable (a disabled button would lose the keyboard focus) and ignores clicks
      disabled={!ready}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      title={title ?? undefined}
    >
      <span className={styles.face}>
        <Icon aria-hidden="true" />
        <span className={styles.label}>{label}</span>
      </span>
      {/* Drawn over it on hover and focus; screen readers get the title instead */}
      {removable && (
        <span className={`${styles.face} ${styles.remove}`} aria-hidden="true">
          <PiCloudX />
          <span className={styles.label}>Remove</span>
        </span>
      )}
    </button>
  );
};

export default DownloadGame;
