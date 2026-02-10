const pipelineService = require('../services/pipeline.service');
const ApiResponse = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');

class PipelineController {
  getAll = asyncHandler(async (req, res) => {
    const pipelines = await pipelineService.getAll();

    res.json(ApiResponse.success('Pipelines retrieved successfully', pipelines));
  });

  getById = asyncHandler(async (req, res) => {
    const pipeline = await pipelineService.getById(req.params.id);

    res.json(ApiResponse.success('Pipeline retrieved successfully', pipeline));
  });

  getDefault = asyncHandler(async (req, res) => {
    const pipeline = await pipelineService.getDefault();

    res.json(ApiResponse.success('Default pipeline retrieved successfully', pipeline));
  });
}

module.exports = new PipelineController();
