import { cof, cwf } from '../../lib/weechat/colors';

/**
 * Colors for the app's own chrome on the chat screen: bars, backgrounds,
 * fields and buttons. Buffer text keeps WeeChat's colors from
 * src/lib/weechat/colors.ts.
 */
export const palette = {
  /** Message list and empty buffer area. */
  background: '#15171c',
  /** Top bar, topic and message bar. */
  surface: '#1c1f26',
  /** Text field and floating pills. */
  field: '#252932',
  /** Hairlines between bars and around fields. */
  line: '#2d323c',
  text: '#e7e9ee',
  /** Secondary text, placeholders and secondary icons. */
  dim: '#8d95a3',
  /** Send button and caret: WeeChat's light cyan. */
  accent: cwf.lightcyan,
  onAccent: '#0b3b38',
  /** Mentions only, matching how highlighted lines are drawn. */
  highlight: cof.chat_highlight.backgroundColor ?? '#ffcf7f'
};
