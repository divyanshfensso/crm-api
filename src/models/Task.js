const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Task extends Model {
    static associate(models) {
      Task.belongsTo(models.User, { foreignKey: 'assigned_to', as: 'assignee' });
      Task.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
      Task.belongsTo(models.Contact, { foreignKey: 'contact_id', as: 'contact' });
      Task.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
      Task.belongsTo(models.Deal, { foreignKey: 'deal_id', as: 'deal' });
    }
  }

  Task.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING(255), allowNull: false, validate: { notEmpty: { msg: 'Task title is required' } } },
    description: { type: DataTypes.TEXT, allowNull: true },
    priority: { type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'), allowNull: false, defaultValue: 'medium' },
    status: { type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'cancelled'), allowNull: false, defaultValue: 'pending' },
    due_date: { type: DataTypes.DATE, allowNull: true },
    completed_at: { type: DataTypes.DATE, allowNull: true },
    assigned_to: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
    contact_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'contacts', key: 'id' } },
    company_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'companies', key: 'id' } },
    deal_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'deals', key: 'id' } },
    created_by: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
  }, {
    sequelize, modelName: 'Task', tableName: 'tasks',
    timestamps: true, underscored: true, paranoid: true,
    indexes: [
      { fields: ['assigned_to'] }, { fields: ['status'] },
      { fields: ['priority'] }, { fields: ['due_date'] },
      { fields: ['contact_id'] }, { fields: ['company_id'] },
      { fields: ['deal_id'] }, { fields: ['created_at'] },
    ]
  });

  return Task;
};
