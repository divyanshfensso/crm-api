module.exports = (sequelize, DataTypes) => {
  class WorkflowStep extends require('sequelize').Model {
    static associate(models) {
      WorkflowStep.belongsTo(models.Workflow, { foreignKey: 'workflow_id', as: 'workflow', onDelete: 'CASCADE' });
    }
  }

  WorkflowStep.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    workflow_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'workflows', key: 'id' } },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    step_type: { type: DataTypes.ENUM('condition', 'action', 'delay'), allowNull: false },
    config: { type: DataTypes.JSON, allowNull: false },
  }, {
    sequelize, modelName: 'WorkflowStep', tableName: 'workflow_steps',
    timestamps: true, underscored: true,
    indexes: [
      { fields: ['workflow_id'] },
      { fields: ['step_type'] },
    ]
  });

  return WorkflowStep;
};
