const config = require('../config');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message;

  // Erros de validação/unicidade do Sequelize viram 400
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 400;
    message = err.errors.map((e) => e.message).join('; ');
  }

  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    status: 'error',
    message: statusCode >= 500 && config.env === 'production'
      ? 'Erro interno do servidor'
      : message,
    ...(config.env === 'development' && { stack: err.stack }),
  });
}

module.exports = errorHandler;
