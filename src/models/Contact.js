const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Contact extends Model {
    static associate(models) {
      Contact.belongsTo(models.User, {
        foreignKey: 'owner_id',
        as: 'owner'
      });

      Contact.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company'
      });

      Contact.belongsTo(models.User, {
        foreignKey: 'created_by',
        as: 'creator'
      });

      Contact.hasMany(models.Deal, {
        foreignKey: 'contact_id',
        as: 'deals'
      });

      Contact.hasMany(models.Activity, {
        foreignKey: 'contact_id',
        as: 'activities'
      });

      Contact.hasMany(models.Lead, {
        foreignKey: 'converted_contact_id',
        as: 'convertedLeads'
      });
    }
  }

  Contact.init(
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
          notEmpty: { msg: 'First name is required' },
          len: { args: [1, 100], msg: 'First name must be between 1 and 100 characters' }
        }
      },
      last_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          notEmpty: { msg: 'Last name is required' },
          len: { args: [1, 100], msg: 'Last name must be between 1 and 100 characters' }
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
      mobile: {
        type: DataTypes.STRING(20),
        allowNull: true
      },
      company_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'companies', key: 'id' }
      },
      job_title: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      department: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      lead_source: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'prospect', 'customer', 'churned'),
        allowNull: false,
        defaultValue: 'active'
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
      modelName: 'Contact',
      tableName: 'contacts',
      timestamps: true,
      underscored: true,
      paranoid: true,
      indexes: [
        { fields: ['owner_id'] },
        { fields: ['company_id'] },
        { fields: ['email'] },
        { fields: ['status'] },
        { fields: ['lead_source'] },
        { fields: ['created_at'] }
      ]
    }
  );

  return Contact;
};
