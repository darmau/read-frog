export const FORCE_BLOCK_TAGS = new Set([
  'BODY',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'BR',
  'FORM',
  'SELECT',
  'BUTTON',
  'LABEL',
  'UL',
  'OL',
  'LI',
  'BLOCKQUOTE',
  'PRE',
  'ARTICLE',
  'SECTION',
  'FIGURE',
  'FIGCAPTION',
  'HEADER',
  'FOOTER',
  'MAIN',
  'NAV',
])

// Don't walk into these tags
export const DONT_WALK_AND_TRANSLATE_TAGS = new Set([
  'HEAD',
  'HR',
  'INPUT',
  'TEXTAREA',
  'IMG',
  'VIDEO',
  'AUDIO',
  'CANVAS',
  'SOURCE',
  'TRACK',
  'META',
  'SCRIPT',
  'STYLE',
  'LINK',
])

export const DONT_WALK_BUT_TRANSLATE_TAGS = new Set([
  'CODE',
])

export const FORCE_INLINE_TRANSLATION_TAGS = new Set([
  'A',
  'BUTTON',
  'SELECT',
  'OPTION',
  'SPAN',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
])

// Tags to exclude when translating "main content only" to focus on article text
// These are typically UI elements, navigation, sidebars, and page chrome
export const MAIN_CONTENT_IGNORE_TAGS = new Set([
  'HEADER',
  'FOOTER',
  'NAV',
  'NOSCRIPT',
  'ASIDE', // Sidebars and complementary content
  'DIALOG', // Modal dialogs and popups
  'MENU', // Navigation menus
  'BUTTON', // Action buttons
  'FORM', // Form containers
  'LABEL', // Form labels
])
