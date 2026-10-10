// Store apps (ChillZone on Google Play): on an Android phone or tablet, GameHub tries to open the app, and Chrome goes
// to its Play listing when it can't (not installed, or an app with no link of its own: the listing has an Open button).
// Nothing is checked first. Anywhere else (an iPhone, a computer), a link can't open an app, so it's the store's page.

/** Whether this is an Android device (the only place a link can try an app and fall back to its store) */
const onAndroid = () => (navigator.userAgentData?.platform ?? navigator.userAgent).toLowerCase().includes('android');

/** Whether a store listing's app can be tried here: an Android app, on an Android device */
export const canOpenApp = (platform) => platform.type === 'android' && onAndroid();

/**
 * A link that opens an Android app, in Chrome's intent form: through its `appLink` when the catalogue has one
 * (chillzone://open → intent://open#Intent;scheme=chillzone;…), else its launcher. When the app can't be opened that way
 * (it isn't installed, or it has no link of its own), Chrome goes to its Play listing instead.
 * @param {object} platform - an android platform: { storeId, url, appLink? }
 */
export const openAppUrl = (platform) => {
  const fallback = `S.browser_fallback_url=${encodeURIComponent(platform.url)}`;
  if (platform.appLink) {
    const { protocol } = new URL(platform.appLink);
    const rest = platform.appLink.slice(protocol.length).replace(/^\/\//, '');
    return `intent://${rest}#Intent;scheme=${protocol.slice(0, -1)};package=${platform.storeId};${fallback};end`;
  }
  return `intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=${platform.storeId};${fallback};end`;
};
