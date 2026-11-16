import { useContext } from 'react';
import { ThemeContext } from './ThemeContext';

export default function Logo({ size = 45 }) {
  const theme = useContext(ThemeContext);
  const isDark = theme === 'dark';
  const width = isDark ? Math.round(size * 1.16) : size;
  const height = isDark ? Math.round(width * (542 / 572)) : Math.round(size * 0.752);
  return (
    <img
      className={isDark ? 'dark-logo' : undefined}
      src={isDark ? '/flex-logo-dark.png' : '/flex-logo.png'}
      width={width}
      height={height}
      role="img"
      aria-label="FLEX"
    />
  );
}
