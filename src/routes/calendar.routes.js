const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendar.controller');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

// GET / - Get all calendar events
router.get('/', auth, checkPermission('calendar', 'read'), calendarController.getAll);

// GET /:id - Get calendar event by ID
router.get('/:id', auth, checkPermission('calendar', 'read'), calendarController.getById);

// POST / - Create new calendar event
router.post('/', auth, checkPermission('calendar', 'create'), calendarController.create);

// PUT /:id - Update calendar event
router.put('/:id', auth, checkPermission('calendar', 'update'), calendarController.update);

// DELETE /:id - Delete calendar event
router.delete('/:id', auth, checkPermission('calendar', 'delete'), calendarController.delete);

module.exports = router;
