const AppError = require('../errors/AppError');

function notFound(req, res, next) {
  next(new AppError(`Rota não encontrada: ${req.method} ${req.originalUrl}`, 404));
}

module.exports = notFound;
