const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

router.get(
  '/stats',
  auth,
  checkPermission('dashboard', 'read'),
  dashboardController.getStats
);

router.get(
  '/pipeline',
  auth,
  checkPermission('dashboard', 'read'),
  dashboardController.getPipelineData
);

router.get(
  '/revenue',
  auth,
  checkPermission('dashboard', 'read'),
  dashboardController.getRevenueData
);

router.get(
  '/activities',
  auth,
  checkPermission('dashboard', 'read'),
  dashboardController.getRecentActivities
);

router.get(
  '/events',
  auth,
  checkPermission('dashboard', 'read'),
  dashboardController.getUpcomingEvents
);

router.get(
  '/lead-sources',
  auth,
  checkPermission('dashboard', 'read'),
  dashboardController.getLeadSourceData
);

module.exports = router;
