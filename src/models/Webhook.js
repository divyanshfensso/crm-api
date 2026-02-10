module.exports = (sequelize, DataTypes) => {
  class Webhook extends require('sequelize').Model {
    static associate(models) {
      Webhook.belongsTo(models.User, {
        foreignKey: 'created_by',
        as: 'creator',
        onDelete: 'NO ACTION',
      });
      Webhook.hasMany(models.WebhookDelivery, {
        foreignKey: 'webhook_id',
        as: 'deliveries',
      });
    }
  }

  Webhook.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    secret: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    events: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
  }, {
    sequelize,
    modelName: 'Webhook',
    tableName: 'webhooks',
    timestamps: true,
    underscored: true,
    paranoid: true,
  });

  return Webhook;
};
