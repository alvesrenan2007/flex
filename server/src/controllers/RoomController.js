const { randomUUID } = require('crypto');
const jwt = require('jsonwebtoken');

const config = require('../config');

class RoomController {
  constructor(roomManager, whitelistPresetService) {
    this.roomManager = roomManager;
    this.whitelistPresetService = whitelistPresetService;
  }

  index = (req, res) => {
    res.json({ rooms: this.roomManager.listByProfessor(req.auth.professorId) });
  };

  participants = (req, res, next) => {
    try {
      const room = this.roomManager.getParticipants(req.params.roomId, req.auth.professorId);
      res.json(room);
    } catch (err) {
      next(err);
    }
  };

  guestAccess = (req, res, next) => {
    try {
      const { room, nickname } = this.roomManager.validateGuestJoin(
        req.body && req.body.roomId,
        req.body && req.body.nickname,
      );
      const token = jwt.sign(
        { type: 'guest', roomId: room.id, nickname },
        config.jwt.secret,
        {
          subject: `guest:${randomUUID()}`,
          expiresIn: '15m',
          algorithm: 'HS256',
        },
      );

      res.json({
        token,
        expiresIn: '15m',
        room: { id: room.id, name: room.name, whitelist: room.whitelist },
        nickname,
      });
    } catch (err) {
      next(err);
    }
  };

  listPresets = async (req, res, next) => {
    try {
      const presets = await this.whitelistPresetService.list(req.auth.professorId);
      res.json({ presets });
    } catch (err) {
      next(err);
    }
  };

  createPreset = async (req, res, next) => {
    try {
      const preset = await this.whitelistPresetService.create(req.auth.professorId, req.body);
      res.status(201).json(preset);
    } catch (err) {
      next(err);
    }
  };

  updatePreset = async (req, res, next) => {
    try {
      const preset = await this.whitelistPresetService.update(
        req.params.presetId,
        req.auth.professorId,
        req.body,
      );
      res.json(preset);
    } catch (err) {
      next(err);
    }
  };

  deletePreset = async (req, res, next) => {
    try {
      await this.whitelistPresetService.remove(req.params.presetId, req.auth.professorId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = RoomController;
