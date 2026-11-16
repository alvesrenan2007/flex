import { NavLink, useLocation } from 'react-router-dom';
import Logo from './Logo';
import { useAuth } from '../auth/AuthContext';

export default function Layout({ children }) {
  const { isAuthenticated, professor, logout } = useAuth();
  const { pathname } = useLocation();
  const isDashboard = pathname.startsWith('/app');
  return (
    <div className={`app-shell ${isDashboard ? 'dashboard-shell' : ''}`}>
      <header className="topbar">
        <div className="topbar-inner">
          <Logo size={43} />
          {isAuthenticated && isDashboard ? (
            <nav className="dashboard-nav" aria-label="Navegação principal">
              <NavLink to="/app" end>Dashboard</NavLink>
              <NavLink to="/app/presets">Presets</NavLink>
              <NavLink to="/app/profile">Perfil</NavLink>
              <span className="dashboard-user-name">{professor?.name || professor?.email || 'Instrutor'}</span>
              <button type="button" onClick={logout}>Logout</button>
            </nav>
          ) : isAuthenticated && (
            <div className="topbar-account">
              <span>{professor?.name || professor?.email || 'Instrutor'}</span>
              <button type="button" onClick={logout}>Logout</button>
            </div>
          )}
        </div>
      </header>
      <main className="main-area">{children}</main>
    </div>
  );
}
