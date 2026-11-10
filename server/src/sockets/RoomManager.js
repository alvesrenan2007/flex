const { randomBytes } = require('crypto');

const AppError = require('../errors/AppError');
const normalizeWhitelist = require('../utils/urlWhitelist');

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  create({ professorId, name, capacity, whitelist = [], presetId = null, presetName = null }) {
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    if (!normalizedName || normalizedName.length > 80) {
      throw new AppError('O nome da sala deve ter entre 1 e 80 caracteres', 400);
    }
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      throw new AppError('A capacidade deve ser um número inteiro maior que zero', 400);
    }
    const normalizedWhitelist = normalizeWhitelist(whitelist);

    let id;
    do {
      id = randomBytes(8).toString('hex');
    } while (this.rooms.has(id));

    const room = {
      id,
      professorId,
      name: normalizedName,
      capacity,
      whitelist: normalizedWhitelist,
      presetId,
      presetName,
      createdAt: new Date().toISOString(),
      participants: new Map(),
    };
    this.rooms.set(id, room);
    return this.toJSON(room);
  }

  removeIfEmpty(roomId, professorId) {
    const room = this.rooms.get(roomId);
    if (room && room.professorId === professorId && room.participants.size === 0) {
      this.rooms.delete(roomId);
    }
  }

  join(roomId, socketId, nickname) {
    const room = this.rooms.get(roomId);
    if (!room) throw new AppError('Sala não encontrada', 404);

    const existing = room.participants.get(socketId);
    if (existing) return { room: this.toJSON(room), participant: { ...existing } };

    const normalizedNickname = this.validateGuestJoin(roomId, nickname).nickname;

    const participant = {
      nickname: normalizedNickname,
      connectedAt: new Date().toISOString(),
    };
    room.participants.set(socketId, participant);
    return { room: this.toJSON(room), participant: { ...participant } };
  }

  validateGuestJoin(roomId, nickname) {
    const room = this.rooms.get(roomId);
    if (!room) throw new AppError('Sala não encontrada', 404);

    const normalizedNickname = typeof nickname === 'string' ? nickname.trim() : '';
    if (!normalizedNickname || normalizedNickname.length > 40) {
      throw new AppError('O nickname deve ter entre 1 e 40 caracteres', 400);
    }
    if (room.participants.size >= room.capacity) {
      throw new AppError('A sala está cheia', 409);
    }

    return {
      room: this.toJSON(room),
      nickname: normalizedNickname,
    };
  }

  leave(roomId, socketId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const participant = room.participants.get(socketId);
    if (!participant) return null;

    room.participants.delete(socketId);
    return { room: this.toJSON(room), participant: { ...participant } };
  }

  leaveAll(socketId) {
    const departures = [];
    for (const room of this.rooms.values()) {
      const departure = this.leave(room.id, socketId);
      if (departure) departures.push({ roomId: room.id, ...departure });
    }
    return departures;
  }

  getParticipant(roomId, socketId) {
    const room = this.rooms.get(roomId);
    return room ? room.participants.get(socketId) : null;
  }

  getParticipants(roomId, professorId) {
    const room = this.rooms.get(roomId);
    if (!room || room.professorId !== professorId) {
      throw new AppError('Sala não encontrada', 404);
    }

    return {
      ...this.toJSON(room),
      participants: Array.from(room.participants.values(), (participant) => ({ ...participant })),
    };
  }

  listByProfessor(professorId) {
    return Array.from(this.rooms.values())
      .filter((room) => room.professorId === professorId)
      .map((room) => this.toJSON(room));
  }

  toJSON(room) {
    return {
      id: room.id,
      name: room.name,
      capacity: room.capacity,
      participantCount: room.participants.size,
      whitelist: [...room.whitelist],
      presetId: room.presetId,
      presetName: room.presetName,
      createdAt: room.createdAt,
    };
  }
}

module.exports = RoomManager;
