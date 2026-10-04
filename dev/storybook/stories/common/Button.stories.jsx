import { Link } from 'react-router';
import { fn } from 'storybook/test';
import Button from '../../../../src/components/common/Button/Button';

/** The site's button: primary, outline or danger; a link that looks like one with `as` */
export default {
  title: 'Common/Button',
  component: Button,
  parameters: { layout: 'centered' },
  argTypes: { variant: { control: 'inline-radio', options: ['primary', 'outline', 'danger'] } },
  args: { children: 'Play', variant: 'primary', disabled: false, onClick: fn() },
};

export const Primary = {};
export const Outline = { args: { variant: 'outline', children: 'Cancel' } };
export const Danger = { args: { variant: 'danger', children: 'Delete my account' } };
export const Disabled = { args: { disabled: true } };
export const AsALink = { args: { as: Link, to: '/settings', children: 'Edit profile', variant: 'outline' } };

/** Side by side, as the site lays them out: the main action on the right */
export const Together = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <Button variant="outline">Cancel</Button>
      <Button variant="danger">Remove</Button>
      <Button>Save</Button>
    </div>
  ),
};
