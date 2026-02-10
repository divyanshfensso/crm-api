module.exports = (sequelize, DataTypes) => {
  class WebhookDelivery extends require('sequelize').Model {
    static associate(models) {
      WebhookDelivery.belongsTo(models.Webhook, {
        foreignKey: 'webhook_id',
        as: 'webhook',
        onDelete: 'CASCADE',
      });
    }
  }

  WebhookDelivery.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    webhook_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'webhooks', key: 'id' },
    },
    event: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'success', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    status_code: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    response_body: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    next_retry_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'WebhookDelivery',
    tableName: 'webhook_deliveries',
    timestamps: true,
    updatedAt: false,
    underscored: true,
    paranoid: false,
  });

  return WebhookDelivery;
};
