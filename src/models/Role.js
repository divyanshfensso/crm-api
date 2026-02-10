const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Role extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Role.belongsToMany(models.Permission, {
        through: models.RolePermission,
        foreignKey: 'role_id',
        otherKey: 'permission_id',
        as: 'permissions'
      });

      Role.belongsToMany(models.User, {
        through: models.UserRole,
        foreignKey: 'role_id',
        otherKey: 'user_id',
        as: 'users'
      });
    }
  }

  Role.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: {
          name: 'unique_role_name',
          msg: 'Role name already exists'
        },
        validate: {
          notNull: {
            msg: 'Role name is required'
          },
          notEmpty: {
            msg: 'Role name cannot be empty'
          },
          len: {
            args: [2, 50],
            msg: 'Role name must be between 2 and 50 characters'
          },
          isValidRoleName(value) {
            if (!/^[a-zA-Z0-9_ ]+$/.test(value)) {
              throw new Error('Role name can only contain letters, numbers, spaces, and underscores');
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
      },
      is_system: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'System roles cannot be deleted or modified'
      }
    },
    {
      sequelize,
      modelName: 'Role',
      tableName: 'roles',
      timestamps: true,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['name']
        },
        {
          fields: ['is_system']
        }
      ],
      hooks: {
        beforeDestroy: async (role) => {
          if (role.is_system) {
            throw new Error('System roles cannot be deleted');
          }
        },
        beforeUpdate: async (role) => {
          if (role.is_system && role.changed('name')) {
            throw new Error('System role names cannot be modified');
          }
        }
      }
    }
  );

  return Role;
};
