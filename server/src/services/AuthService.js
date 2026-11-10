const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const AppError = require('../errors/AppError');
const config = require('../config');

class AuthService {
  constructor(professorRepository) {
    this.professorRepository = professorRepository;
  }

  async login(credentials = {}) {
    const { email, password } = credentials || {};

    if (!email || !password) {
      throw new AppError('E-mail e senha são obrigatórios', 400);
    }

    const professor = await this.professorRepository.findForAuthentication(email);
    const passwordMatches = professor && await bcrypt.compare(password, professor.password);
    if (!passwordMatches) {
      throw new AppError('E-mail ou senha inválidos', 401);
    }

    const token = jwt.sign({}, config.jwt.secret, {
      subject: String(professor.id),
      expiresIn: config.jwt.expiresIn,
      algorithm: 'HS256',
    });

    return { token, professor };
  }

  async getProfile(id) {
    const professor = await this.professorRepository.findById(id);
    if (!professor) throw new AppError('Professor não encontrado', 404);
    return professor;
  }
}

module.exports = AuthService;
