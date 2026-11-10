const jwt = require('jsonwebtoken');

const AppError = require('../errors/AppError');
const config = require('../config');

function authenticate(req, res, next) {
  const authorization = req.headers.authorization;
  const match = authorization && authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return next(new AppError('Token de autenticação não informado', 401));
  }

  try {
    const payload = jwt.verify(match[1], config.jwt.secret, {
      algorithms: ['HS256'],
    });

    const professorId = Number(payload.sub);
    if (!Number.isSafeInteger(professorId) || professorId <= 0) {
      throw new Error('Invalid token subject');
    }

    req.auth = { professorId };
    return next();
  } catch (err) {
    return next(new AppError('Token de autenticação inválido ou expirado', 401));
  }
}

module.exports = authenticate;
