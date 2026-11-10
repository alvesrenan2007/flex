module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  socket: {
    pingInterval: Number(process.env.SOCKET_PING_INTERVAL_MS) || 25000,
    pingTimeout: Number(process.env.SOCKET_PING_TIMEOUT_MS) || 20000,
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    name: process.env.DB_NAME || 'api',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
  },
};
