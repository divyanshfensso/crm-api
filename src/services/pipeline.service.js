const { Pipeline, PipelineStage } = require('../models');
const ApiError = require('../utils/apiError');

class PipelineService {
  async getAll() {
    const pipelines = await Pipeline.findAll({
      include: [
        {
          model: PipelineStage,
          as: 'stages',
          separate: true,
          order: [['position', 'ASC']]
        }
      ],
      order: [['name', 'ASC']]
    });

    return pipelines;
  }

  async getById(id) {
    const pipeline = await Pipeline.findByPk(id, {
      include: [
        {
          model: PipelineStage,
          as: 'stages',
          separate: true,
          order: [['position', 'ASC']]
        }
      ]
    });

    if (!pipeline) {
      throw ApiError.notFound('Pipeline not found');
    }

    return pipeline;
  }

  async getDefault() {
    const pipeline = await Pipeline.findOne({
      where: { is_default: true },
      include: [
        {
          model: PipelineStage,
          as: 'stages',
          separate: true,
          order: [['position', 'ASC']]
        }
      ]
    });

    if (!pipeline) {
      throw ApiError.notFound('No default pipeline found');
    }

    return pipeline;
  }
}

module.exports = new PipelineService();
