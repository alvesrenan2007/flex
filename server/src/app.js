const express = require('express');
const cors = require('cors');
const { createServer } = require('http');

const createRoutes = require('./routes');
const RoomManager = require('./sockets/RoomManager');
const WhitelistPresetRepository = require('./repositories/WhitelistPresetRepository');
const WhitelistPresetService = require('./services/WhitelistPresetService');
const errorHandler = require('./middlewares/errorHandler');
const notFound = require('./middlewares/notFound');
const attachSocketHandlers = require('./sockets');

class App {
  constructor({ whitelistPresetService } = {}) {
    this.app = express();
    this.server = createServer(this.app);
    this.roomManager = new RoomManager();
    this.whitelistPresetService = whitelistPresetService || new WhitelistPresetService(
      new WhitelistPresetRepository(),
    );
    this.io = attachSocketHandlers(this.server, this.roomManager, this.whitelistPresetService);
    this.middlewares();
    this.routes();
    this.errorHandling();
  }

  middlewares() {
    this.app.use(cors());
    this.app.use(express.json());
  }

  routes() {
    this.app.use('/flex', createRoutes(this.roomManager, this.whitelistPresetService));
  }

  errorHandling() {
    this.app.use(notFound);
    this.app.use(errorHandler);
  }

  listen(port) {
    this.server.listen(port, () => {
      console.log(`Servidor rodando em http://localhost:${port}`);
    });
  }
}

module.exports = App;
