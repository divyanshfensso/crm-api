module.exports = (sequelize, DataTypes) => {
  class WorkflowLog extends require('sequelize').Model {
    static associate(models) {
      WorkflowLog.belongsTo(models.Workflow, { foreignKey: 'workflow_id', as: 'workflow', onDelete: 'CASCADE' });
    }
  }

  WorkflowLog.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    workflow_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'workflows', key: 'id' } },
    entity_type: { type: DataTypes.STRING(50), allowNull: true },
    entity_id: { type: DataTypes.INTEGER, allowNull: true },
    status: { type: DataTypes.ENUM('success', 'failed', 'partial'), allowNull: false, defaultValue: 'success' },
    execution_time: { type: DataTypes.INTEGER, allowNull: true },
    steps_executed: { type: DataTypes.JSON, allowNull: true },
    error_message: { type: DataTypes.TEXT, allowNull: true },
  }, {
    sequelize, modelName: 'WorkflowLog', tableName: 'workflow_logs',
    timestamps: true, underscored: true, updatedAt: false,
    indexes: [
      { fields: ['workflow_id'] },
      { fields: ['status'] },
      { fields: ['created_at'] },
    ]
  });

  return WorkflowLog;
};
