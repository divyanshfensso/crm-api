const express = require('express');
const router = express.Router();
const customFieldController = require('../controllers/customField.controller');
const { auth } = require('../middleware/auth');

// All routes require auth — no RBAC permission needed (users manage their own fields)

// Static routes before parameterized
router.get('/all', auth, customFieldController.getAll);
router.post('/bulk', auth, customFieldController.bulkCreate);

// Standard CRUD
router.get('/', auth, customFieldController.getByEntity);
router.post('/', auth, customFieldController.create);
router.put('/:id', auth, customFieldController.update);
router.delete('/:id', auth, customFieldController.delete);

module.exports = router;
