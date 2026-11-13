export const API_URL = (import.meta.env.VITE_API_URL || 'https://purge-uncolored-movie.ngrok-free.dev').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Centralize o acesso à API para facilitar as próximas funcionalidades. */
export async function request(path, { token, headers, ...options } = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        // Alguns túneis ngrok exibem aviso em requisições de navegador.
        'ngrok-skip-browser-warning': 'true',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor. Verifique a conexão e o endereço da API.', 0);
  }

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : null;

  if (!response.ok) {
    const fallback = {
      400: 'Verifique os dados informados.',
      401: 'E-mail ou senha incorretos, ou sua sessão expirou.',
      404: 'O recurso solicitado não foi encontrado.',
      409: 'Este e-mail já está cadastrado.',
      429: 'Muitas tentativas. Tente novamente mais tarde.',
    }[response.status] || 'Ocorreu um erro no servidor. Tente novamente.';
    throw new ApiError(data?.message || fallback, response.status);
  }
  return data;
}
