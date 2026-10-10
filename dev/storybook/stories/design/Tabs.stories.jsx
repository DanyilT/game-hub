import { useState } from 'react';
import { PiBookmarkSimple, PiGameController, PiHeart, PiUserPlus, PiUsers } from 'react-icons/pi';
import { expect } from 'storybook/test';
import Tabs from '../../../../src/components/common/Tabs/Tabs';

/**
 * A row of tabs (`src/components/common/Tabs`): the arrow keys, Home and End move through them. Each has an icon, and
 * a count, or a pink count of what's waiting; a private one has a lock that says so. Small ones (inside a tab) are
 * pills. The page draws the panel the chosen tab shows.
 */
export default {
  title: 'Design system/Tabs',
  component: Tabs,
  parameters: { layout: 'padded' },
};

const TABS = [
  { id: 'played', label: 'Played', icon: PiGameController, count: 4 },
  { id: 'friends', label: 'Friends', icon: PiUsers, count: 12, alert: { count: 2, text: 'friend requests' } },
  { id: 'favorites', label: 'Favorites', icon: PiHeart, count: 3 },
  { id: 'bookmarks', label: 'Bookmarks', icon: PiBookmarkSimple, count: 1, private: true },
];

const Row = ({ tabs = TABS, small = false }) => {
  const [selected, setSelected] = useState(tabs[0].id);
  return (
    <>
      <Tabs label="Profile" idPrefix="story-tab" panelId="story-panel" tabs={tabs} selected={selected} onSelect={setSelected} small={small} />
      <div id="story-panel" role="tabpanel" aria-labelledby={`story-tab-${selected}`} style={{ padding: '16px 0' }}>
        The {selected} panel
      </div>
    </>
  );
};

export const Default = {
  render: () => <Row />,
  play: async ({ canvas, userEvent }) => {
    const played = canvas.getByRole('tab', { name: /Played/ });
    played.focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('tab', { name: /Friends/ })).toHaveAttribute('aria-selected', 'true');
    await expect(canvas.getByRole('tab', { name: /Bookmarks/ })).toHaveAccessibleDescription('Private: only you see this tab');
  },
};

/** Small: inside a tab */
export const Small = {
  render: () => (
    <Row
      small
      tabs={[
        { id: 'list', label: 'Your friends', icon: PiUsers, count: 12 },
        { id: 'requests', label: 'Requests', icon: PiUserPlus, alert: { count: 2, text: 'friend requests' }, private: true },
      ]}
    />
  ),
};
