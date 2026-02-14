const forecastService = require('../services/forecast.service');
const ApiResponse = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');

class ForecastController {
  getSummary = asyncHandler(async (req, res) => {
    const data = await forecastService.getSummary(req.query);
    res.json(ApiResponse.success('Forecast summary retrieved successfully', data));
  });

  getByMonth = asyncHandler(async (req, res) => {
    const data = await forecastService.getByMonth(req.query);
    res.json(ApiResponse.success('Monthly forecast retrieved successfully', data));
  });

  getByRep = asyncHandler(async (req, res) => {
    const data = await forecastService.getByRep(req.query);
    res.json(ApiResponse.success('Forecast by rep retrieved successfully', data));
  });

  getByStage = asyncHandler(async (req, res) => {
    const data = await forecastService.getByStage(req.query);
    res.json(ApiResponse.success('Forecast by stage retrieved successfully', data));
  });

  getVsActual = asyncHandler(async (req, res) => {
    const data = await forecastService.getVsActual(req.query);
    res.json(ApiResponse.success('Forecast vs actual retrieved successfully', data));
  });
}

module.exports = new ForecastController();
