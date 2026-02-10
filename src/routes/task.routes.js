const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

// GET /stats - Must be before /:id to avoid matching "stats" as an ID
router.get('/stats', auth, checkPermission('tasks', 'read'), taskController.getStats);

// GET /board - Must be before /:id to avoid matching "board" as an ID
router.get('/board', auth, checkPermission('tasks', 'read'), taskController.getByStatus);

// GET / - Get all tasks
router.get('/', auth, checkPermission('tasks', 'read'), taskController.getAll);

// GET /:id - Get task by ID
router.get('/:id', auth, checkPermission('tasks', 'read'), taskController.getById);

// POST / - Create new task
router.post('/', auth, checkPermission('tasks', 'create'), taskController.create);

// PUT /:id - Update task
router.put('/:id', auth, checkPermission('tasks', 'update'), taskController.update);

// DELETE /:id - Delete task
router.delete('/:id', auth, checkPermission('tasks', 'delete'), taskController.delete);

module.exports = router;
