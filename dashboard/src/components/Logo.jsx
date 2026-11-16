import { useContext } from 'react';
import { ThemeContext } from './ThemeContext';

export default function Logo({ size = 45 }) {
  const theme = useContext(ThemeContext);
  const isDark = theme === 'dark';
  return (
    <img
      className={isDark ? 'dark-logo' : undefined}
      src={isDark ? '/flex-logo-dark.png' : '/flex-logo.png'}
      width={size}
      height={Math.round(size * 0.752)}
      role="img"
      aria-label="FLEX"
    />
  );
}
