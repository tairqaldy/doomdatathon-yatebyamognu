/**
 * Freedom CQA Tailwind v3 preset. Spec: docs/research/design-system.md
 * Usage (tailwind.config.js):
 *   module.exports = { presets: [require('../design/tailwind.preset.js')], content: ['./src/**\/*.{html,ts}'], important: '#cqa-root' }
 * Class names mirror fbroker.kz (bg-brand-primary, text-text-tertiary, rounded-20, mb:hidden, bg-gradient-brand…),
 * so utilities copied from the site work unchanged. Values come from design/tokens.css variables.
 */
const v = (name) => `var(--cqa-${name})`;
const px = (list) => Object.fromEntries(list.map((n) => [String(n), `${n}px`]));

module.exports = {
  theme: {
    screens: {
      mb: { max: '500px' },
      tb: { min: '501px', max: '991px' },
      sm: { max: '991px' },
      md: { min: '992px', max: '1200px' },
      lg: '992px',
      xl: '1280px',
    },
    extend: {
      colors: {
        brand: {
          primary: v('brand-primary'), secondary: v('brand-secondary'), additional: v('brand-additional'),
          accent: v('brand-accent'), tertiary: v('brand-tertiary'),
        },
        text: {
          primary: v('text-primary'), tertiary: v('text-tertiary'), secondary: v('text-secondary'),
          neutral: v('text-neutral'), inverse: v('text-inverse'),
        },
        bg: {
          page: v('bg-page'), primary: v('bg-primary'), secondary: v('bg-secondary'), warning: v('bg-warning'),
          hover: v('bg-hover'), dark: v('bg-dark'), cell: v('bg-cell'), overlay: v('overlay'),
        },
        'dark-primary': v('dark-primary'),
        divider: { primary: v('divider'), strong: v('divider-strong') },
        icon: { primary: v('icon-primary'), secondary: v('icon-secondary') },
        gray: { primary: v('gray-primary'), secondary: v('gray-secondary') },
        'link-blue': v('link'),
        state: {
          success: v('success'), error: v('error'), notify: v('notify'),
          'hover-light': v('bg-hover'),
        },
        ink: { success: v('success-ink'), error: v('error-ink'), notify: v('notify-ink'), na: v('na-ink'), gross: v('gross-ink') },
        tint: { success: v('success-bg'), error: v('error-bg'), notify: v('notify-bg'), na: v('na-bg'), gross: v('gross-bg') },
      },
      backgroundImage: {
        'gradient-brand': v('gradient-brand'),
        'gradient-brand-alt': v('gradient-brand-alt'),
        'gradient-brand-light': v('gradient-brand-light'),
        'gradient-overlay': v('gradient-overlay'),
        'glow-conic': v('glow-conic'),
      },
      fontFamily: { sans: v('font-sans').split(','), mono: v('font-mono').split(',') },
      fontSize: {
        ...px([10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 60, 84]),
        'app-small': ['12px', { lineHeight: '1.4', fontWeight: '500' }],
        'app-body': ['14px', { lineHeight: '1.5' }],
        'app-h3': ['16px', { lineHeight: '1.4', fontWeight: '600' }],
        'app-h2': ['20px', { lineHeight: '1.3', fontWeight: '700' }],
        'app-title': ['28px', { lineHeight: '1.2', fontWeight: '700' }],
        'app-score': ['40px', { lineHeight: '1', fontWeight: '900' }],
      },
      lineHeight: { 100: '1', 110: '1.1', 120: '1.2', 140: '1.4', 150: '1.5' },
      spacing: px([1, 2, 4, 6, 8, 10, 12, 16, 20, 24, 28, 32, 40, 44, 48, 52, 56, 60, 64, 80, 100, 140, 160, 192, 200, 248]),
      borderRadius: { ...px([4, 8, 12, 16, 20, 24, 28, 32, 40]), full: '9999px' },
      borderWidth: { 1: '1px', 1.5: '1.5px', 2: '2px' },
      boxShadow: {
        sm: v('shadow-sm'), default: v('shadow-default'), elevated: v('shadow-elevated'), glow: v('shadow-glow'),
      },
      maxWidth: { container: v('container') },
      transitionDuration: { fast: '150ms', base: '200ms', medium: '300ms', slow: '500ms', score: '1000ms' },
      transitionTimingFunction: {
        out: 'cubic-bezier(0,0,.2,1)', standard: 'cubic-bezier(.4,0,.2,1)', emphasized: 'cubic-bezier(.2,0,0,1)',
      },
      keyframes: {
        'cqa-rise': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        'cqa-flash': { '0%': { backgroundColor: 'rgba(0,242,96,.28)' }, '100%': { backgroundColor: 'transparent' } },
        'cqa-pulse': { '50%': { opacity: '.5' } },
      },
      animation: {
        rise: 'cqa-rise 500ms cubic-bezier(0,0,.2,1) both',
        flash: 'cqa-flash 1200ms cubic-bezier(0,0,.2,1)',
        pulse: 'cqa-pulse 2s cubic-bezier(.4,0,.6,1) infinite',
      },
    },
  },
};
