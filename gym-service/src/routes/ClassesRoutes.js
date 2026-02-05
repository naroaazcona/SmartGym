const router = require('express').Router();
const ClassesController = require('../controllers/ClassesController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.get('/', ClassesController.list);
// Reservas del usuario autenticado (poner antes de :id para no colisionar)
router.get('/me/reservations', authenticateToken, authorizeRoles('member', 'trainer', 'admin'), ClassesController.myReservations);
router.get('/:id', ClassesController.get);

router.post('/', authenticateToken, authorizeRoles('admin', 'trainer'), ClassesController.create);
router.get('/:id/reservations', authenticateToken, authorizeRoles('admin', 'trainer'), ClassesController.reservations);

router.post('/:id/reserve', authenticateToken, authorizeRoles('member'), ClassesController.reserve);
router.post('/:id/cancel', authenticateToken, authorizeRoles('member'), ClassesController.cancel);

router.put('/:id', authenticateToken, authorizeRoles('admin', 'trainer'), ClassesController.update);
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'trainer'), ClassesController.remove);

module.exports = router;
