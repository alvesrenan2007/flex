const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { io: createClient } = require('socket.io-client');
const AppError = require('../src/errors/AppError');

process.env.JWT_SECRET = 'socket-test-secret';
process.env.SOCKET_PING_INTERVAL_MS = '100';
process.env.SOCKET_PING_TIMEOUT_MS = '300';

const App = require('../src/app');

let app;
let baseUrl;
let firstTeacherToken;
let secondTeacherToken;
let presetId = 1;
const presets = new Map();

const whitelistPresetService = {
  async list(professorId) {
    return [...presets.values()].filter((preset) => preset.professorId === professorId);
  },
  async create(professorId, input) {
    const preset = { id: presetId++, professorId, ...input };
    presets.set(preset.id, preset);
    return preset;
  },
  async getByIdForProfessor(id, professorId) {
    const preset = presets.get(Number(id));
    if (!preset || preset.professorId !== professorId) {
      throw new AppError('Preset não encontrado', 404);
    }
    return preset;
  },
  async update(id, professorId, input) {
    const preset = await this.getByIdForProfessor(id, professorId);
    Object.assign(preset, input);
    return preset;
  },
  async remove(id, professorId) {
    await this.getByIdForProfessor(id, professorId);
    presets.delete(Number(id));
  },
};

function connect(token) {
  return new Promise((resolve, reject) => {
    const options = { reconnection: false, timeout: 1000 };
    if (token) options.auth = { token };
    const socket = createClient(baseUrl, options);
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function acknowledge(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(1000).emit(event, payload, (err, response) => {
      if (err) return reject(err);
      return resolve(response);
    });
  });
}

async function requestGuestAccess(roomId, nickname) {
  const response = await fetch(`${baseUrl}/flex/rooms/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ roomId, nickname }),
  });
  return { response, body: await response.json() };
}

async function connectGuest(roomId, nickname) {
  const access = await requestGuestAccess(roomId, nickname);
  if (!access.response.ok) return access;

  const socket = createClient(baseUrl, {
    extraHeaders: { authorization: `Bearer ${access.body.token}` },
    reconnection: false,
    timeout: 1000,
  });
  const joined = new Promise((resolve, reject) => {
    socket.once('room:joined', resolve);
    socket.once('room:error', (result) => reject(new Error(result.error.message)));
    socket.once('connect_error', reject);
  });
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });

  return { response: access.response, body: access.body, socket, joined: await joined };
}

before(async () => {
  presets.clear();
  presetId = 1;
  firstTeacherToken = jwt.sign({}, process.env.JWT_SECRET, { subject: '1' });
  secondTeacherToken = jwt.sign({}, process.env.JWT_SECRET, { subject: '2' });
  app = new App({ whitelistPresetService });
  app.server.listen(0);
  await new Promise((resolve) => app.server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${app.server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => app.io.close(resolve));
});

test('allows guests without a token but requires a teacher token to create rooms', async () => {
  const teacher = await connect(firstTeacherToken);
  const guest = await connect();

  try {
    const denied = await acknowledge(guest, 'room:create', { name: 'Sala', capacity: 4 });
    assert.equal(denied.error.code, 'UNAUTHORIZED');

    const created = await acknowledge(teacher, 'room:create', { name: 'Sala direta', capacity: 4 });
    assert.match(created.room.id, /^[A-Z0-9]{5}$/);
    const memberJoined = new Promise((resolve) => teacher.once('room:member-joined', resolve));
    const joined = await acknowledge(guest, 'room:join', {
      roomId: created.room.id,
      nickname: 'Convidado direto',
    });
    assert.equal(joined.ok, true);
    assert.equal(joined.participant.nickname, 'Convidado direto');
    assert.equal((await memberJoined).participantCount, 1);
  } finally {
    guest.disconnect();
    teacher.disconnect();
  }
});

test('creates a capacity-limited room and exposes participants only to its teacher', async () => {
  const teacher = await connect(firstTeacherToken);
  const otherTeacher = await connect(secondTeacherToken);
  let guestOne;
  let guestTwo;

  try {
    const created = await acknowledge(teacher, 'room:create', {
      name: '  Aula pública  ',
      capacity: 1,
      whitelist: ['example.com', 'example.org'],
    });
    assert.equal(created.ok, true);
    assert.equal(created.room.name, 'Aula pública');
    assert.equal(created.room.capacity, 1);
    assert.equal(created.room.participantCount, 0);
    assert.deepEqual(created.room.whitelist, [
      'example.com',
      'example.org',
    ]);

    const memberJoined = new Promise((resolve) => teacher.once('room:member-joined', resolve));
    guestOne = await connectGuest(created.room.id, '  Ana  ');
    assert.equal(guestOne.response.status, 200);
    assert.equal(guestOne.joined.ok, true);
    assert.equal(guestOne.joined.participant.nickname, 'Ana');
    assert.deepEqual(guestOne.joined.room.whitelist, created.room.whitelist);
    assert.equal((await memberJoined).participantCount, 1);

    const full = await requestGuestAccess(created.room.id, 'Bia');
    assert.equal(full.response.status, 409);

    const response = await fetch(`${baseUrl}/flex/rooms/${created.room.id}/participants`, {
      headers: { authorization: `Bearer ${firstTeacherToken}` },
    });
    assert.equal(response.status, 200);
    const participants = await response.json();
    assert.equal(participants.capacity, 1);
    assert.equal(participants.participantCount, 1);
    assert.deepEqual(participants.whitelist, created.room.whitelist);
    assert.equal(participants.participants[0].nickname, 'Ana');
    assert.ok(participants.participants[0].connectedAt);

    const forbiddenResponse = await fetch(`${baseUrl}/flex/rooms/${created.room.id}/participants`, {
      headers: { authorization: `Bearer ${secondTeacherToken}` },
    });
    assert.equal(forbiddenResponse.status, 404);

    const unauthenticatedResponse = await fetch(`${baseUrl}/flex/rooms/${created.room.id}/participants`);
    assert.equal(unauthenticatedResponse.status, 401);

    const left = new Promise((resolve) => teacher.once('room:member-left', resolve));
    guestOne.socket.disconnect();
    assert.equal((await left).participantCount, 0);

    const emptyRoomResponse = await fetch(`${baseUrl}/flex/rooms/${created.room.id}/participants`, {
      headers: { authorization: `Bearer ${firstTeacherToken}` },
    });
    assert.equal((await emptyRoomResponse.json()).participantCount, 0);

    const teacherRoomsResponse = await fetch(`${baseUrl}/flex/rooms`, {
      headers: { authorization: `Bearer ${firstTeacherToken}` },
    });
    const teacherRooms = await teacherRoomsResponse.json();
    assert.ok(teacherRooms.rooms.some((room) => room.id === created.room.id));

    const otherTeacherRoomsResponse = await fetch(`${baseUrl}/flex/rooms`, {
      headers: { authorization: `Bearer ${secondTeacherToken}` },
    });
    assert.deepEqual((await otherTeacherRoomsResponse.json()).rooms, []);

    guestTwo = await connectGuest(created.room.id, 'Bia');
    assert.equal(guestTwo.joined.ok, true);
    assert.equal(app.io.engine.opts.pingInterval, 100);
    assert.equal(app.io.engine.opts.pingTimeout, 300);
  } finally {
    teacher.disconnect();
    if (guestOne) guestOne.socket.disconnect();
    if (guestTwo) guestTwo.socket.disconnect();
    otherTeacher.disconnect();
  }
});

test('validates room capacity and guest nickname', async () => {
  const teacher = await connect(firstTeacherToken);
  let guest;

  try {
    const invalidCapacity = await acknowledge(teacher, 'room:create', { name: 'Sala', capacity: 0 });
    assert.equal(invalidCapacity.error.code, 'INVALID_INPUT');

    const created = await acknowledge(teacher, 'room:create', { name: 'Sala', capacity: 2 });
    const invalidNickname = await requestGuestAccess(created.room.id, '   ');
    assert.equal(invalidNickname.response.status, 400);
    guest = await connectGuest(created.room.id, 'Ana');
    const received = new Promise((resolve) => teacher.once('room:message', resolve));
    assert.equal((await acknowledge(guest.socket, 'room:message', {
      roomId: created.room.id,
      message: 'Olá, professora!',
    })).ok, true);
    const message = await received;
    assert.equal(message.nickname, 'Ana');
    assert.equal(message.message, 'Olá, professora!');
  } finally {
    teacher.disconnect();
    if (guest) guest.socket.disconnect();
  }
});

test('allows multiple student connections from the same IP in a room', async () => {
  const teacher = await connect(firstTeacherToken);
  const firstStudent = await connect();
  const secondStudent = await connect();

  try {
    const firstRoom = await acknowledge(teacher, 'room:create', {
      name: 'Primeira sala',
      capacity: 3,
    });
    const secondRoom = await acknowledge(teacher, 'room:create', {
      name: 'Segunda sala',
      capacity: 3,
    });

    assert.equal((await acknowledge(firstStudent, 'room:join', {
      roomId: firstRoom.room.id,
      nickname: 'Ana',
    })).ok, true);

    const sameRoom = await acknowledge(secondStudent, 'room:join', {
      roomId: firstRoom.room.id,
      nickname: 'Bia',
    });
    assert.equal(sameRoom.ok, true);

    const otherRoom = await acknowledge(secondStudent, 'room:join', {
      roomId: secondRoom.room.id,
      nickname: 'Bia',
    });
    assert.equal(otherRoom.ok, true);
  } finally {
    teacher.disconnect();
    firstStudent.disconnect();
    secondStudent.disconnect();
  }
});

test('allows the room teacher to update the whitelist in real time', async () => {
  const teacher = await connect(firstTeacherToken);
  const otherTeacher = await connect(secondTeacherToken);
  let guest;

  try {
    const created = await acknowledge(teacher, 'room:create', {
      name: 'Sala com whitelist dinâmica',
      capacity: 5,
      whitelist: ['example.com'],
    });
    guest = await connectGuest(created.room.id, 'Ana');

    const denied = await acknowledge(otherTeacher, 'room:whitelist:update', {
      roomId: created.room.id,
      whitelist: ['example.org'],
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.error.code, 'ROOM_NOT_FOUND');

    const invalid = await acknowledge(teacher, 'room:whitelist:update', {
      roomId: created.room.id,
      whitelist: ['javascript:alert(1)'],
    });
    assert.equal(invalid.ok, false);
    assert.equal(invalid.error.code, 'INVALID_INPUT');

    const updateReceived = new Promise((resolve) => {
      guest.socket.once('room:whitelist:updated', resolve);
    });
    const updated = await acknowledge(teacher, 'room:whitelist:update', {
      roomId: created.room.id,
      whitelist: ['example.net'],
    });
    assert.equal(updated.ok, true);
    assert.deepEqual(updated.room.whitelist, ['example.net']);
    assert.deepEqual(await updateReceived, {
      roomId: created.room.id,
      whitelist: ['example.net'],
    });

    const participantsResponse = await fetch(
      `${baseUrl}/flex/rooms/${created.room.id}/participants`,
      { headers: { authorization: `Bearer ${firstTeacherToken}` } },
    );
    assert.deepEqual((await participantsResponse.json()).whitelist, ['example.net']);
  } finally {
    teacher.disconnect();
    otherTeacher.disconnect();
    if (guest) guest.socket.disconnect();
  }
});

test('creates and manages teacher whitelist presets and applies a selected preset to a room', async () => {
  const teacher = await connect(firstTeacherToken);
  const otherTeacher = await connect(secondTeacherToken);

  try {
    const createdPresetResponse = await fetch(`${baseUrl}/flex/rooms/presets`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${firstTeacherToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Sites da aula',
        urls: ['example.com', 'example.org'],
      }),
    });
    assert.equal(createdPresetResponse.status, 201);
    const preset = await createdPresetResponse.json();
    const originalUrls = [...preset.urls];

    const presetsResponse = await fetch(`${baseUrl}/flex/rooms/presets`, {
      headers: { authorization: `Bearer ${firstTeacherToken}` },
    });
    assert.equal((await presetsResponse.json()).presets.length, 1);

    const notOwned = await acknowledge(otherTeacher, 'room:create', {
      name: 'Sala de outro professor',
      capacity: 10,
      presetId: preset.id,
    });
    assert.equal(notOwned.error.code, 'ROOM_NOT_FOUND');

    const created = await acknowledge(teacher, 'room:create', {
      name: 'Sala com preset',
      capacity: 10,
      presetId: preset.id,
    });
    assert.equal(created.ok, true);
    assert.equal(created.room.presetId, preset.id);
    assert.equal(created.room.presetName, 'Sites da aula');
    assert.deepEqual(created.room.whitelist, originalUrls);

    const updatedResponse = await fetch(`${baseUrl}/flex/rooms/presets/${preset.id}`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${firstTeacherToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Sites atualizados', urls: ['example.net'] }),
    });
    assert.equal(updatedResponse.status, 200);
    assert.equal((await updatedResponse.json()).name, 'Sites atualizados');

    const appliedPreset = await acknowledge(teacher, 'room:whitelist:update', {
      roomId: created.room.id,
      presetId: preset.id,
    });
    assert.equal(appliedPreset.ok, true);
    assert.deepEqual(appliedPreset.room.whitelist, ['example.net']);
    assert.equal(appliedPreset.room.presetId, preset.id);
    assert.equal(appliedPreset.room.presetName, 'Sites atualizados');

    const presetNotOwned = await acknowledge(otherTeacher, 'room:whitelist:update', {
      roomId: created.room.id,
      presetId: preset.id,
    });
    assert.equal(presetNotOwned.ok, false);
    assert.equal(presetNotOwned.error.code, 'ROOM_NOT_FOUND');

    const deletedResponse = await fetch(`${baseUrl}/flex/rooms/presets/${preset.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${firstTeacherToken}` },
    });
    assert.equal(deletedResponse.status, 204);
    assert.deepEqual(created.room.whitelist, originalUrls);
  } finally {
    teacher.disconnect();
    otherTeacher.disconnect();
  }
});
