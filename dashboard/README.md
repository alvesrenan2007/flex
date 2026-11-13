# FLEX — Front-end do professor

Painel web React + Vite para professores, integrado à API em `../server`.

## Rodar localmente

Requisitos: Node.js 20.19+ ou 22.12+ e npm.

```bash
npm install
npm run dev
```

Acesse http://localhost:8080.

Para produção:

```bash
npm run build
npm run preview
```

## Configuração

Copie `.env.example` para `.env` e ajuste a URL da API quando necessário:

```env
VITE_API_URL=http://localhost:3000
```

A API deve estar ativa e permitir requisições CORS da origem do dashboard. Consulte o contrato em [`../server/docs/API.md`](../server/docs/API.md).

## Integração com API.md

- Cadastro: `POST /flex/professors/create` com `{ name, email, password }` (a entrada **Username** da tela vira `name` na API).
- Login: `POST /flex/auth/login` com `{ email, password }`. **A API não aceita username no login**: o campo da imagem foi adaptado para **Email**.
- Sessão: o token JWT retornado no login é guardado em `sessionStorage` e enviado no cabeçalho `Authorization: Bearer ...`.
- Verificação: `GET /flex/auth/me` ao carregar uma sessão existente.
- Logout: limpa os dados locais de sessão.
- Após cadastrar, o usuário é direcionado ao login; cadastro por si só não retorna token.
- Salas: `GET /flex/rooms` lista as salas ativas; criação, atualização de whitelist e encerramento usam os eventos Socket.IO `room:create`, `room:whitelist:update` e `room:close`.
- Participantes: `GET /flex/rooms/:roomId/participants` atualiza a lista automaticamente a cada 8 segundos.
- Presets: criar, editar e remover listas persistidas em `/flex/rooms/presets`.
- Perfil: atualizar os próprios dados em `PUT /flex/professors/:id`; a exclusão da conta exige confirmação.

## Estrutura

```text
dashboard/
├── public/
│   └── flex-logo.png
└── src/
├── api/
│   ├── http.js              # fetch, URL base e tratamento de erros
│   ├── auth.js              # rotas de autenticação
│   ├── professors.js        # atualização e exclusão da conta
│   └── rooms.js             # salas, presets e eventos Socket.IO
├── auth/
│   └── AuthContext.jsx      # estado global da sessão
├── components/              # layout, logo e rotas protegidas
├── pages/                   # login, cadastro e painel do professor
├── styles/
│   └── global.css
├── App.jsx                  # rotas
└── main.jsx
```

## Limites atuais

- O painel lista e opera somente as próprias salas e presets; não disponibiliza um diretório de outros professores.
- Salas são mantidas em memória pela API e desaparecem ao reiniciar o servidor.
- Não é possível verificar a disponibilidade ou a configuração de CORS do servidor apenas pelo código; teste o fluxo com a API ligada.
- `sessionStorage` mantém a sessão durante a vida da aba e é limpo quando ela é fechada; as senhas nunca são armazenadas.
- Para produção, considere uma estratégia de sessão baseada em cookies `HttpOnly` com suporte do backend e uma política de segurança de conteúdo adequada.
