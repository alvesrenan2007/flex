export default function Logo({ size = 45, theme = 'light' }) {
  const isDark = theme === 'dark';
  return (
    <img
      src={isDark ? '/flex-logo-dark.png' : '/flex-logo.png'}
      width={size}
      height={isDark ? size * (542 / 572) : size * 0.752}
      role="img"
      aria-label="FLEX"
    />
  );
}
