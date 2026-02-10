const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AuditLog extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      AuditLog.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user'
      });
    }
  }

  AuditLog.init(
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'NULL for system actions'
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
            args: [1, 50],
            msg: 'Action must be between 1 and 50 characters'
          }
        }
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
            args: [1, 50],
            msg: 'Module must be between 1 and 50 characters'
          }
        }
      },
      record_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'ID of the affected record'
      },
      old_values: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Previous values before update/delete',
        get() {
          const rawValue = this.getDataValue('old_values');
          if (typeof rawValue === 'string') {
            try {
              return JSON.parse(rawValue);
            } catch (e) {
              return rawValue;
            }
          }
          return rawValue;
        }
      },
      new_values: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'New values after create/update',
        get() {
          const rawValue = this.getDataValue('new_values');
          if (typeof rawValue === 'string') {
            try {
              return JSON.parse(rawValue);
            } catch (e) {
              return rawValue;
            }
          }
          return rawValue;
        }
      },
      ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
        comment: 'Supports both IPv4 and IPv6'
      },
      user_agent: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'Browser/client user agent string'
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    },
    {
      sequelize,
      modelName: 'AuditLog',
      tableName: 'audit_logs',
      timestamps: false,
      underscored: true,
      indexes: [
        {
          fields: ['module', 'action'],
          name: 'idx_audit_module_action'
        },
        {
          fields: ['user_id'],
          name: 'idx_audit_user_id'
        },
        {
          fields: ['created_at'],
          name: 'idx_audit_created_at'
        },
        {
          fields: ['module', 'record_id'],
          name: 'idx_audit_module_record'
        }
      ]
    }
  );

  return AuditLog;
};
