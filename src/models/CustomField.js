const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CustomField extends Model {
    static associate(models) {
      CustomField.belongsTo(models.User, {
        foreignKey: 'created_by',
        as: 'creator'
      });
    }
  }

  CustomField.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      entity_type: {
        type: DataTypes.ENUM('contacts', 'companies', 'leads', 'deals'),
        allowNull: false
      },
      field_key: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'snake_case key used in JSON storage'
      },
      field_label: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Human-readable display name'
      },
      field_type: {
        type: DataTypes.ENUM('text', 'number', 'date', 'select', 'url', 'email'),
        allowNull: false,
        defaultValue: 'text'
      },
      options: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: null,
        comment: 'For select type: ["Option A", "Option B"]'
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' }
      }
    },
    {
      sequelize,
      modelName: 'CustomField',
      tableName: 'custom_field_definitions',
      timestamps: true,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['entity_type', 'field_key', 'created_by'],
          name: 'uq_custom_field_per_user'
        },
        { fields: ['created_by'] },
        { fields: ['entity_type'] }
      ]
    }
  );

  return CustomField;
};
