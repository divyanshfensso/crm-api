const express = require('express');
const router = express.Router();
const pipelineController = require('../controllers/pipeline.controller');
const { auth } = require('../middleware/auth');

router.get(
  '/',
  auth,
  pipelineController.getAll
);

router.get(
  '/default',
  auth,
  pipelineController.getDefault
);

router.get(
  '/:id',
  auth,
  pipelineController.getById
);

module.exports = router;
