const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class EmailCampaign extends Model {
    static associate(models) {
      EmailCampaign.belongsTo(models.EmailTemplate, { foreignKey: 'template_id', as: 'template', onDelete: 'SET NULL' });
      EmailCampaign.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator', onDelete: 'NO ACTION' });
      EmailCampaign.hasMany(models.EmailCampaignRecipient, { foreignKey: 'campaign_id', as: 'recipients' });
    }
  }

  EmailCampaign.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(200), allowNull: false, validate: { notEmpty: { msg: 'Campaign name is required' } } },
    subject: { type: DataTypes.STRING(500), allowNull: false, validate: { notEmpty: { msg: 'Subject is required' } } },
    template_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'email_templates', key: 'id' } },
    audience_filter: { type: DataTypes.JSON, allowNull: true },
    scheduled_at: { type: DataTypes.DATE, allowNull: true },
    status: { type: DataTypes.ENUM('draft', 'scheduled', 'sending', 'completed', 'failed'), allowNull: false, defaultValue: 'draft' },
    total_recipients: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    sent_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    failed_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    opened_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    clicked_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_by: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
  }, {
    sequelize, modelName: 'EmailCampaign', tableName: 'email_campaigns',
    timestamps: true, underscored: true, paranoid: true,
    indexes: [
      { fields: ['template_id'] }, { fields: ['status'] },
      { fields: ['scheduled_at'] }, { fields: ['created_by'] },
      { fields: ['created_at'] },
    ]
  });

  return EmailCampaign;
};
