const { Router } = require('express');

const RoomController = require('../controllers/RoomController');
const authenticate = require('../middlewares/authenticate');

function createRoomRoutes(roomManager, whitelistPresetService) {
  const router = Router();
  const controller = new RoomController(roomManager, whitelistPresetService);

  router.get('/', authenticate, controller.index);
  router.get('/presets', authenticate, controller.listPresets);
  router.post('/presets', authenticate, controller.createPreset);
  router.put('/presets/:presetId', authenticate, controller.updatePreset);
  router.delete('/presets/:presetId', authenticate, controller.deletePreset);
  router.post('/join', controller.guestAccess);
  router.get('/:roomId/participants', authenticate, controller.participants);

  return router;
}

module.exports = createRoomRoutes;
