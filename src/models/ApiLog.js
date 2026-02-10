module.exports = (sequelize, DataTypes) => {
  class ApiLog extends require('sequelize').Model {
    static associate(models) {
      ApiLog.belongsTo(models.ApiKey, {
        foreignKey: 'api_key_id',
        as: 'apikey',
        onDelete: 'CASCADE',
      });
    }
  }

  ApiLog.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    api_key_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'api_keys', key: 'id' },
    },
    method: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    endpoint: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    status_code: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    response_time: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'ApiLog',
    tableName: 'api_logs',
    timestamps: true,
    updatedAt: false,
    underscored: true,
    paranoid: false,
  });

  return ApiLog;
};
