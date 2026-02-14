const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UserIntegration extends Model {
    static associate(models) {
      UserIntegration.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user',
        onDelete: 'CASCADE',
      });
    }
  }

  UserIntegration.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    provider: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: {
          args: [['google', 'microsoft']],
          msg: 'Provider must be one of: google, microsoft',
        },
      },
    },
    access_token: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    refresh_token: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    token_expiry: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    scopes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    provider_email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    provider_user_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    last_sync_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    sync_error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'UserIntegration',
    tableName: 'user_integrations',
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ['user_id', 'provider'], name: 'unique_user_provider' },
      { fields: ['provider'] },
      { fields: ['is_active'] },
    ],
  });

  return UserIntegration;
};
