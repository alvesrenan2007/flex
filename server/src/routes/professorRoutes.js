const { Router } = require('express');

const ProfessorRepository = require('../repositories/ProfessorRepository');
const ProfessorService = require('../services/ProfessorService');
const ProfessorController = require('../controllers/ProfessorController');
const authenticate = require('../middlewares/authenticate');

class ProfessorRoutes {
  constructor() {
    this.router = Router();

    // Injeção de dependências manual: repository -> service -> controller
    const repository = new ProfessorRepository();
    const service = new ProfessorService(repository);
    this.controller = new ProfessorController(service);

    this.setup();
  }

  setup() {
    this.router.get('/', authenticate, this.controller.index);
    this.router.post('/create', this.controller.store);
    this.router.get('/:id', authenticate, this.controller.show);
    this.router.put('/:id', authenticate, this.controller.update);
    this.router.delete('/:id', authenticate, this.controller.destroy);
  }
}

module.exports = new ProfessorRoutes().router;
