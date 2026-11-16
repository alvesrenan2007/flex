import { io } from 'socket.io-client';
import { API_URL, request } from './http';

export const roomsApi = {
  list: (token) => request('/flex/rooms', { token }),
  participants: (roomId, token) =>
    request(`/flex/rooms/${encodeURIComponent(roomId)}/participants`, { token }),
  listPresets: (token) => request('/flex/rooms/presets', { token }),
  createPreset: (preset, token) =>
    request('/flex/rooms/presets', {
      method: 'POST',
      token,
      body: JSON.stringify(preset),
    }),
  updatePreset: (presetId, fields, token) =>
    request(`/flex/rooms/presets/${encodeURIComponent(presetId)}`, {
      method: 'PUT',
      token,
      body: JSON.stringify(fields),
    }),
  removePreset: (presetId, token) =>
    request(`/flex/rooms/presets/${encodeURIComponent(presetId)}`, {
      method: 'DELETE',
      token,
    }),
};

function emitTeacherEvent(token, event, payload) {
  return new Promise((resolve, reject) => {
    const socket = io(API_URL, {
      auth: { token },
      extraHeaders: { 'ngrok-skip-browser-warning': 'true' },
      autoConnect: false,
      reconnection: false,
      timeout: 10000,
    });
    const cleanup = () => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      socket.disconnect();
    };
    const onConnectError = (error) => {
      cleanup();
      reject(error);
    };
    const onConnect = () => {
      socket.timeout(10000).emit(event, payload, (timeoutError, result) => {
        cleanup();
        if (timeoutError) {
          reject(new Error('A API não respondeu à solicitação da sala.'));
        } else if (!result?.ok) {
          const message = typeof result?.error === 'string'
            ? result.error
            : result?.error?.message || result?.message;
          reject(new Error(message || 'Não foi possível concluir a operação da sala.'));
        } else {
          resolve(result);
        }
      });
    };
    socket.once('connect', onConnect);
    socket.once('connect_error', onConnectError);
    socket.connect();
  });
}

export const teacherRoomSocket = {
  create: (payload, token) => emitTeacherEvent(token, 'room:create', payload),
  updateWhitelist: (payload, token) => emitTeacherEvent(token, 'room:whitelist:update', payload),
  close: (payload, token) => emitTeacherEvent(token, 'room:close', payload),
};
