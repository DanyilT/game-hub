import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PiCode, PiFlag } from 'react-icons/pi';
import { useAuth } from '../../contexts/AuthContext';
import { gamesById } from '../../data/games';
import { USERNAME_PATTERN } from '../../lib/account';
import { timeAgo } from '../../lib/activity';
import { askToConfirm } from '../../lib/confirm';
import { fullDate, monthYear } from '../../lib/dates';
import {
  describeRoleError, fetchOpenReportCount, fetchReports, gamesBy, isAdmin, resolveReport, setDeveloper,
} from '../../lib/roles';
import { supabase } from '../../lib/supabase';
import { showToast } from '../../lib/toast';
import { useLoad } from '../../lib/useLoad';
import Avatar from '../../components/common/Avatar/Avatar';
import Badge from '../../components/common/Badge/Badge';
import Button from '../../components/common/Button/Button';
import { RadioGroup, TextField } from '../../components/common/Field/Field';
import Message from '../../components/common/Message/Message';
import PageTitle from '../../components/common/PageTitle/PageTitle';
import Status from '../../components/common/Status/Status';
import Tabs from '../../components/common/Tabs/Tabs';
import ErrorPage from '../ErrorPage/ErrorPage';
import styles from './Account.module.scss';

// Reports' filter: open, resolved, or all (admin_reports' p_resolved)
const REPORT_FILTERS = [
  { value: 'open', label: 'Open', resolved: false },
  { value: 'resolved', label: 'Resolved', resolved: true },
  { value: 'all', label: 'All', resolved: null },
];
const REASONS = { cheating: 'Cheating', other: 'Something else' };

/** A player in a list here: their picture and names, linking to their profile */
const PlayerLink = ({ username, displayName, avatarUrl }) => {
  const name = displayName ?? username;
  return (
    <Link to={`/u/${username}`} className={styles.blockedPlayer}>
      <Avatar url={avatarUrl} name={name} size={36} />
      <span className={styles.playerNames}>
        <span className={styles.blockedName}>{name}</span>
        <span className={styles.playerMeta}>@{username}</span>
      </span>
    </Link>
  );
};

/** One report: who it's about, why, what the reporter wrote, and its Resolve (or Reopen) button */
const Report = ({ report, onChange }) => {
  const [busy, setBusy] = useState(false);
  const game = report.game_id ? gamesById.get(report.game_id) : null;
  const toggle = async () => {
    setBusy(true);
    try {
      await resolveReport(report.id, !report.resolved);
      onChange();
    } catch (error) {
      showToast(describeRoleError(error), { tone: 'error' });
      setBusy(false);
    }
  };
  return (
    <li className={`${styles.reportRow} ${report.resolved ? styles.resolved : ''}`}>
      <div className={styles.reportHead}>
        <PlayerLink
          username={report.reported_username}
          displayName={report.reported_display_name}
          avatarUrl={report.reported_avatar_url}
        />
        <span className={styles.reportTags}>
          <Badge variant={report.reason === 'cheating' ? 'soft' : 'outline'} tone={report.reason === 'cheating' ? 'danger' : 'neutral'} size="md">
            {REASONS[report.reason] ?? report.reason}
          </Badge>
          {game && <Badge variant="outline" tone="primary" size="md"><Link to={`/g/${game.id}`}>{game.title}</Link></Badge>}
        </span>
      </div>
      {report.message ? <p className={styles.bio}>{report.message}</p> : <Message>No message.</Message>}
      <Message>
        From <Link to={`/u/${report.reporter_username}`}>@{report.reporter_username}</Link>, {timeAgo(report.created_at)}
        {report.reports_about_them > 1 && ` · ${report.reports_about_them} reports about them in all`}
        {report.resolved && report.resolved_at && ` · resolved ${fullDate(report.resolved_at)}`}
        {report.resolved && report.resolved_by_username && ` by @${report.resolved_by_username}`}
      </Message>
      <div className={styles.actions}>
        <Button variant={report.resolved ? 'outline' : 'filled'} size="sm" onClick={toggle} disabled={busy}>
          {report.resolved ? 'Reopen' : 'Resolve'}
        </Button>
      </div>
    </li>
  );
};

/** The reports tab: the filter, then the reports, newest first */
const Reports = ({ onChange }) => {
  const [filter, setFilter] = useState('open');
  const { resolved } = REPORT_FILTERS.find(({ value }) => value === filter);
  const reports = useLoad(() => fetchReports(resolved), ['reports', filter]);
  const changed = () => {
    reports.reload();
    onChange();
  };

  let list;
  if (reports.error) {
    list = <Status kind="error" onRetry={reports.reload}>Couldn&rsquo;t load the reports. {describeRoleError(reports.error)}</Status>;
  } else if (!reports.loaded) {
    list = <Status kind="loading">Loading reports…</Status>;
  } else if (reports.data.length === 0) {
    list = <Status kind="empty">{filter === 'open' ? 'No open reports. All quiet.' : 'No reports here.'}</Status>;
  } else {
    list = <ul className={styles.reportList}>{reports.data.map((report) => <Report key={report.id} report={report} onChange={changed} />)}</ul>;
  }

  return (
    <>
      <Message>
        Players report each other from the ⋯ on a profile. Look into it (for cheating: the player&rsquo;s records and
        refused runs, in the game_runs table), then resolve it. The reported player is never told who reported them.
      </Message>
      <RadioGroup
        variant="segmented"
        shape="rounded"
        label="Show"
        hideLabel
        options={REPORT_FILTERS.map(({ value, label }) => ({ value, label }))}
        value={filter}
        onChange={setFilter}
      />
      {list}
    </>
  );
};

