const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Lead extends Model {
    static associate(models) {
      Lead.belongsTo(models.User, {
        foreignKey: 'owner_id',
        as: 'owner'
      });

      Lead.belongsTo(models.User, {
        foreignKey: 'created_by',
        as: 'creator'
      });

      Lead.belongsTo(models.Contact, {
        foreignKey: 'converted_contact_id',
        as: 'convertedContact'
      });

      Lead.belongsTo(models.Deal, {
        foreignKey: 'converted_deal_id',
        as: 'convertedDeal'
      });

      Lead.hasMany(models.Activity, {
        foreignKey: 'lead_id',
        as: 'activities'
      });
    }
  }

  Lead.init(
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
      first_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          notEmpty: { msg: 'First name is required' }
        }
      },
      last_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          notEmpty: { msg: 'Last name is required' }
        }
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: true,
        validate: {
          isEmail: { msg: 'Must be a valid email address' }
        }
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: true
      },
      company_name: {
        type: DataTypes.STRING(200),
        allowNull: true
      },
      job_title: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      lead_source: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM('new', 'contacted', 'qualified', 'unqualified', 'converted', 'lost'),
        allowNull: false,
        defaultValue: 'new'
      },
      score: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        validate: {
          min: { args: [0], msg: 'Score must be between 0 and 100' },
          max: { args: [100], msg: 'Score must be between 0 and 100' }
        }
      },
      score_reasoning: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      converted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      converted_contact_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'contacts', key: 'id' }
      },
      converted_deal_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'deals', key: 'id' }
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
      custom_fields: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {}
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' }
      },
      fullName: {
        type: DataTypes.VIRTUAL,
        get() {
          return `${this.first_name} ${this.last_name}`;
        }
      }
    },
    {
      sequelize,
      modelName: 'Lead',
      tableName: 'leads',
      timestamps: true,
      underscored: true,
      paranoid: true,
      indexes: [
        { fields: ['owner_id'] },
        { fields: ['status'] },
        { fields: ['lead_source'] },
        { fields: ['score'] },
        { fields: ['converted'] },
        { fields: ['created_at'] }
      ]
    }
  );

  return Lead;
};
