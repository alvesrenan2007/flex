# FLEX API: guia para o front-end

Este documento descreve a API Express disponível em `http://localhost:3000`.
Configure `API_URL` com a URL base do ambiente, sem a barra final. Os caminhos
HTTP abaixo já incluem o prefixo `/flex`.

## Configuração do servidor

O servidor precisa de MySQL e das variáveis de ambiente configuradas no `.env`:

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=use-um-segredo-aleatorio-forte
JWT_EXPIRES_IN=1d
DB_HOST=localhost
DB_PORT=3306
DB_NAME=api
DB_USER=root
DB_PASS=
SOCKET_PING_INTERVAL_MS=25000
SOCKET_PING_TIMEOUT_MS=20000
```

Inicie com `npm install` e `npm run dev`. Para os testes, use `npm test`.

## Autenticação

As rotas protegidas por JWT recebem:

```http
Authorization: Bearer <token>
```

O login de professor devolve o token. Guarde-o no armazenamento apropriado do
cliente e envie-o nas chamadas subsequentes. Tokens expirados ou inválidos
retornam `401`.

### Criar professor

`POST /flex/professors/create` — público.

```json
{
  "name": "Nome do professor",
  "email": "professor@example.com",
  "password": "senha"
}
```

Retorna `201` e o professor criado, sem incluir a senha.

### Login

`POST /flex/auth/login` — público.

```json
{
  "email": "professor@example.com",
  "password": "senha"
}
```

Resposta `200`:

```json
{
  "token": "<jwt>",
  "professor": {
    "id": 1,
    "name": "Nome do professor",
    "email": "professor@example.com"
  }
}
```

Credenciais incorretas retornam `401`; campos ausentes retornam `400`.

### Perfil

`GET /flex/auth/me` — autenticado.

Retorna os dados do professor associado ao token, sem a senha.

## Rotas HTTP

| Método | Caminho | Autenticação | Descrição |
|---|---|---|---|
| `GET` | `/flex/health` | Não | Verifica se a API está disponível |
| `POST` | `/flex/auth/login` | Não | Login do professor |
| `GET` | `/flex/auth/me` | Professor | Perfil do professor autenticado |
| `POST` | `/flex/professors/create` | Não | Cadastro de professor |
| `GET` | `/flex/professors` | Sim | Lista professores |
| `GET` | `/flex/professors/:id` | Sim | Consulta professor |
| `PUT` | `/flex/professors/:id` | Sim | Atualiza nome, e-mail ou senha |
| `DELETE` | `/flex/professors/:id` | Sim | Remove professor |
| `GET` | `/flex/rooms` | Professor | Lista as salas ativas do professor |
| `GET` | `/flex/rooms/:roomId/participants` | Professor dono da sala | Lista participantes conectados |
| `GET` | `/flex/rooms/presets` | Professor | Lista os presets de whitelist do professor |
| `POST` | `/flex/rooms/presets` | Professor | Cria um preset |
| `PUT` | `/flex/rooms/presets/:presetId` | Professor dono do preset | Atualiza nome e/ou domínios do preset |
| `DELETE` | `/flex/rooms/presets/:presetId` | Professor dono do preset | Remove um preset |
| `POST` | `/flex/rooms/join` | Não | Emite credencial temporária opcional para convidado |

Para atualizar professor, envie somente os campos desejados:

```json
{
  "name": "Novo nome",
  "email": "novo@example.com",
  "password": "nova-senha"
}
```

As rotas de sala retornam `404` se a sala não existir ou pertencer a outro
professor. A lista de salas e os participantes são restritos ao professor dono.

### Presets de whitelist

Crie um preset com `POST /flex/rooms/presets`:

```json
{
  "name": "Sites da aula",
  "urls": [
    "google.com",
    "docs.example.org"
  ]
}
```

Os presets são armazenados no MySQL e pertencem ao professor que os criou.
`PUT` aceita `name`, `urls` ou ambos.

A lista `urls` contém somente domínios, sem protocolo, caminho ou porta, por
exemplo `google.com`. São aceitos até 100 domínios válidos; eles são
normalizados para minúsculas e duplicatas são removidas.

### Entrada HTTP opcional de convidado

`POST /flex/rooms/join` aceita:

```json
{
  "roomId": "<id-da-sala>",
  "nickname": "Ana"
}
```

Retorna um token de convidado com validade de 15 minutos, o nome da sala e a
whitelist. Use esse token para conectar via Socket.IO. O cliente também pode
conectar diretamente sem token e entrar com o evento `room:join`.

## Socket.IO

Conecte-se ao mesmo host e porta da API, por exemplo `http://localhost:3000`.
Para professores, envie o JWT no handshake. Convidados podem conectar sem token.

