import { request } from './http';

export const professorsApi = {
  update: (id, fields, token) =>
    request(`/flex/professors/${encodeURIComponent(id)}`, {
      method: 'PUT',
      token,
      body: JSON.stringify(fields),
    }),
  remove: (id, token) =>
    request(`/flex/professors/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      token,
    }),
};
