const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Pipeline extends Model {
    static associate(models) {
      Pipeline.hasMany(models.PipelineStage, {
        foreignKey: 'pipeline_id',
        as: 'stages'
      });

      Pipeline.hasMany(models.Deal, {
        foreignKey: 'pipeline_id',
        as: 'deals'
      });
    }
  }

  Pipeline.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          notEmpty: { msg: 'Pipeline name is required' }
        }
      },
      is_default: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }
    },
    {
      sequelize,
      modelName: 'Pipeline',
      tableName: 'pipelines',
      timestamps: true,
      underscored: true
    }
  );

  return Pipeline;
};
