const AppError = require('../errors/AppError');

class ProfessorService {
  constructor(professorRepository) {
    this.professorRepository = professorRepository;
  }

  async list() {
    return this.professorRepository.findAll();
  }

  async getById(id) {
    const professor = await this.professorRepository.findById(id);
    if (!professor) throw new AppError('Professor não encontrado', 404);
    return professor;
  }

  async create({ name, password, email }) {
    if (!name || !password || !email) {
      throw new AppError('Campos "name", "password" e "email" são obrigatórios', 400);
    }

    const exists = await this.professorRepository.findByEmail(email);
    if (exists) throw new AppError('E-mail já cadastrado', 409);

    return this.professorRepository.create({ name, password, email });
  }

  async update(id, { name, password, email }) {
    if (password !== undefined && !password) {
      throw new AppError('A senha não pode ser vazia', 400);
    }

    if (email) {
      const other = await this.professorRepository.findByEmail(email);
      if (other && other.id !== Number(id)) {
        throw new AppError('E-mail já cadastrado', 409);
      }
    }

    const professor = await this.professorRepository.update(id, { name, password, email });
    if (!professor) throw new AppError('Professor não encontrado', 404);
    return professor;
  }

  async remove(id) {
    const removed = await this.professorRepository.delete(id);
    if (!removed) throw new AppError('Professor não encontrado', 404);
  }
}

module.exports = ProfessorService;
