const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class DataExport extends Model {
    static associate(models) {
      DataExport.belongsTo(models.User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
      DataExport.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator', onDelete: 'NO ACTION' });
    }
  }

  DataExport.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
    entity_types: { type: DataTypes.JSON, allowNull: false },
    format: { type: DataTypes.ENUM('csv', 'json'), allowNull: false, defaultValue: 'csv' },
    status: { type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'), allowNull: false, defaultValue: 'pending' },
    file_path: { type: DataTypes.STRING(500), allowNull: true },
    file_size: { type: DataTypes.INTEGER, allowNull: true },
    expires_at: { type: DataTypes.DATE, allowNull: true },
    error_message: { type: DataTypes.TEXT, allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
  }, {
    sequelize, modelName: 'DataExport', tableName: 'data_exports',
    timestamps: true, underscored: true,
    indexes: [
      { fields: ['user_id'] }, { fields: ['status'] },
      { fields: ['created_by'] }, { fields: ['created_at'] },
    ]
  });

  return DataExport;
};
