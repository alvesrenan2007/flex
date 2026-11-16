import { request } from './http';

export const authApi = {
  register: ({ username, email, password }) =>
    request('/flex/professors/create', {
      method: 'POST',
      body: JSON.stringify({ name: username.trim(), email: email.trim(), password }),
    }),
  login: ({ email, password }) =>
    request('/flex/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), password }),
    }),
  me: (token) => request('/flex/auth/me', { token }),
};
