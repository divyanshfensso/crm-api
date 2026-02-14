const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Notification extends Model {
    static associate(models) {
      Notification.belongsTo(models.User, {
        foreignKey: 'recipient_id',
        as: 'recipient'
      });
      Notification.belongsTo(models.User, {
        foreignKey: 'sender_id',
        as: 'sender'
      });
    }
  }

  Notification.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      type: {
        type: DataTypes.ENUM(
          'task_assigned',
          'task_due_soon',
          'task_overdue',
          'deal_stage_changed',
          'deal_won',
          'deal_lost',
          'lead_assigned',
          'calendar_reminder',
          'invoice_overdue',
          'mention',
          'system'
        ),
        allowNull: false
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      recipient_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' }
      },
      sender_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' }
      },
      related_module: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      related_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      priority: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
        allowNull: false,
        defaultValue: 'medium'
      },
      is_read: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      read_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      is_email_sent: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      data: {
        type: DataTypes.JSON,
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: 'Notification',
      tableName: 'notifications',
      timestamps: true,
      underscored: true,
      paranoid: false,
      indexes: [
        { fields: ['recipient_id'] },
        { fields: ['recipient_id', 'is_read'] },
        { fields: ['type'] },
        { fields: ['priority'] },
        { fields: ['created_at'] },
        { fields: ['related_module', 'related_id'] }
      ]
    }
  );

  return Notification;
};
