import { useLocation } from 'react-router-dom';
import Logo from './Logo';
import { useAuth } from '../auth/AuthContext';

export default function Layout({ children }) {
  const { isAuthenticated, professor, logout } = useAuth();
  const { pathname } = useLocation();
  return <div className={`app-shell ${pathname === '/app' ? 'dashboard-shell' : ''}`}><header className="topbar"><div className="topbar-inner"><Logo size={43} />{isAuthenticated && <div className="topbar-account"><span>{professor?.name || professor?.email || 'Instrutor'}</span><button type="button" onClick={logout}>Logout</button></div>}</div></header><main className="main-area">{children}</main></div>;
}
