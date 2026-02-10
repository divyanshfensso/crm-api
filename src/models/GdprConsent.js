const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class GdprConsent extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      GdprConsent.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user'
      });
    }
  }

  GdprConsent.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        validate: {
          notNull: {
            msg: 'User ID is required'
          }
        }
      },
      consent_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
          notNull: {
            msg: 'Consent type is required'
          },
          notEmpty: {
            msg: 'Consent type cannot be empty'
          },
          len: {
            args: [2, 50],
            msg: 'Consent type must be between 2 and 50 characters'
          },
          isIn: {
            args: [['data_processing', 'marketing', 'analytics', 'third_party_sharing', 'cookies']],
            msg: 'Invalid consent type'
          }
        },
        comment: 'Type of consent: data_processing, marketing, analytics, third_party_sharing, cookies'
      },
      status: {
        type: DataTypes.ENUM('granted', 'withdrawn'),
        allowNull: false,
        validate: {
          notNull: {
            msg: 'Consent status is required'
          },
          isIn: {
            args: [['granted', 'withdrawn']],
            msg: 'Status must be either granted or withdrawn'
          }
        }
      },
      ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
        comment: 'IP address from which consent was given/withdrawn (IPv4 or IPv6)',
        validate: {
          isIP: {
            msg: 'Invalid IP address format'
          }
        }
      }
    },
    {
      sequelize,
      modelName: 'GdprConsent',
      tableName: 'gdpr_consents',
      timestamps: true,
      underscored: true,
      indexes: [
        {
          fields: ['user_id'],
          name: 'idx_gdpr_user_id'
        },
        {
          fields: ['consent_type'],
          name: 'idx_gdpr_consent_type'
        },
        {
          fields: ['status'],
          name: 'idx_gdpr_status'
        },
        {
          fields: ['user_id', 'consent_type', 'status'],
          name: 'idx_gdpr_user_consent_status'
        },
        {
          fields: ['created_at'],
          name: 'idx_gdpr_created_at'
        }
      ]
    }
  );

  return GdprConsent;
};
