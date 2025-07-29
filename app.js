const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
require('dotenv').config();

const videoRoutes = require('./routes/video.routes');
const Logger = require('./utils/logger');

const logger = new Logger('main');

class App {
  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    this.ensureDirectories();
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    logger.info('Setting up middleware');

    // CORS configuration
    this.app.use(cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Static files for frontend
    this.app.use(express.static(path.join(__dirname, 'public')));

    // Request logging middleware
    this.app.use((req, res, next) => {
      logger.info('HTTP Request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
      next();
    });

    logger.success('Middleware setup completed');
  }

  /**
   * Setup application routes
   */
  setupRoutes() {
    logger.info('Setting up routes');

    // API routes
    this.app.use('/api/video', videoRoutes);

    // Root route - serve frontend
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // API documentation route
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'Video Content Analyzer API',
        version: '1.0.0',
        description: 'Backend system for analyzing video content to generate hooks, CTAs, and USPs',
        endpoints: {
          'POST /api/video/analyze': 'Analyze video content from URL',
          'GET /api/video/status': 'Get service status',
          'GET /api/video/health': 'Health check endpoint'
        },
        documentation: {
          analyze: {
            method: 'POST',
            url: '/api/video/analyze',
            body: { url: 'string (required) - Video URL to analyze' },
            response: 'Server-Sent Events stream with progress updates'
          }
        }
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      logger.warn('Route not found', { url: req.originalUrl, method: req.method });
      res.status(404).json({
        error: 'Route not found',
        message: `Cannot ${req.method} ${req.originalUrl}`,
        availableRoutes: [
          'GET /',
          'GET /api',
          'POST /api/video/analyze',
          'GET /api/video/status',
          'GET /api/video/health'
        ]
      });
    });

    logger.success('Routes setup completed');
  }

  /**
   * Setup error handling middleware
   */
  setupErrorHandling() {
    logger.info('Setting up error handling');

    // Global error handler
    this.app.use((error, req, res, next) => {
      logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method
      });

      res.status(error.status || 500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
        timestamp: new Date().toISOString()
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', { reason, promise });
      process.exit(1);
    });

    logger.success('Error handling setup completed');
  }

  /**
   * Ensure required directories exist
   */
  async ensureDirectories() {
    try {
      const directories = [
        process.env.TEMP_DIR || './temp',
        './public'
      ];

      for (const dir of directories) {
        await fs.ensureDir(dir);
        logger.info('Directory ensured', { path: dir });
      }

      logger.success('All required directories ensured');
    } catch (error) {
      logger.error('Failed to ensure directories', error);
      throw error;
    }
  }

  /**
   * Get Express app instance
   * @returns {Express} Express application instance
   */
  getApp() {
    return this.app;
  }
}

module.exports = App;
