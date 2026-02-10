const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Setting extends Model {
    /**
     * Get the typed value based on setting_type
     * @returns {*} Parsed value based on type
     */
    getTypedValue() {
      const value = this.setting_value;
      const type = this.setting_type;

      if (value === null || value === undefined) {
        return null;
      }

      try {
        switch (type) {
          case 'boolean':
            return value === 'true' || value === '1' || value === 1 || value === true;
          case 'number':
            return Number(value);
          case 'integer':
            return parseInt(value, 10);
          case 'float':
            return parseFloat(value);
          case 'json':
            return typeof value === 'string' ? JSON.parse(value) : value;
          case 'array':
            return typeof value === 'string' ? JSON.parse(value) : value;
          case 'string':
          default:
            return String(value);
        }
      } catch (error) {
        console.error(`Error parsing setting value for ${this.setting_key}:`, error);
        return value;
      }
    }

    /**
     * Set the value and automatically store it as string
     * @param {*} value - Value to set
     */
    setTypedValue(value) {
      const type = this.setting_type;

      try {
        switch (type) {
          case 'json':
          case 'array':
            this.setting_value = typeof value === 'string' ? value : JSON.stringify(value);
            break;
          case 'boolean':
            this.setting_value = value ? 'true' : 'false';
            break;
          default:
            this.setting_value = String(value);
        }
      } catch (error) {
        console.error(`Error setting value for ${this.setting_key}:`, error);
        this.setting_value = String(value);
      }
    }
  }

  Setting.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      setting_key: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: {
          name: 'unique_setting_key',
          msg: 'Setting key already exists'
        },
        validate: {
          notNull: {
            msg: 'Setting key is required'
          },
          notEmpty: {
            msg: 'Setting key cannot be empty'
          },
          len: {
            args: [2, 100],
            msg: 'Setting key must be between 2 and 100 characters'
          },
          isValidKey(value) {
            // Allow lowercase letters, numbers, underscores, dots, and hyphens
            if (!/^[a-z0-9._-]+$/.test(value)) {
              throw new Error('Setting key can only contain lowercase letters, numbers, underscores, dots, and hyphens');
            }
          }
        },
        comment: 'Unique identifier for the setting (e.g., app.name, smtp.host)'
      },
      setting_value: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Setting value stored as text'
      },
      setting_type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'string',
        validate: {
          isIn: {
            args: [['string', 'number', 'integer', 'float', 'boolean', 'json', 'array', 'text']],
            msg: 'Invalid setting type'
          }
        },
        comment: 'Data type: string, number, integer, float, boolean, json, array, text'
      }
    },
    {
      sequelize,
      modelName: 'Setting',
      tableName: 'settings',
      timestamps: true,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['setting_key'],
          name: 'unique_setting_key'
        },
        {
          fields: ['setting_type'],
          name: 'idx_setting_type'
        }
      ]
    }
  );

  return Setting;
};
