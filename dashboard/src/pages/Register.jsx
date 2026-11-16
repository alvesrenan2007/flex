import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { authApi } from '../api/auth';

export default function Register() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  if (isAuthenticated) return <Navigate to="/app" replace />;

  function update(key, value) { setForm(previous => ({ ...previous, [key]: value })); }
  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setError('');
    if (!form.username.trim()) { setError('Informe o nome de usuário.'); return; }
    if (form.password !== form.confirmPassword) { setError('As senhas não coincidem.'); return; }
    setSubmitting(true);
    try {
      await authApi.register(form);
      navigate('/login', { replace: true, state: { registered: true, email: form.email.trim() } });
    } catch (err) {
      setError(err.message || 'Não foi possível criar a conta.');
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="auth-card register-card" aria-labelledby="register-title">
    <h1 id="register-title">Register</h1>
    <p className="register-subtitle">Crie sua conta de instrutor</p>
    <form onSubmit={handleSubmit}>
      <label htmlFor="register-username">Username</label>
      <input id="register-username" type="text" autoComplete="name" maxLength={100} value={form.username} onChange={e => update('username', e.target.value)} required autoFocus />
      <label htmlFor="register-email">Email</label>
      <input id="register-email" type="email" autoComplete="email" value={form.email} onChange={e => update('email', e.target.value)} required />
      <label htmlFor="register-password">Password</label>
      <input id="register-password" type="password" autoComplete="new-password" value={form.password} onChange={e => update('password', e.target.value)} required />
      <label htmlFor="register-confirm-password">Confirm Password</label>
      <input id="register-confirm-password" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} required />
      {error && <p className="notice error" role="alert">{error}</p>}
      <button className="primary-button register-button" type="submit" disabled={submitting}>{submitting ? 'Registrando...' : 'Registrar'}</button>
    </form>
    <p className="auth-footer">Já tem conta? <Link to="/login">Login</Link></p>
  </section>;
}
