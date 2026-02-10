const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class EmailLog extends Model {
    static associate(models) {
      EmailLog.belongsTo(models.EmailTemplate, { foreignKey: 'template_id', as: 'template' });
      EmailLog.belongsTo(models.User, { foreignKey: 'sent_by', as: 'sender' });
    }
  }

  EmailLog.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    template_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'email_templates', key: 'id' } },
    recipient_email: { type: DataTypes.STRING(255), allowNull: false },
    recipient_name: { type: DataTypes.STRING(200), allowNull: true },
    subject: { type: DataTypes.STRING(500), allowNull: false },
    body: { type: DataTypes.TEXT('long'), allowNull: false },
    status: { type: DataTypes.ENUM('queued', 'sent', 'failed'), allowNull: false, defaultValue: 'queued' },
    sent_at: { type: DataTypes.DATE, allowNull: true },
    error_message: { type: DataTypes.TEXT, allowNull: true },
    sent_by: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
  }, {
    sequelize, modelName: 'EmailLog', tableName: 'email_logs',
    timestamps: true, underscored: true,
    indexes: [
      { fields: ['template_id'] }, { fields: ['status'] },
      { fields: ['sent_by'] }, { fields: ['created_at'] },
    ]
  });

  return EmailLog;
};
