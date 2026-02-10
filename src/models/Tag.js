const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Tag extends Model {
    static associate(models) {
      // Tags are referenced by JSON columns in Contact, Company, Lead, Deal
    }
  }

  Tag.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
          notEmpty: { msg: 'Tag name is required' }
        }
      },
      color: {
        type: DataTypes.STRING(7),
        allowNull: true,
        defaultValue: '#0072BC'
      },
      module: {
        type: DataTypes.STRING(50),
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: 'Tag',
      tableName: 'tags',
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ['name', 'module'], unique: true }
      ]
    }
  );

  return Tag;
};
