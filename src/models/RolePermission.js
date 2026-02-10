const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class RolePermission extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // RolePermission belongs to Role
      RolePermission.belongsTo(models.Role, {
        foreignKey: 'role_id',
        as: 'role'
      });

      // RolePermission belongs to Permission
      RolePermission.belongsTo(models.Permission, {
        foreignKey: 'permission_id',
        as: 'permission'
      });
    }
  }

  RolePermission.init(
    {
      role_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
          model: 'roles',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        validate: {
          notNull: {
            msg: 'Role ID is required'
          }
        }
      },
      permission_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
          model: 'permissions',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        validate: {
          notNull: {
            msg: 'Permission ID is required'
          }
        }
      }
    },
    {
      sequelize,
      modelName: 'RolePermission',
      tableName: 'role_permissions',
      timestamps: false,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['role_id', 'permission_id'],
          name: 'unique_role_permission'
        },
        {
          fields: ['role_id']
        },
        {
          fields: ['permission_id']
        }
      ]
    }
  );

  return RolePermission;
};
