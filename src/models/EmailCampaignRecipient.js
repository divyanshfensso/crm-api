const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class EmailCampaignRecipient extends Model {
    static associate(models) {
      EmailCampaignRecipient.belongsTo(models.EmailCampaign, { foreignKey: 'campaign_id', as: 'campaign', onDelete: 'CASCADE' });
    }
  }

  EmailCampaignRecipient.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    campaign_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'email_campaigns', key: 'id' } },
    email: { type: DataTypes.STRING(255), allowNull: false, validate: { isEmail: { msg: 'Must be a valid email address' } } },
    entity_type: { type: DataTypes.STRING(50), allowNull: true },
    entity_id: { type: DataTypes.INTEGER, allowNull: true },
    status: { type: DataTypes.ENUM('pending', 'sent', 'failed', 'bounced'), allowNull: false, defaultValue: 'pending' },
    sent_at: { type: DataTypes.DATE, allowNull: true },
    opened_at: { type: DataTypes.DATE, allowNull: true },
    clicked_at: { type: DataTypes.DATE, allowNull: true },
    error_message: { type: DataTypes.TEXT, allowNull: true },
  }, {
    sequelize, modelName: 'EmailCampaignRecipient', tableName: 'email_campaign_recipients',
    timestamps: true, underscored: true,
    indexes: [
      { fields: ['campaign_id'] }, { fields: ['email'] },
      { fields: ['status'] }, { fields: ['entity_type', 'entity_id'] },
      { fields: ['created_at'] },
    ]
  });

  return EmailCampaignRecipient;
};
