const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ImportJob extends Model {
    static associate(models) {
      ImportJob.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator', onDelete: 'NO ACTION' });
    }
  }

  ImportJob.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    entity_type: { type: DataTypes.ENUM('contacts', 'companies', 'leads', 'deals'), allowNull: false },
    filename: { type: DataTypes.STRING(255), allowNull: false, validate: { notEmpty: { msg: 'Filename is required' } } },
    file_path: { type: DataTypes.STRING(500), allowNull: false, validate: { notEmpty: { msg: 'File path is required' } } },
    total_rows: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    processed_rows: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    success_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    error_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    status: { type: DataTypes.ENUM('pending', 'validating', 'processing', 'completed', 'failed'), allowNull: false, defaultValue: 'pending' },
    error_log: { type: DataTypes.JSON, allowNull: true },
    column_mapping: { type: DataTypes.JSON, allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
  }, {
    sequelize, modelName: 'ImportJob', tableName: 'import_jobs',
    timestamps: true, underscored: true,
    indexes: [
      { fields: ['entity_type'] }, { fields: ['status'] },
      { fields: ['created_by'] }, { fields: ['created_at'] },
    ]
  });

  return ImportJob;
};
