const BaseRepository = require('./BaseRepository');
const WhitelistPreset = require('../models/WhitelistPreset');

class WhitelistPresetRepository extends BaseRepository {
  constructor() {
    super(WhitelistPreset);
  }

  async findByProfessor(professorId) {
    return this.model.findAll({
      where: { professorId },
      order: [['createdAt', 'DESC']],
    });
  }

  async findOwned(id, professorId) {
    return this.model.findOne({ where: { id, professorId } });
  }

  async updateOwned(id, professorId, data) {
    const preset = await this.findOwned(id, professorId);
    if (!preset) return null;
    return preset.update(data);
  }

  async deleteOwned(id, professorId) {
    const deleted = await this.model.destroy({ where: { id, professorId } });
    return deleted > 0;
  }
}

module.exports = WhitelistPresetRepository;
