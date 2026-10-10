import { Fragment } from 'react';
import { CiUser } from 'react-icons/ci';
import { PiCloudCheck, PiProhibit, PiUserCheck } from 'react-icons/pi';
import Badge from '../../../../src/components/common/Badge/Badge';
import styles from './Design.module.scss';

const TONES = ['secondary', 'primary', 'accent', 'danger', 'neutral'];

/**
 * A small mark on or beside something (`src/components/common/Badge`): how many are waiting, a dot, or a word. It says
 * something and does nothing (a Tag can be picked; a Button does something).
 */
export default {
  title: 'Design system/Badge',
  component: Badge,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['count', 'dot', 'outline', 'soft'] },
    tone: { control: 'select', options: TONES },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
  },
  args: { variant: 'count', tone: 'secondary', size: 'sm', children: '3' },
};

export const Playground = {};

/** Each variant in each tone */
export const VariantsAndTones = {
  render: () => (
    <div className={styles.table} style={{ '--columns': TONES.length }}>
      <span />
      {TONES.map((tone) => <span key={tone} className={styles.heading}>{tone}</span>)}
      {['count', 'dot', 'outline', 'soft'].map((variant) => (
        <Fragment key={variant}>
          <span className={styles.heading}>{variant}</span>
          {TONES.map((tone) => (
            <span key={tone} className={variant === 'soft' ? styles.onPicture : undefined}>
              <Badge variant={variant} tone={tone}>{variant === 'count' ? 3 : 'soon'}</Badge>
            </span>
          ))}
        </Fragment>
      ))}
    </div>
  ),
};

/** Where the site uses them */
export const AtWork = {
  render: () => (
    <div className={styles.column}>
      <div className={styles.row}>
        <span className={styles.heading}>Filter games</span>
        <Badge>2<span className="visually-hidden"> selected</span></Badge>
      </div>
      <div className={styles.row}>
        <span style={{ position: 'relative', display: 'inline-flex', fontSize: 28 }}>
          <CiUser aria-hidden="true" />
          <Badge variant="dot" style={{ position: 'absolute', top: -2, right: -2 }} aria-hidden="true" />
        </span>
        <span>Profile</span>
        <Badge>1<span className="visually-hidden"> friend request</span></Badge>
        <Badge variant="outline">soon</Badge>
      </div>
      <div className={styles.row}>
        <Badge variant="outline" tone="accent" size="md" icon={PiUserCheck}>Friends</Badge>
        <Badge variant="outline" tone="danger" size="md" icon={PiProhibit}>Blocked</Badge>
        <Badge variant="outline" tone="accent">you</Badge>
      </div>
      <div className={styles.picture}>
        <Badge variant="soft" tone="accent" icon={PiCloudCheck}>Offline</Badge>
      </div>
    </div>
  ),
};
