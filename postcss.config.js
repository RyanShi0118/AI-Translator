// Host pages may change the root font-size (e.g. `html { font-size: 10px }`),
// which would distort every rem-based Tailwind utility inside our Shadow DOM.
// Convert rem to px so the injected UI renders identically on every site.
const remToPx = () => ({
  postcssPlugin: 'rem-to-px',
  Declaration(decl) {
    if (decl.value.includes('rem')) {
      decl.value = decl.value.replace(/(-?\d*\.?\d+)rem\b/g, (_, n) => `${parseFloat(n) * 16}px`);
    }
  },
});
remToPx.postcss = true;

export default {
  plugins: [(await import('tailwindcss')).default, remToPx(), (await import('autoprefixer')).default],
};