```js
import { io } from 'socket.io-client';

// Professor
const teacherSocket = io('http://localhost:3000', {
  auth: { token: professorJwt }
});

// Convidado que vai entrar usando room:join
const guestSocket = io('http://localhost:3000');
```

O servidor também aceita `Authorization: Bearer <token>` no handshake. A
conexão usa o ping/pong nativo do Socket.IO, com intervalo padrão de 25 segundos
e timeout de 20 segundos.

### Criar sala (professor)

Envie `room:create` com acknowledgement ativado:

```js
teacherSocket.emit('room:create', {
  name: 'Aula de matemática',
  capacity: 30,
  presetId: 1
}, (result) => {
  if (!result.ok) {
    console.error(result.error);
    return;
  }
  console.log(result.room.id);
});
```

O professor pode selecionar um `presetId` que lhe pertence **ou** enviar uma
whitelist própria, nunca os dois:

```json
{
  "name": "Aula de matemática",
  "capacity": 30,
  "whitelist": ["example.com"]
}
```

`name` deve ter de 1 a 80 caracteres; `capacity` deve ser inteiro positivo. A
whitelist é copiada para a sala no momento da criação, então alterações ou
exclusão posterior do preset não alteram a sala já aberta. Para atualizar a
whitelist de uma sala ativa, o professor dono pode emitir
`room:whitelist:update` com uma whitelist própria ou um `presetId` que lhe
pertence, nunca os dois. Os participantes conectados recebem a nova lista
imediatamente. O ID de sala tem 5 caracteres alfanuméricos maiúsculos.

```js
teacherSocket.emit('room:whitelist:update', {
  roomId: 'A1B2C',
  whitelist: ['example.net']
}, (result) => {
  if (result.ok) {
    console.log(result.room.whitelist);
  } else {
    console.error(result.error);
  }
});
```

Também é possível aplicar um preset à sala:

```js
teacherSocket.emit('room:whitelist:update', {
  roomId: 'A1B2C',
  presetId: 1
}, (result) => {
  if (result.ok) {
    console.log(result.room.presetName, result.room.whitelist);
  } else {
    console.error(result.error);
  }
});
```

O evento usa as mesmas regras de validação da whitelist de criação. A resposta
de acknowledgement contém `{ "ok": true, "room": ... }`; o servidor também
transmite `room:whitelist:updated` aos demais sockets da sala com
`roomId` e `whitelist`. Somente o professor dono pode atualizar a lista; ao
enviar uma whitelist própria, a sala deixa de estar associada ao preset usado
anteriormente. Ao aplicar um preset, a lista é copiada no momento da atualização
e a sala passa a exibir o ID e o nome desse preset.

A resposta de acknowledgement e o evento `room:created` contêm:

```json
{
  "ok": true,
  "room": {
    "id": "A1B2C",
    "name": "Aula de matemática",
    "capacity": 30,
    "participantCount": 0,
    "whitelist": ["example.com"],
    "presetId": 1,
    "presetName": "Sites da aula",
    "createdAt": "2026-01-01T12:00:00.000Z"
  }
}
```

