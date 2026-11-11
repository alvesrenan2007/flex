const AppError = require('../errors/AppError');
const { isIP } = require('node:net');
const { domainToASCII } = require('node:url');

function normalizeWhitelist(urls) {
  if (!Array.isArray(urls)) {
    throw new AppError('"urls" deve ser uma lista de domínios', 400);
  }
  if (urls.length > 100) {
    throw new AppError('A whitelist aceita no máximo 100 domínios', 400);
  }

  const normalized = urls.map((value) => {
    if (typeof value !== 'string' || !value.trim() || value.length > 253) {
      throw new AppError('Cada item da whitelist deve ser um domínio válido', 400);
    }

    const trimmed = value.trim();
    if (/[/:?#@\\\s]/.test(trimmed)) {
      throw new AppError(`Domínio inválido na whitelist: ${value}`, 400);
    }

    const domain = domainToASCII(trimmed);
    const labels = domain.split('.');
    if (
      !domain
      || domain.length > 253
      || labels.length < 2
      || isIP(domain)
      || labels.some((label) => (
        label.length < 1
        || label.length > 63
        || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)
      ))
    ) {
      throw new AppError(`Domínio inválido na whitelist: ${value}`, 400);
    }

    return domain.toLowerCase();
  });

  return [...new Set(normalized)];
}

module.exports = normalizeWhitelist;
