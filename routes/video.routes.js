const express = require('express');
const VideoController = require('../controllers/video.controller');
const Logger = require('../utils/logger');

const router = express.Router();
const videoController = new VideoController();
const logger = new Logger('routes');

// Middleware for request logging
router.use((req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

/**
 * POST /api/video/analyze
 * Analyze video content from URL
 * Body: { url: string }
 */
router.post('/analyze', async (req, res) => {
  await videoController.analyzeVideo(req, res);
});

/**
 * GET /api/video/status
 * Get service status
 */
router.get('/status', async (req, res) => {
  await videoController.getStatus(req, res);
});

/**
 * GET /api/video/health
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
  await videoController.healthCheck(req, res);
});

module.exports = router;
