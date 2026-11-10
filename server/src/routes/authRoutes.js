const { Router } = require('express');

const ProfessorRepository = require('../repositories/ProfessorRepository');
const AuthService = require('../services/AuthService');
const AuthController = require('../controllers/AuthController');
const authenticate = require('../middlewares/authenticate');

const router = Router();
const repository = new ProfessorRepository();
const service = new AuthService(repository);
const controller = new AuthController(service);

router.post('/login', controller.login);
router.get('/me', authenticate, controller.me);

module.exports = router;
