module.exports = (sequelize, DataTypes) => {
  class ApiKey extends require('sequelize').Model {
    static associate(models) {
      ApiKey.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user',
        onDelete: 'CASCADE',
      });
      ApiKey.belongsTo(models.User, {
        foreignKey: 'created_by',
        as: 'creator',
        onDelete: 'NO ACTION',
      });
      ApiKey.hasMany(models.ApiLog, {
        foreignKey: 'api_key_id',
        as: 'logs',
      });
    }
  }

  ApiKey.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    key_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    key_prefix: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    scopes: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    rate_limit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1000,
    },
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
  }, {
    sequelize,
    modelName: 'ApiKey',
    tableName: 'api_keys',
    timestamps: true,
    underscored: true,
    paranoid: true,
    indexes: [
      { unique: true, fields: ['key_hash'] },
      { fields: ['key_prefix'] },
      { fields: ['user_id'] },
    ],
  });

  return ApiKey;
};