/** The developers tab: making a player a developer (by username), and the developers, each with Take away */
const Developers = () => {
  const developers = useLoad(async () => {
    const { data, error } = await supabase.from('developers').select('id, username, display_name, avatar_url, developer_since').order('username');
    if (error) throw error;
    return data;
  }, ['developers']);
  const [username, setUsername] = useState('');
  const [problem, setProblem] = useState(null);
  const [busy, setBusy] = useState(false);

  const change = async (player, developer) => {
    const name = player.display_name ?? player.username;
    const yes = await askToConfirm(developer ? {
      title: `Make ${name} a developer?`,
      message: `Their profile gets a bio, links and the games they made, and they're listed with the developers.`,
      confirmLabel: 'Make developer',
    } : {
      title: `Take away ${name}'s developer role?`,
      message: `Their profile stops showing their bio, links and games (both are kept, in case the role comes back).`,
      confirmLabel: 'Take it away',
      danger: true,
    });
    if (!yes) return false;
    try {
      await setDeveloper(player.id, developer);
      showToast(developer ? `${name} is a developer now.` : `${name} isn't a developer any more.`);
      developers.reload();
      return true;
    } catch (error) {
      showToast(describeRoleError(error), { tone: 'error' });
      return false;
    }
  };

  const add = async (e) => {
    e.preventDefault();
    const wanted = username.trim().replace(/^@/, '').toLowerCase();
    if (!USERNAME_PATTERN.test(wanted)) {
      setProblem('That isn’t a username: 3–20 lowercase letters, numbers and _.');
      return;
    }
    setBusy(true);
    setProblem(null);
    const { data, error } = await supabase.from('profiles').select('id, username, display_name').eq('username', wanted).maybeSingle();
    if (error) setProblem(describeRoleError(error));
    else if (!data) setProblem(`There's no player called @${wanted}.`);
    else if (developers.data?.some((row) => row.id === data.id)) setProblem(`@${wanted} is a developer already.`);
    else if (await change(data, true)) setUsername('');
    setBusy(false);
  };

  return (
    <>
      <Message>
        A developer&rsquo;s profile has their bio, links and games. A game links to its developer once the games table
        names their account: its <code>developer_id</code> (Supabase → Table Editor → games).
      </Message>
      <form onSubmit={add}>
        <TextField
          id="admin-new-developer"
          label="Make a player a developer"
          prefix="@"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setProblem(null);
          }}
          placeholder="username"
          autoComplete="off"
          spellCheck={false}
          error={problem ?? undefined}
          after={<Button type="submit" disabled={busy || !username.trim()}>{busy ? 'Looking…' : 'Make developer'}</Button>}
        />
      </form>
      {developers.error && <Status kind="error" onRetry={developers.reload}>Couldn&rsquo;t load the developers.</Status>}
      {!developers.loaded && !developers.error && <Status kind="loading" />}
      {developers.loaded && (developers.data.length === 0 ? <Status kind="empty">No developers yet.</Status> : (
        <ul className={styles.blockedList}>
          {developers.data.map((developer) => {
            const made = gamesBy(developer.username).length;
            return (
              <li key={developer.id} className={styles.blockedRow}>
                <PlayerLink username={developer.username} displayName={developer.display_name} avatarUrl={developer.avatar_url} />
                <span className={styles.playerMeta}>
                  {made > 0 ? `${made} ${made === 1 ? 'game' : 'games'} · ` : ''}since {monthYear(developer.developer_since, 'short')}
                </span>
                <Button variant="outline" tone="danger" size="sm" onClick={() => change(developer, false)}>Take away</Button>
              </li>
            );
          })}
        </ul>
      ))}
    </>
  );
};

/** /admin: players' reports, and the developers. Only admins see it (anyone else gets the 404 page). */
const Admin = () => {
  const { loading, user, profile, profileError, refreshProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const admin = isAdmin(profile);
  const openCount = useLoad(admin ? fetchOpenReportCount : null, ['open-reports', admin]);

  if (loading || (user && !profile && !profileError)) return <div className={styles.page}><Status kind="loading" /></div>;
  if (user && !profile) {
    return (
      <div className={styles.page}>
        <Status kind="error" onRetry={refreshProfile}>Couldn&rsquo;t load your profile. Check your connection and try again.</Status>
      </div>
    );
  }
  if (!admin) return <ErrorPage status={404} />;

  const tabs = [
    {
      id: 'reports',
      label: 'Reports',
      icon: PiFlag,
      alert: { count: openCount.data ?? 0, text: openCount.data === 1 ? 'open report' : 'open reports' },
    },
    { id: 'developers', label: 'Developers', icon: PiCode },
  ];
  const tab = tabs.some(({ id }) => id === searchParams.get('tab')) ? searchParams.get('tab') : tabs[0].id;
  const select = (id) => setSearchParams(id === tabs[0].id ? {} : { tab: id }, { replace: true, state: { keepScroll: true } });

  return (
    <div className={`${styles.page} ${styles.wide}`}>
      <PageTitle>Admin</PageTitle>
      <section className={styles.card}>
        <Tabs label="Admin" idPrefix="admin-tab" panelId="admin-panel" tabs={tabs} selected={tab} onSelect={select} />
        <div id="admin-panel" role="tabpanel" aria-labelledby={`admin-tab-${tab}`} className={styles.tabPanel}>
          {tab === 'reports' ? <Reports onChange={openCount.reload} /> : <Developers />}
        </div>
      </section>
    </div>
  );
};

export default Admin;
