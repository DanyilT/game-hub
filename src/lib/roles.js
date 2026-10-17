import { FaDiscord, FaGithub, FaGitlab, FaGooglePlay, FaInstagram, FaItchIo, FaLinkedin, FaPatreon, FaReddit, FaSteam, FaTiktok, FaTwitch, FaYoutube } from 'react-icons/fa';
import { FaBluesky, FaMastodon, FaXTwitter } from 'react-icons/fa6';
import { SiBuymeacoffee } from 'react-icons/si';
import { CiGlobe } from 'react-icons/ci';
import { games } from '../data/games';
import { supabase } from './supabase';

// Roles (supabase/migrations/*_roles_and_developers.sql): every account is a player; some are also developers (a bio
// and links on their profile, and the games they made) or admins (they deal with reports and make players developers,
// on /admin). Who's a developer is public; who's an admin, only to themselves. Admins only change roles and reports
// through database functions, which check the role again. Profiles come with their roles (ROLE_COLUMNS in account.js).

export const DEVELOPER_BIO_MAX = 500; // characters, like the table's check
export const DEVELOPER_LINKS_MAX = 6;

const hasRole = (profile, role) => Boolean(profile?.user_roles?.some((row) => row.role === role));
export const isDeveloper = (profile) => hasRole(profile, 'developer');
export const isAdmin = (profile) => hasRole(profile, 'admin');

/** A developer's bio and links ({ bio: '', links: [] } before they've written any), or null for anyone else */
export const developerInfo = (profile) => {
  if (!isDeveloper(profile)) return null;
  const info = profile.developer_profiles;
  return { bio: info?.bio ?? '', links: info?.links ?? [] };
};

/** The games a developer made: the catalogue's games whose `developer.username` is theirs */
export const gamesBy = (username) => games.filter((game) => game.developer?.username === username);

// A link's site, by its address: [hosts, label, icon]
const SITES = [
  [['github.com'], 'GitHub', FaGithub],
  [['gitlab.com'], 'GitLab', FaGitlab],
  [['itch.io'], 'itch.io', FaItchIo],
  [['x.com', 'twitter.com'], 'X', FaXTwitter],
  [['bsky.app'], 'Bluesky', FaBluesky],
  [['youtube.com', 'youtu.be'], 'YouTube', FaYoutube],
  [['twitch.tv'], 'Twitch', FaTwitch],
  [['discord.gg', 'discord.com'], 'Discord', FaDiscord],
  [['instagram.com'], 'Instagram', FaInstagram],
  [['tiktok.com'], 'TikTok', FaTiktok],
  [['reddit.com'], 'Reddit', FaReddit],
  [['linkedin.com'], 'LinkedIn', FaLinkedin],
  [['patreon.com'], 'Patreon', FaPatreon],
  [['buymeacoffee.com', 'coff.ee'], 'Buy Me a Coffee', SiBuymeacoffee],
  [['store.steampowered.com', 'steamcommunity.com'], 'Steam', FaSteam],
  [['play.google.com'], 'Google Play', FaGooglePlay],
];

/**
 * What a developer's link is, for showing it: the site's name and icon (GitHub), or its address and a globe
 * @param {string} url
 * @return {{label: string, Icon: function}}
 */
export const linkSite = (url) => {
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return { label: url, Icon: CiGlobe };
  }
  const site = SITES.find(([hosts]) => hosts.some((name) => host === name || host.endsWith(`.${name}`)));
  if (site) return { label: site[1], Icon: site[2] };
  if (/(^|\.)mastodon\.|^mstdn\./.test(host)) return { label: 'Mastodon', Icon: FaMastodon };
  return { label: host, Icon: CiGlobe };
};

const call = async (fn, args) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
};

/**
 * Saves the signed-in developer's bio and links (Settings → Developer)
 * @param {{bio: string, links: string[]}} info - empty links are dropped
 */
export const saveDeveloperProfile = ({ bio, links }) => call('update_developer_profile', { p_bio: bio, p_links: links });

/** Admins: makes a player a developer (true) or not. Resolves to whether that changed anything. */
export const setDeveloper = (playerId, developer) => call('set_developer', { p_user: playerId, p_developer: developer });

/**
 * Admins: players' reports, newest first, each with both players and how many reports there are about the reported one
 * @param {boolean|null} resolved - open ones (false), resolved ones (true), or all (null)
 */
export const fetchReports = (resolved) => call('admin_reports', { p_resolved: resolved });

/** Admins: how many reports are open */
export const fetchOpenReportCount = () => call('open_report_count');

/** Admins: marks a report resolved (true) or open again */
export const resolveReport = (reportId, resolved) => call('resolve_report', { p_report: reportId, p_resolved: resolved });

/**
 * A sentence for an error from the functions above
 * @param {object} error - a PostgrestError, or a network error
 * @return {string}
 */
export const describeRoleError = (error) => {
  if (['bio_length', 'links_count', 'no_player'].includes(error?.hint)) return error.message;
  if (error?.hint === 'link_invalid') return `${error.message} (not “${error.details}”).`;
  if (error?.hint === 'not_admin') return 'Only admins can do that.';
  if (error?.hint === 'not_developer') return 'Only developers have a bio and links.';
  if (error?.code === '42501' || error?.code === 'PGRST301') return 'Your session has expired. Sign in again.';
  return "Couldn't do that. Check your connection and try again.";
};
