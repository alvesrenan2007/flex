const { Router } = require('express');

const authRoutes = require('./authRoutes');
const professorRoutes = require('./professorRoutes');
const createRoomRoutes = require('./roomRoutes');

function createRoutes(roomManager, whitelistPresetService) {
  const router = Router();

  router.get('/health', (req, res) => res.json({ status: 'ok' }));

  router.use('/auth', authRoutes);
  router.use('/professors', professorRoutes);
  router.use('/rooms', createRoomRoutes(roomManager, whitelistPresetService));

  return router;
}

module.exports = createRoutes;
