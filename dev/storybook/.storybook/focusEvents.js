// Focus events in a window without the focus.
//
// Chrome moves the focus, but fires no focus or blur events, while its window isn't the active one: Storybook in a
// background window, or in a browser pane beside the editor. The play functions' user-event relies on those events: it
// only starts tracking a field's value once the field's focus event says it has the focus, and until then React never
// hears what's typed, so a form's button stays disabled and the form never submits (Settings' and Admin's stories).
//
// So, while the window has no focus, focus() and blur() fire the events themselves, as a focused window would. With
// the focus, they're left as they are. Storybook only: the site never runs this.

const fire = (element, type, relatedTarget, bubbles) => {
  element.dispatchEvent(new FocusEvent(type, { bubbles, relatedTarget }));
};

export const fireFocusEventsWithoutWindowFocus = () => {
  for (const proto of [HTMLElement.prototype, SVGElement.prototype]) {
    const { focus, blur } = proto;

    proto.focus = function focusWithEvents(...args) {
      const before = document.activeElement;
      focus.apply(this, args);
      if (document.hasFocus() || document.activeElement !== this || before === this) return;
      if (before && before !== document.body) {
        fire(before, 'blur', this, false);
        fire(before, 'focusout', this, true);
      }
      fire(this, 'focus', before, false);
      fire(this, 'focusin', before, true);
    };

    proto.blur = function blurWithEvents(...args) {
      const hadFocus = document.activeElement === this;
      blur.apply(this, args);
      if (document.hasFocus() || !hadFocus || document.activeElement === this) return;
      fire(this, 'blur', null, false);
      fire(this, 'focusout', null, true);
    };
  }
};
