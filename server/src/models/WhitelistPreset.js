const { Model, DataTypes } = require('sequelize');

class WhitelistPreset extends Model {
  static init(sequelize) {
    super.init(
      {
        professorId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: 'professors', key: 'id' },
          onDelete: 'CASCADE',
        },
        name: {
          type: DataTypes.STRING(80),
          allowNull: false,
        },
        urls: {
          type: DataTypes.JSON,
          allowNull: false,
        },
      },
      {
        sequelize,
        tableName: 'whitelist_presets',
        indexes: [
          {
            unique: true,
            fields: ['professor_id', 'name'],
          },
        ],
      },
    );
  }
}

module.exports = WhitelistPreset;
