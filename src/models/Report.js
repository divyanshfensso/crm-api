const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Report extends Model {
    static associate(models) {
      Report.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator', onDelete: 'NO ACTION' });
    }
  }

  Report.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(200), allowNull: false, validate: { notEmpty: { msg: 'Report name is required' } } },
    description: { type: DataTypes.TEXT, allowNull: true },
    entity_type: { type: DataTypes.ENUM('contacts', 'leads', 'deals', 'companies', 'activities', 'tasks', 'quotes', 'invoices', 'payments'), allowNull: false },
    columns: { type: DataTypes.JSON, allowNull: true },
    filters: { type: DataTypes.JSON, allowNull: true },
    grouping: { type: DataTypes.JSON, allowNull: true },
    sorting: { type: DataTypes.JSON, allowNull: true },
    chart_config: { type: DataTypes.JSON, allowNull: true },
    is_public: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    created_by: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
  }, {
    sequelize, modelName: 'Report', tableName: 'reports',
    timestamps: true, underscored: true, paranoid: true,
    indexes: [
      { fields: ['entity_type'] }, { fields: ['is_public'] },
      { fields: ['created_by'] }, { fields: ['created_at'] },
    ]
  });

  return Report;
};
