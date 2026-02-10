const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PipelineStage extends Model {
    static associate(models) {
      PipelineStage.belongsTo(models.Pipeline, {
        foreignKey: 'pipeline_id',
        as: 'pipeline'
      });

      PipelineStage.hasMany(models.Deal, {
        foreignKey: 'stage_id',
        as: 'deals'
      });
    }
  }

  PipelineStage.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      pipeline_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'pipelines', key: 'id' }
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          notEmpty: { msg: 'Stage name is required' }
        }
      },
      position: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      color: {
        type: DataTypes.STRING(7),
        allowNull: true,
        defaultValue: '#0072BC'
      },
      probability: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        validate: {
          min: { args: [0], msg: 'Probability must be between 0 and 100' },
          max: { args: [100], msg: 'Probability must be between 0 and 100' }
        }
      }
    },
    {
      sequelize,
      modelName: 'PipelineStage',
      tableName: 'pipeline_stages',
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ['pipeline_id', 'position'] }
      ]
    }
  );

  return PipelineStage;
};
