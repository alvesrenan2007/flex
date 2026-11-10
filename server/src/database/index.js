const { Sequelize } = require('sequelize');

const config = require('../config');
const Professor = require('../models/Professor');
const WhitelistPreset = require('../models/WhitelistPreset');


// Lista de models da aplicação: adicione novos models aqui.
const models = [Professor, WhitelistPreset];

class Database {
  constructor() {
    const { host, port, name, user, password } = config.database;

    this.connection = new Sequelize(name, user, password, {
      dialect: 'mysql',
      host,
      port,
      logging: false,
      define: {
        underscored: true, // createdAt -> created_at
      },
    });

    this.init();
  }

  init() {
    models.forEach((model) => model.init(this.connection));
    models.forEach((model) => model.associate?.(this.connection.models));
  }

  async connect() {
    await this.connection.authenticate();
    // Em produção prefira migrations; sync é prático para desenvolvimento.
    await this.connection.sync();
    console.log('MySQL conectado');
  }
}

module.exports = new Database();
