module.exports = (sequelize, DataTypes) => {
  class Workflow extends require('sequelize').Model {
    static associate(models) {
      Workflow.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator', onDelete: 'NO ACTION' });
      Workflow.hasMany(models.WorkflowStep, { foreignKey: 'workflow_id', as: 'steps' });
      Workflow.hasMany(models.WorkflowLog, { foreignKey: 'workflow_id', as: 'logs' });
    }
  }

  Workflow.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(200), allowNull: false, validate: { notEmpty: { msg: 'Workflow name is required' } } },
    description: { type: DataTypes.TEXT, allowNull: true },
    entity_type: { type: DataTypes.ENUM('contact', 'lead', 'deal', 'company', 'task'), allowNull: false },
    trigger_type: { type: DataTypes.ENUM('create', 'update', 'delete', 'time_based', 'manual'), allowNull: false },
    trigger_config: { type: DataTypes.JSON, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    execution_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    last_executed_at: { type: DataTypes.DATE, allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
  }, {
    sequelize, modelName: 'Workflow', tableName: 'workflows',
    timestamps: true, underscored: true, paranoid: true,
    indexes: [
      { fields: ['entity_type'] },
      { fields: ['trigger_type'] },
      { fields: ['is_active'] },
      { fields: ['created_by'] },
    ]
  });

  return Workflow;
};
