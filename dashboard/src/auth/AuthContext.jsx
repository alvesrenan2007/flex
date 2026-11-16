import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/auth';

const TOKEN_KEY = 'flex_professor_token';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY));
  const [professor, setProfessor] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setProfessor(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!token) return null;
    const profile = await authApi.me(token);
    const currentProfessor = profile?.professor ?? profile;
    setProfessor(currentProfessor);
    return currentProfessor;
  }, [token]);

  useEffect(() => {
    let active = true;
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    authApi.me(token).then((profile) => {
      if (active) setProfessor(profile?.professor ?? profile);
    }).catch((error) => {
      if (active) {
        // Somente credenciais inválidas encerram a sessão; erros de rede não apagam o token.
        if (error.status === 401) logout();
        else setProfessor(null);
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [token, logout, refreshProfile]);

  const login = useCallback(async (credentials) => {
    const data = await authApi.login(credentials);
    if (!data?.token) throw new Error('O servidor não retornou um token de autenticação.');
    sessionStorage.setItem(TOKEN_KEY, data.token);
    setProfessor(data.professor);
    setToken(data.token);
    return data;
  }, []);

  const value = useMemo(() => ({ token, professor, loading, login, logout, refreshProfile, isAuthenticated: Boolean(token) }), [token, professor, loading, login, logout, refreshProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return context;
}
