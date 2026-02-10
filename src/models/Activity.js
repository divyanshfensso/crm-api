const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Activity extends Model {
    static associate(models) {
      Activity.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user'
      });

      Activity.belongsTo(models.Contact, {
        foreignKey: 'contact_id',
        as: 'contact'
      });

      Activity.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company'
      });

      Activity.belongsTo(models.Deal, {
        foreignKey: 'deal_id',
        as: 'deal'
      });

      Activity.belongsTo(models.Lead, {
        foreignKey: 'lead_id',
        as: 'lead'
      });
    }
  }

  Activity.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' }
      },
      type: {
        type: DataTypes.ENUM('note', 'call', 'email', 'meeting', 'task'),
        allowNull: false
      },
      subject: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          notEmpty: { msg: 'Subject is required' }
        }
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      contact_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'contacts', key: 'id' }
      },
      company_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'companies', key: 'id' }
      },
      deal_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'deals', key: 'id' }
      },
      lead_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'leads', key: 'id' }
      },
      due_date: {
        type: DataTypes.DATE,
        allowNull: true
      },
      completed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: 'Activity',
      tableName: 'activities',
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ['user_id'] },
        { fields: ['contact_id'] },
        { fields: ['company_id'] },
        { fields: ['deal_id'] },
        { fields: ['lead_id'] },
        { fields: ['type'] },
        { fields: ['due_date'] },
        { fields: ['completed'] },
        { fields: ['created_at'] }
      ]
    }
  );

  return Activity;
};
