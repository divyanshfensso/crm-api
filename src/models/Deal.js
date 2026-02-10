const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Deal extends Model {
    static associate(models) {
      Deal.belongsTo(models.User, {
        foreignKey: 'owner_id',
        as: 'owner'
      });

      Deal.belongsTo(models.Contact, {
        foreignKey: 'contact_id',
        as: 'contact'
      });

      Deal.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company'
      });

      Deal.belongsTo(models.Pipeline, {
        foreignKey: 'pipeline_id',
        as: 'pipeline'
      });

      Deal.belongsTo(models.PipelineStage, {
        foreignKey: 'stage_id',
        as: 'stage'
      });

      Deal.belongsTo(models.User, {
        foreignKey: 'created_by',
        as: 'creator'
      });

      Deal.hasMany(models.Activity, {
        foreignKey: 'deal_id',
        as: 'activities'
      });

      Deal.hasMany(models.Lead, {
        foreignKey: 'converted_deal_id',
        as: 'convertedLeads'
      });
    }
  }

  Deal.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      owner_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' }
      },
      title: {
        type: DataTypes.STRING(200),
        allowNull: false,
        validate: {
          notEmpty: { msg: 'Deal title is required' }
        }
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
      pipeline_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'pipelines', key: 'id' }
      },
      stage_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'pipeline_stages', key: 'id' }
      },
      value: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0
      },
      currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'USD'
      },
      probability: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        validate: {
          min: { args: [0], msg: 'Probability must be between 0 and 100' },
          max: { args: [100], msg: 'Probability must be between 0 and 100' }
        }
      },
      expected_close_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      actual_close_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM('open', 'won', 'lost'),
        allowNull: false,
        defaultValue: 'open'
      },
      lost_reason: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      tags: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: []
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' }
      }
    },
    {
      sequelize,
      modelName: 'Deal',
      tableName: 'deals',
      timestamps: true,
      underscored: true,
      paranoid: true,
      indexes: [
        { fields: ['owner_id'] },
        { fields: ['contact_id'] },
        { fields: ['company_id'] },
        { fields: ['pipeline_id'] },
        { fields: ['stage_id'] },
        { fields: ['status'] },
        { fields: ['expected_close_date'] },
        { fields: ['created_at'] }
      ]
    }
  );

  return Deal;
};
