const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Returns user object without sensitive fields
     * @returns {Object} Safe user object
     */
    toSafeObject() {
      const { password_hash, refresh_token, ...safeUser } = this.toJSON();
      return safeUser;
    }

    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      User.belongsToMany(models.Role, {
        through: models.UserRole,
        foreignKey: 'user_id',
        otherKey: 'role_id',
        as: 'roles'
      });

      User.hasMany(models.AuditLog, {
        foreignKey: 'user_id',
        as: 'auditLogs'
      });

      User.hasMany(models.GdprConsent, {
        foreignKey: 'user_id',
        as: 'gdprConsents'
      });

      User.hasMany(models.Contact, {
        foreignKey: 'owner_id',
        as: 'ownedContacts'
      });

      User.hasMany(models.Company, {
        foreignKey: 'owner_id',
        as: 'ownedCompanies'
      });

      User.hasMany(models.Lead, {
        foreignKey: 'owner_id',
        as: 'ownedLeads'
      });

      User.hasMany(models.Deal, {
        foreignKey: 'owner_id',
        as: 'ownedDeals'
      });

      User.hasMany(models.Activity, {
        foreignKey: 'user_id',
        as: 'activities'
      });
    }
  }

  User.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: {
          name: 'unique_email',
          msg: 'Email address already exists'
        },
        validate: {
          isEmail: {
            msg: 'Must be a valid email address'
          },
          notNull: {
            msg: 'Email is required'
          },
          notEmpty: {
            msg: 'Email cannot be empty'
          }
        }
      },
      password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          notNull: {
            msg: 'Password hash is required'
          },
          notEmpty: {
            msg: 'Password hash cannot be empty'
          }
        }
      },
      first_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          notNull: {
            msg: 'First name is required'
          },
          notEmpty: {
            msg: 'First name cannot be empty'
          },
          len: {
            args: [1, 100],
            msg: 'First name must be between 1 and 100 characters'
          }
        }
      },
      last_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          notNull: {
            msg: 'Last name is required'
          },
          notEmpty: {
            msg: 'Last name cannot be empty'
          },
          len: {
            args: [1, 100],
            msg: 'Last name must be between 1 and 100 characters'
          }
        }
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
        validate: {
          is: {
            args: /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/i,
            msg: 'Phone number format is invalid'
          }
        }
      },
      avatar: {
        type: DataTypes.STRING(500),
        allowNull: true,
        validate: {
          isUrl: {
            msg: 'Avatar must be a valid URL'
          }
        }
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'suspended'),
        allowNull: false,
        defaultValue: 'active',
        validate: {
          isIn: {
            args: [['active', 'inactive', 'suspended']],
            msg: 'Status must be one of: active, inactive, suspended'
          }
        }
      },
      email_verified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      last_login: {
        type: DataTypes.DATE,
        allowNull: true
      },
      refresh_token: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      // Virtual field for full name
      fullName: {
        type: DataTypes.VIRTUAL,
        get() {
          return `${this.first_name} ${this.last_name}`;
        },
        set(value) {
          throw new Error('Do not try to set the `fullName` value!');
        }
      }
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      timestamps: true,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['email']
        },
        {
          fields: ['status']
        },
        {
          fields: ['email_verified']
        },
        {
          fields: ['created_at']
        }
      ],
      hooks: {
        beforeCreate: (user) => {
          // Normalize email to lowercase
          if (user.email) {
            user.email = user.email.toLowerCase().trim();
          }
        },
        beforeUpdate: (user) => {
          // Normalize email to lowercase
          if (user.email) {
            user.email = user.email.toLowerCase().trim();
          }
        }
      }
    }
  );

  return User;
};
