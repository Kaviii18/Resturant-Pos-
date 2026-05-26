const express = require('express');
const router = express.Router();
const {
  getKitchenTickets,
  fireKitchenTicket,
  updateTicketStatus,
  updateTicketItemStatus,
} = require('../controllers/kotController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', getKitchenTickets);
router.post('/fire', fireKitchenTicket);
router.patch('/:id/status', updateTicketStatus);
router.patch('/:ticketId/items/:itemId/status', updateTicketItemStatus);

module.exports = router;
