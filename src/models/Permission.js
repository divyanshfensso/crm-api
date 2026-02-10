const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Permission extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Permission.belongsToMany(models.Role, {
        through: models.RolePermission,
        foreignKey: 'permission_id',
        otherKey: 'role_id',
        as: 'roles'
      });
    }
  }

  Permission.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      module: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
          notNull: {
            msg: 'Module is required'
          },
          notEmpty: {
            msg: 'Module cannot be empty'
          },
          len: {
            args: [2, 50],
            msg: 'Module must be between 2 and 50 characters'
          },
          isLowercase: {
            msg: 'Module must be in lowercase'
          },
          isAlphanumericWithUnderscore(value) {
            if (!/^[a-z0-9_]+$/.test(value)) {
              throw new Error('Module can only contain lowercase letters, numbers, and underscores');
            }
          }
        }
      },
      action: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
          notNull: {
            msg: 'Action is required'
          },
          notEmpty: {
            msg: 'Action cannot be empty'
          },
          len: {
            args: [2, 50],
            msg: 'Action must be between 2 and 50 characters'
          },
          isLowercase: {
            msg: 'Action must be in lowercase'
          },
          isAlphanumericWithUnderscore(value) {
            if (!/^[a-z0-9_]+$/.test(value)) {
              throw new Error('Action can only contain lowercase letters, numbers, and underscores');
            }
          }
        }
      },
      description: {
        type: DataTypes.STRING(255),
        allowNull: true,
        validate: {
          len: {
            args: [0, 255],
            msg: 'Description must not exceed 255 characters'
          }
        }
      }
    },
    {
      sequelize,
      modelName: 'Permission',
      tableName: 'permissions',
      timestamps: false,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['module', 'action'],
          name: 'unique_module_action'
        },
        {
          fields: ['module']
        },
        {
          fields: ['action']
        }
      ]
    }
  );

  return Permission;
};
