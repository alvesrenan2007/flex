const AppError = require('../errors/AppError');
const normalizeWhitelist = require('../utils/urlWhitelist');

class WhitelistPresetService {
  constructor(repository) {
    this.repository = repository;
  }

  async list(professorId) {
    return this.repository.findByProfessor(professorId);
  }

  async getByIdForProfessor(id, professorId) {
    if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) {
      throw new AppError('Preset não encontrado', 404);
    }

    const preset = await this.repository.findOwned(Number(id), professorId);
    if (!preset) throw new AppError('Preset não encontrado', 404);
    return preset;
  }

  async create(professorId, input = {}) {
    this.validateInput(input);
    const name = this.validateName(input.name);
    const urls = normalizeWhitelist(input.urls);
    return this.repository.create({ professorId, name, urls });
  }

  async update(id, professorId, input = {}) {
    this.validateInput(input);
    const updates = {};
    if (Object.hasOwn(input, 'name')) updates.name = this.validateName(input.name);
    if (Object.hasOwn(input, 'urls')) updates.urls = normalizeWhitelist(input.urls);
    if (Object.keys(updates).length === 0) {
      throw new AppError('Informe "name" e/ou "urls" para atualizar o preset', 400);
    }

    const preset = await this.repository.updateOwned(id, professorId, updates);
    if (!preset) throw new AppError('Preset não encontrado', 404);
    return preset;
  }

  async remove(id, professorId) {
    const removed = await this.repository.deleteOwned(id, professorId);
    if (!removed) throw new AppError('Preset não encontrado', 404);
  }

  validateName(name) {
    const normalized = typeof name === 'string' ? name.trim() : '';
    if (!normalized || normalized.length > 80) {
      throw new AppError('O nome do preset deve ter entre 1 e 80 caracteres', 400);
    }
    return normalized;
  }

  validateInput(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new AppError('O corpo da requisição deve ser um objeto JSON', 400);
    }
  }
}

module.exports = WhitelistPresetService;
