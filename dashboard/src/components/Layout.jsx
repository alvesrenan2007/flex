import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import Logo from './Logo';
import { useAuth } from '../auth/AuthContext';

const THEME_STORAGE_KEY = 'flex_theme';

export default function Layout({ children }) {
  const { isAuthenticated, professor, logout } = useAuth();
  const { pathname } = useLocation();
  const isDashboard = pathname.startsWith('/app');
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const themeToggle = (
    <button
      type="button"
      className="theme-toggle"
      aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
      aria-pressed={theme === 'dark'}
      title={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
      onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  );

  return (
    <div className={`app-shell ${isDashboard ? 'dashboard-shell' : ''}`} data-theme={theme}>
      <header className="topbar">
        <div className="topbar-inner">
          <Logo size={43} />
          {isAuthenticated && isDashboard ? (
            <nav className="dashboard-nav" aria-label="Navegação principal">
              <NavLink to="/app" end>Dashboard</NavLink>
              <NavLink to="/app/presets">Presets</NavLink>
              <NavLink to="/app/profile">Perfil</NavLink>
              {themeToggle}
              <span className="dashboard-user-name">{professor?.name || professor?.email || 'Instrutor'}</span>
              <button type="button" onClick={logout}>Logout</button>
            </nav>
          ) : (
            <div className="topbar-controls">
              {isAuthenticated && (
                <div className="topbar-account">
                  <span>{professor?.name || professor?.email || 'Instrutor'}</span>
                  <button type="button" onClick={logout}>Logout</button>
                </div>
              )}
              {themeToggle}
            </div>
          )}
        </div>
      </header>
      <main className="main-area">{children}</main>
    </div>
  );
}
