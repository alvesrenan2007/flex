import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import Logo from '../components/Logo';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/app" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate(location.state?.from?.pathname || '/app', { replace: true });
    } catch (err) {
      setError(err.message || 'Não foi possível entrar.');
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="auth-card login-card" aria-labelledby="login-title">
    <div className="login-brand"><Logo size={48} /><p>Flexible Learning Endpoint X-filter</p></div>
    <h1 className="sr-only" id="login-title">Login</h1>
    <form onSubmit={handleSubmit}>
      <label htmlFor="login-email">Email</label>
      <input id="login-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
      <label htmlFor="login-password">Password</label>
      <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
      {location.state?.registered && <p className="notice success" role="status">Cadastro realizado! Entre com seu e-mail e senha.</p>}
      {error && <p className="notice error" role="alert">{error}</p>}
      <button className="primary-button login-button" disabled={submitting} type="submit">{submitting ? 'Entrando...' : 'Login'}</button>
    </form>
    <p className="auth-footer">Ainda não tem conta? <Link to="/register">Registre aqui</Link></p>
  </section>;
}
