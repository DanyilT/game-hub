// Where players report bugs: GitHub issues, with a form that's already filled in. Games report to
// the repo their `sourceCode` link names (DanyilT/dt-games), anything else to the hub's own.

export const HUB_REPO_URL = 'https://github.com/DanyilT/game-hub';

/** The repo a GitHub link is in ("https://github.com/DanyilT/dt-games/tree/snake" → its repo URL), or null */
const githubRepo = (url) => {
  try {
    const { hostname, pathname } = new URL(url);
    const [owner, repo] = pathname.split('/').filter(Boolean);
    return hostname === 'github.com' && owner && repo ? `https://github.com/${owner}/${repo}` : null;
  } catch {
    return null;
  }
};

const newIssueUrl = (repoUrl, title, body) => `${repoUrl}/issues/new?${new URLSearchParams({ title, body })}`;

const BUG_TEMPLATE = [
  '**What happened?**',
  '',
  '',
  '**What did you expect to happen?**',
  '',
  '',
  '**How can we make it happen again?**',
  '1. ',
  '',
];

/**
 * A new GitHub issue for a bug in a game, in the game's own repo when its source is on GitHub
 * @param {object} game - a catalogue entry
 * @return {string}
 */
export const gameBugReportUrl = (game) => {
  const sources = [game.sourceCode ?? []].flat();
  const repo = sources.map(({ url }) => githubRepo(url)).find(Boolean) ?? HUB_REPO_URL;
  const where = typeof window === 'undefined' ? '' : window.location.href;
  return newIssueUrl(repo, `[${game.id}] `, [
    ...BUG_TEMPLATE,
    '---',
    `Game: ${game.title} (${game.id}), played on ${where}`,
    `Browser: ${typeof navigator === 'undefined' ? '' : navigator.userAgent}`,
  ].join('\n'));
};

/** A new GitHub issue about GameHub itself (the site, accounts, saves) */
export const hubBugReportUrl = () => newIssueUrl(HUB_REPO_URL, '', [
  ...BUG_TEMPLATE,
  '---',
  `Page: ${typeof window === 'undefined' ? '' : window.location.href}`,
  `Browser: ${typeof navigator === 'undefined' ? '' : navigator.userAgent}`,
].join('\n'));

/** The hub's list of issues, to see what's already reported */
export const HUB_ISSUES_URL = `${HUB_REPO_URL}/issues`;
