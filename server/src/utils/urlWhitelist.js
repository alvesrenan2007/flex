const AppError = require('../errors/AppError');

function normalizeWhitelist(urls) {
  if (!Array.isArray(urls)) {
    throw new AppError('"urls" deve ser uma lista de URLs', 400);
  }
  if (urls.length > 100) {
    throw new AppError('A whitelist aceita no máximo 100 URLs', 400);
  }

  const normalized = urls.map((value) => {
    if (typeof value !== 'string' || !value.trim() || value.length > 2048) {
      throw new AppError('Cada URL da whitelist deve ser uma URL válida', 400);
    }

    let url;
    try {
      url = new URL(value.trim());
    } catch (err) {
      throw new AppError(`URL inválida na whitelist: ${value}`, 400);
    }

    if (
      !['http:', 'https:'].includes(url.protocol)
      || url.username
      || url.password
      || url.hash
    ) {
      throw new AppError('URLs devem usar HTTP/HTTPS sem credenciais ou fragmento', 400);
    }

    return url.href;
  });

  return [...new Set(normalized)];
}

module.exports = normalizeWhitelist;
