const BaseRepository = require('./BaseRepository');
const Professor = require('../models/Professor');
const bcrypt = require('bcrypt');

class ProfessorRepository extends BaseRepository {
  constructor() {
    super(Professor);
  }

  async create(data) {
    const password = await bcrypt.hash(data.password, 10);
    return super.create({ ...data, password });
  }

  async update(id, data) {
    const updates = { ...data };
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    return super.update(id, updates);
  }

  async findByEmail(email) {
    return this.model.findOne({ where: { email } });
  }

  async findForAuthentication(email) {
    return this.model.unscoped().findOne({ where: { email } });
  }
}

module.exports = ProfessorRepository;
