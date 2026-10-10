import PageTitle from '../../../../src/components/common/PageTitle/PageTitle';

/** A page's title (`src/components/common/PageTitle`): its h1, in the site's neon gradient sliding through it */
export default {
  title: 'Design system/Page title',
  component: PageTitle,
  parameters: { layout: 'padded' },
  argTypes: { align: { control: 'inline-radio', options: ['start', 'center'] } },
  args: { align: 'start', children: 'Settings' },
};

export const Default = {};

/** Centred: the legal pages, the error page */
export const Centred = { args: { align: 'center', children: 'Terms & Conditions' } };
