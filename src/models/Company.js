const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Company extends Model {
    static associate(models) {
      Company.belongsTo(models.User, {
        foreignKey: 'owner_id',
        as: 'owner'
      });

      Company.belongsTo(models.User, {
        foreignKey: 'created_by',
        as: 'creator'
      });

      Company.belongsTo(models.Company, {
        foreignKey: 'parent_company_id',
        as: 'parentCompany'
      });

      Company.hasMany(models.Company, {
        foreignKey: 'parent_company_id',
        as: 'subsidiaries'
      });

      Company.hasMany(models.Contact, {
        foreignKey: 'company_id',
        as: 'contacts'
      });

      Company.hasMany(models.Deal, {
        foreignKey: 'company_id',
        as: 'deals'
      });

      Company.hasMany(models.Activity, {
        foreignKey: 'company_id',
        as: 'activities'
      });
    }
  }

  Company.init(
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
      name: {
        type: DataTypes.STRING(200),
        allowNull: false,
        validate: {
          notEmpty: { msg: 'Company name is required' },
          len: { args: [1, 200], msg: 'Company name must be between 1 and 200 characters' }
        }
      },
      industry: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      website: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: true
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: true,
        validate: {
          isEmail: { msg: 'Must be a valid email address' }
        }
      },
      employee_count: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      annual_revenue: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true
      },
      address_line1: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      address_line2: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      city: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      state: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      country: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      zip_code: {
        type: DataTypes.STRING(20),
        allowNull: true
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      health_score: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 50,
        validate: {
          min: { args: [0], msg: 'Health score must be between 0 and 100' },
          max: { args: [100], msg: 'Health score must be between 0 and 100' }
        }
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
      parent_company_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'companies', key: 'id' }
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' }
      }
    },
    {
      sequelize,
      modelName: 'Company',
      tableName: 'companies',
      timestamps: true,
      underscored: true,
      paranoid: true,
      indexes: [
        { fields: ['owner_id'] },
        { fields: ['name'] },
        { fields: ['industry'] },
        { fields: ['created_at'] }
      ]
    }
  );

  return Company;
};
