const { Model, DataTypes } = require('sequelize');

class Professor extends Model {
  static init(sequelize) {
    super.init(
      {
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        password: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        email: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
          validate: { isEmail: true },
        },
      },
      {
        sequelize,
        tableName: 'professors',
        defaultScope: {
          attributes: { exclude: ['password'] },
        },
      },
    );
  }

  toJSON() {
    const values = { ...this.get() };
    delete values.password;
    return values;
  }
}

module.exports = Professor;