### Entrada direta do convidado

Após conectar sem autenticação, emita `room:join`:

```js
guestSocket.emit('room:join', {
  roomId: 'A1B2C',
  nickname: 'Ana'
}, (result) => {
  if (result.ok) {
    console.log(result.room.whitelist);
  } else {
    console.error(result.error);
  }
});
```

O nickname deve ter de 1 a 40 caracteres. Se entrar com sucesso, o convidado
recebe `room:joined` com os dados da sala, participante e whitelist. A capacidade
conta convidados conectados; a conexão Socket.IO do professor não consome vaga.
Em cada sala, somente uma conexão de aluno por endereço IP é permitida. Uma
conexão da mesma máquina em outra sala é aceita.

Se usar a rota `POST /flex/rooms/join`, conecte passando o token retornado no
handshake `auth.token`; a entrada será automática. Não emita também `room:join`
para esse fluxo.

### Outros eventos

| Evento enviado | Payload | Resultado |
|---|---|---|
| `room:whitelist:update` | `{ "roomId": "<id>", "whitelist": ["google.com"] }` ou `{ "roomId": "<id>", "presetId": 1 }` | Atualiza a whitelist; acknowledgement `room:whitelist:updated` e broadcast para os demais sockets da sala |
| `room:leave` | `{ "roomId": "<id>" }` | Sai da sala e recebe acknowledgement `room:left` |
| `room:message` | `{ "roomId": "<id>", "message": "Olá" }` | Transmite a mensagem aos participantes |

Mensagens devem ter de 1 a 2000 caracteres e só podem ser enviadas por
participantes da sala.

Eventos recebidos:

| Evento | Conteúdo |
|---|---|
| `room:created` | Sala criada pelo professor |
| `room:joined` | Sala e participante após entrada |
| `room:member-joined` | `roomId`, `nickname`, `participantCount` |
| `room:member-left` | `roomId`, `nickname`, `participantCount` |
| `room:message` | `roomId`, `nickname`, `message`, `sentAt` |
| `room:left` | Confirmação de saída |
| `room:error` | Erro com `code` e `message` |

Use acknowledgements para obter o resultado da operação solicitada. Os erros de
sala usam códigos como `INVALID_INPUT`, `ROOM_NOT_FOUND`, `ROOM_FULL`,
`NOT_IN_ROOM` e `UNAUTHORIZED`.

### Monitorar participantes

O front-end do professor pode fazer polling em
`GET /flex/rooms/:roomId/participants` ou combinar a resposta inicial com os
eventos Socket.IO de entrada e saída.

```json
{
  "id": "A1B2C",
  "name": "Aula de matemática",
  "capacity": 30,
  "participantCount": 1,
  "whitelist": ["example.com"],
  "presetId": 1,
  "presetName": "Sites da aula",
  "createdAt": "2026-01-01T12:00:00.000Z",
  "participants": [
    {
      "nickname": "Ana",
      "connectedAt": "2026-01-01T12:01:00.000Z"
    }
  ]
}
```

## Erros HTTP

Respostas de erro usam o formato:

```json
{
  "status": "error",
  "message": "Descrição do erro"
}
```

Os principais status são `400` (dados inválidos), `401` (token ausente,
inválido ou expirado), `404` (recurso ausente ou não pertencente ao professor) e
`409` (e-mail já cadastrado). Em desenvolvimento, a API também inclui `stack`.

## Notas para integração do proxy

A API fornece a whitelist da sala para o front-end/cliente. A aplicação cliente
deve encaminhá-la ao proxy local. A whitelist retornada pela API é uma lista de
domínios; o backend atual não intercepta nem valida tráfego de rede em nome do
cliente. Não trate validação feita somente no front-end como uma barreira de
segurança.

As salas são mantidas em memória e desaparecem ao reiniciar o servidor. Os
presets, por outro lado, são persistidos no MySQL.
