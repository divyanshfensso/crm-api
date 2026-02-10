const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activity.controller');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

router.get(
  '/',
  auth,
  checkPermission('activities', 'read'),
  activityController.getAll
);

router.get(
  '/recent',
  auth,
  checkPermission('activities', 'read'),
  activityController.getRecent
);

router.get(
  '/:id',
  auth,
  checkPermission('activities', 'read'),
  activityController.getById
);

router.post(
  '/',
  auth,
  checkPermission('activities', 'create'),
  activityController.create
);

router.put(
  '/:id',
  auth,
  checkPermission('activities', 'update'),
  activityController.update
);

router.delete(
  '/:id',
  auth,
  checkPermission('activities', 'delete'),
  activityController.delete
);

module.exports = router;
