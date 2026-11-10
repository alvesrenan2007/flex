const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const config = require('../config');
const AppError = require('../errors/AppError');

function reply(socket, acknowledge, event, result) {
  if (typeof acknowledge === 'function') {
    acknowledge(result);
  } else {
    socket.emit(event, result);
  }
}

function socketFailure(err) {
  const codes = {
    400: 'INVALID_INPUT',
    401: 'UNAUTHORIZED',
    404: 'ROOM_NOT_FOUND',
    409: 'ROOM_FULL',
  };
  return {
    ok: false,
    error: {
      code: codes[err.statusCode] || 'ROOM_ERROR',
      message: err.message || 'Não foi possível concluir a operação',
    },
  };
}

function attachSocketHandlers(httpServer, roomManager, whitelistPresetService) {
  const io = new Server(httpServer, {
    cors: { origin: '*' },
    pingInterval: config.socket.pingInterval,
    pingTimeout: config.socket.pingTimeout,
  });

  io.use((socket, next) => {
    const handshakeToken = socket.handshake.auth && socket.handshake.auth.token;
    const authorization = socket.handshake.headers.authorization;
    const bearerMatch = typeof authorization === 'string'
      ? authorization.match(/^Bearer\s+(.+)$/i)
      : null;
    const token = handshakeToken || (bearerMatch ? bearerMatch[1] : undefined);

    if (token === undefined) return next();
    if (typeof token !== 'string' || !token) {
      return next(new Error('Token de autenticação inválido'));
    }

    try {
      const payload = jwt.verify(token, config.jwt.secret, {
        algorithms: ['HS256'],
      });
      if (payload.type === 'guest') {
        if (
          typeof payload.sub !== 'string'
          || !payload.sub.startsWith('guest:')
          || typeof payload.roomId !== 'string'
          || typeof payload.nickname !== 'string'
        ) {
          return next(new Error('Token de convidado inválido'));
        }

        socket.data.guest = {
          roomId: payload.roomId,
          nickname: payload.nickname,
        };
        return next();
      }

      const professorId = Number(payload.sub);
      if (!Number.isSafeInteger(professorId) || professorId <= 0) {
        return next(new Error('Token de autenticação inválido'));
      }

      socket.data.professorId = professorId;
      return next();
    } catch (err) {
      return next(new Error('Token de autenticação inválido ou expirado'));
    }
  });

  io.on('connection', (socket) => {
    if (socket.data.guest) {
      const { roomId, nickname } = socket.data.guest;
      (async () => {
        try {
          const joined = roomManager.join(roomId, socket.id, nickname);
          await socket.join(roomId);
          socket.to(roomId).emit('room:member-joined', {
            roomId,
            nickname: joined.participant.nickname,
            participantCount: joined.room.participantCount,
          });
          socket.emit('room:joined', {
            ok: true,
            room: joined.room,
            participant: joined.participant,
          });
        } catch (err) {
          roomManager.leave(roomId, socket.id);
          socket.emit('room:error', socketFailure(err));
          socket.disconnect(true);
        }
      })();
    }

    socket.on('room:create', async (payload, acknowledge) => {
      if (!socket.data.professorId) {
        return reply(socket, acknowledge, 'room:error', {
          ok: false,
          error: { code: 'UNAUTHORIZED', message: 'Apenas professores autenticados podem criar salas' },
        });
      }

      try {
        const presetId = payload && payload.presetId;
        if (presetId !== undefined && payload.whitelist !== undefined) {
          throw new AppError('Escolha um preset ou informe "whitelist", não ambos', 400);
        }

        let whitelist = payload && payload.whitelist;
        let presetName = null;
        if (presetId !== undefined) {
          const preset = await whitelistPresetService.getByIdForProfessor(
            presetId,
            socket.data.professorId,
          );
          whitelist = preset.urls;
          presetName = preset.name;
        }

        const room = roomManager.create({
          professorId: socket.data.professorId,
          name: payload && payload.name,
          capacity: payload && payload.capacity,
          whitelist: whitelist === undefined ? [] : whitelist,
          presetId: presetId === undefined ? null : Number(presetId),
          presetName,
        });
        try {
          await socket.join(room.id);
        } catch (err) {
          roomManager.removeIfEmpty(room.id, socket.data.professorId);
          console.error('Falha ao adicionar professor à sala:', err);
          return reply(socket, acknowledge, 'room:error', socketFailure(err));
        }
        return reply(socket, acknowledge, 'room:created', { ok: true, room });
      } catch (err) {
        return reply(socket, acknowledge, 'room:error', socketFailure(err));
      }
    });

    socket.on('room:join', async (payload, acknowledge) => {
      const roomId = payload && typeof payload.roomId === 'string' ? payload.roomId.trim() : '';
      const nickname = payload && payload.nickname;

      if (socket.data.guest && socket.data.guest.roomId !== roomId) {
        return reply(socket, acknowledge, 'room:error', {
          ok: false,
          error: { code: 'UNAUTHORIZED', message: 'Este token de convidado é válido apenas para a sala solicitada' },
        });
      }

      const alreadyJoined = roomManager.getParticipant(roomId, socket.id);
      let joined;
      try {
        joined = roomManager.join(roomId, socket.id, nickname);
      } catch (err) {
        return reply(socket, acknowledge, 'room:error', socketFailure(err));
      }

      try {
        await socket.join(roomId);
      } catch (err) {
        roomManager.leave(roomId, socket.id);
        console.error('Falha ao adicionar socket à sala:', err);
        return reply(socket, acknowledge, 'room:error', socketFailure(err));
      }

      if (!alreadyJoined) {
        socket.to(roomId).emit('room:member-joined', {
          roomId,
          nickname: joined.participant.nickname,
          participantCount: joined.room.participantCount,
        });
      }
      return reply(socket, acknowledge, 'room:joined', {
        ok: true,
        room: joined.room,
        participant: joined.participant,
      });
    });

    socket.on('room:leave', async (payload, acknowledge) => {
      const roomId = payload && typeof payload.roomId === 'string' ? payload.roomId.trim() : '';
      const participant = roomManager.getParticipant(roomId, socket.id);
      if (!participant) {
        return reply(socket, acknowledge, 'room:error', {
          ok: false,
          error: { code: 'NOT_IN_ROOM', message: 'Você não está nessa sala' },
        });
      }

      try {
        await socket.leave(roomId);
      } catch (err) {
        console.error('Falha ao sair da sala:', err);
        return reply(socket, acknowledge, 'room:error', socketFailure(err));
      }

      const departure = roomManager.leave(roomId, socket.id);
      if (!departure) {
        return reply(socket, acknowledge, 'room:error', {
          ok: false,
          error: { code: 'NOT_IN_ROOM', message: 'Você não está nessa sala' },
        });
      }

      io.to(roomId).emit('room:member-left', {
        roomId,
        nickname: departure.participant.nickname,
        participantCount: departure.room.participantCount,
      });
      return reply(socket, acknowledge, 'room:left', { ok: true, roomId });
    });

    socket.on('room:message', (payload, acknowledge) => {
      const roomId = payload && typeof payload.roomId === 'string' ? payload.roomId.trim() : '';
      const message = payload && typeof payload.message === 'string' ? payload.message.trim() : '';
      const participant = roomManager.getParticipant(roomId, socket.id);

      if (!participant) {
        return reply(socket, acknowledge, 'room:error', {
          ok: false,
          error: { code: 'NOT_IN_ROOM', message: 'Você precisa entrar na sala para enviar mensagens' },
        });
      }
      if (!message || message.length > 2000) {
        return reply(socket, acknowledge, 'room:error', {
          ok: false,
          error: { code: 'INVALID_MESSAGE', message: 'A mensagem deve ter entre 1 e 2000 caracteres' },
        });
      }

      io.to(roomId).emit('room:message', {
        roomId,
        nickname: participant.nickname,
        message,
        sentAt: new Date().toISOString(),
      });
      return reply(socket, acknowledge, 'room:message:sent', { ok: true });
    });

    socket.on('disconnecting', () => {
      for (const departure of roomManager.leaveAll(socket.id)) {
        socket.to(departure.roomId).emit('room:member-left', {
          roomId: departure.roomId,
          nickname: departure.participant.nickname,
          participantCount: departure.room.participantCount,
        });
      }
    });
  });

  return io;
}

module.exports = attachSocketHandlers;
