// Repositório genérico sobre um model do Sequelize.
class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  async findAll(options = {}) {
    return this.model.findAll(options);
  }

  async findById(id) {
    return this.model.findByPk(id);
  }

  async create(data) {
    return this.model.create(data);
  }

  async update(id, data) {
    const item = await this.findById(id);
    if (!item) return null;
    return item.update(data);
  }

  async delete(id) {
    const deleted = await this.model.destroy({ where: { id } });
    return deleted > 0;
  }
}

module.exports = BaseRepository;
