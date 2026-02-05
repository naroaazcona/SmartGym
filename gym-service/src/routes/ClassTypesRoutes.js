const router = require('express').Router();
const ClassTypesController = require('../controllers/ClassTypesController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.get('/', ClassTypesController.list);
router.post('/', authenticateToken, authorizeRoles('admin'), ClassTypesController.create);

module.exports = router;
