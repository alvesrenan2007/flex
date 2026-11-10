const { test } = require('node:test');
const assert = require('node:assert/strict');

const AppError = require('../src/errors/AppError');
const WhitelistPresetService = require('../src/services/WhitelistPresetService');

function createRepository() {
  const records = new Map();
  let nextId = 1;

  return {
    async findByProfessor(professorId) {
      return [...records.values()].filter((preset) => preset.professorId === professorId);
    },
    async findOwned(id, professorId) {
      const preset = records.get(id);
      return preset && preset.professorId === professorId ? preset : null;
    },
    async create(data) {
      const preset = { id: nextId++, ...data };
      records.set(preset.id, preset);
      return preset;
    },
    async updateOwned(id, professorId, data) {
      const preset = await this.findOwned(id, professorId);
      if (!preset) return null;
      Object.assign(preset, data);
      return preset;
    },
    async deleteOwned(id, professorId) {
      if (!(await this.findOwned(id, professorId))) return false;
      return records.delete(id);
    },
  };
}

test('validates, normalizes and scopes presets to the creating professor', async () => {
  const service = new WhitelistPresetService(createRepository());
  const preset = await service.create(7, {
    name: '  Aula  ',
    urls: ['https://example.com', 'https://example.com/'],
  });

  assert.equal(preset.name, 'Aula');
  assert.deepEqual(preset.urls, ['https://example.com/']);
  assert.equal((await service.list(7)).length, 1);
  assert.equal((await service.list(8)).length, 0);
  await assert.rejects(() => service.getByIdForProfessor(preset.id, 8), (err) => err.statusCode === 404);

  const updated = await service.update(preset.id, 7, {
    urls: ['https://example.org/material'],
  });
  assert.deepEqual(updated.urls, ['https://example.org/material']);
  await service.remove(preset.id, 7);
  assert.deepEqual(await service.list(7), []);
});

test('rejects non-http URLs, credentials, fragments and malformed whitelist data', async () => {
  const service = new WhitelistPresetService(createRepository());

  for (const urls of [
    ['javascript:alert(1)'],
    ['https://user:pass@example.com/'],
    ['https://example.com/#fragment'],
    'https://example.com/',
  ]) {
    await assert.rejects(
      () => service.create(7, { name: 'Invalid', urls }),
      (err) => err instanceof AppError && err.statusCode === 400,
    );
  }
});
