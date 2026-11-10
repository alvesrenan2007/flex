class ProfessorController {
  constructor(professorService) {
    this.professorService = professorService;
  }

  index = async (req, res, next) => {
    try {
      const professors = await this.professorService.list();
      res.json(professors);
    } catch (err) {
      next(err);
    }
  };

  show = async (req, res, next) => {
    try {
      const professor = await this.professorService.getById(req.params.id);
      res.json(professor);
    } catch (err) {
      next(err);
    }
  };

  store = async (req, res, next) => {
    try {
      const professor = await this.professorService.create(req.body);
      res.status(201).json(professor);
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const professor = await this.professorService.update(req.params.id, req.body);
      res.json(professor);
    } catch (err) {
      next(err);
    }
  };

  destroy = async (req, res, next) => {
    try {
      await this.professorService.remove(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = ProfessorController;
