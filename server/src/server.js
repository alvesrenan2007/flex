require('dotenv').config();

const App = require('./app');
const config = require('./config');
const database = require('./database');

async function bootstrap() {
  if (!config.jwt.secret) {
    throw new Error('A variável JWT_SECRET é obrigatória');
  }

  await database.connect();

  const app = new App();
  app.listen(config.port);
}

bootstrap().catch((err) => {
  console.error('Falha ao iniciar a aplicação:', err);
  process.exit(1);
});
