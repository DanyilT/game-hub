import Avatar from '../../../../src/components/common/Avatar/Avatar';
import ExternalLink from '../../../../src/components/common/ExternalLink/ExternalLink';
import GooglePlayBadge from '../../../../src/components/common/GooglePlayBadge/GooglePlayBadge';
import InfoTip from '../../../../src/components/common/InfoTip/InfoTip';
import { ME } from '../../mocks/data';

/** The small parts: a player's picture, the ℹ note, a link to another site, and the Google Play badge */
export default {
  title: 'Common/Small parts',
  parameters: { layout: 'centered' },
};

export const Picture = {
  render: (args) => <Avatar {...args} />,
  args: { url: ME.avatar_url, name: 'Dany', size: 96 },
};

/** No picture: the first letter of their name */
export const PictureLetter = { ...Picture, args: { url: null, name: 'Nora', size: 96 } };

/** A picture that doesn't load falls back to the letter */
export const PictureBroken = { ...Picture, args: { url: 'https://example.invalid/picture.png', name: 'Yeti', size: 96 } };

export const Note = {
  render: (args) => <p style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Controls <InfoTip {...args} /></p>,
  args: { label: 'How the controls work', children: 'Hover over a key or gesture, or tap it, to see what it does.' },
};

export const GooglePlay = {
  render: (args) => <GooglePlayBadge {...args} />,
  args: { url: 'https://play.google.com/store/apps/details?id=com.DanyT.ChillZone', height: 64, showLegal: true },
};

/** A link to another site: a new tab, said to screen readers, and ↗ with `arrow` */
export const LinkOut = {
  render: (args) => <p>Made by <ExternalLink {...args}>Dany</ExternalLink>.</p>,
  args: { href: 'https://github.com/DanyilT', arrow: true },
};
