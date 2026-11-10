class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  login = async (req, res, next) => {
    try {
      const result = await this.authService.login(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  me = async (req, res, next) => {
    try {
      const professor = await this.authService.getProfile(req.auth.professorId);
      res.json(professor);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = AuthController;
