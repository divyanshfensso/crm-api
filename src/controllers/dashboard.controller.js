const dashboardService = require('../services/dashboard.service');
const ApiResponse = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');

class DashboardController {
  getStats = asyncHandler(async (req, res) => {
    const stats = await dashboardService.getStats();

    res.json(ApiResponse.success('Dashboard statistics retrieved successfully', stats));
  });

  getPipelineData = asyncHandler(async (req, res) => {
    const pipelineId = req.query.pipelineId || null;
    const data = await dashboardService.getPipelineData(pipelineId);

    res.json(ApiResponse.success('Pipeline data retrieved successfully', data));
  });

  getRevenueData = asyncHandler(async (req, res) => {
    const period = req.query.period || 'monthly';
    const data = await dashboardService.getRevenueData(period);

    res.json(ApiResponse.success('Revenue data retrieved successfully', data));
  });

  getRecentActivities = asyncHandler(async (req, res) => {
    const limit = req.query.limit || 10;
    const activities = await dashboardService.getRecentActivities(limit);

    res.json(ApiResponse.success('Recent activities retrieved successfully', activities));
  });

  getUpcomingEvents = asyncHandler(async (req, res) => {
    const limit = req.query.limit || 5;
    const events = await dashboardService.getUpcomingEvents(limit);
    res.json(ApiResponse.success('Upcoming events retrieved successfully', events));
  });

  getLeadSourceData = asyncHandler(async (req, res) => {
    const data = await dashboardService.getLeadSourceData();

    res.json(ApiResponse.success('Lead source data retrieved successfully', data));
  });
}

module.exports = new DashboardController();
