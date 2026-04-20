const router = require('express').Router();
const ClassTypesController = require('../controllers/ClassTypesController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.get('/', authenticateToken, ClassTypesController.list);
router.post('/', authenticateToken, authorizeRoles('admin'), ClassTypesController.create);
router.put('/:id', authenticateToken, authorizeRoles('admin'), ClassTypesController.update);
router.delete('/:id', authenticateToken, authorizeRoles('admin'), ClassTypesController.remove);

module.exports = router;
