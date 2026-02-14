const express = require('express');
const router = express.Router();
const forecastController = require('../controllers/forecast.controller');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

router.get(
  '/summary',
  auth,
  checkPermission('dashboard', 'read'),
  forecastController.getSummary
);

router.get(
  '/by-month',
  auth,
  checkPermission('dashboard', 'read'),
  forecastController.getByMonth
);

router.get(
  '/by-rep',
  auth,
  checkPermission('dashboard', 'read'),
  forecastController.getByRep
);

router.get(
  '/by-stage',
  auth,
  checkPermission('dashboard', 'read'),
  forecastController.getByStage
);

router.get(
  '/vs-actual',
  auth,
  checkPermission('dashboard', 'read'),
  forecastController.getVsActual
);

module.exports = router;
