const express = require('express');
const router = express.Router();
const { getConfig, saveConfig } = require('../controllers/configController');
const { getDashboardStats } = require('../controllers/dashboardController');
const { syncAll } = require('../controllers/syncController');
const { protect, authorize } = require('../middleware/authMiddleware');

// GET /api/config
router.get('/config', protect, getConfig);

// POST /api/config — Admin only
router.post('/config', protect, authorize('Admin'), saveConfig);

// GET /api/dashboard/stats
router.get('/dashboard/stats', protect, getDashboardStats);

// POST /api/sync — Sync all frontend state to MySQL
router.post('/sync', protect, syncAll);

module.exports = router;
