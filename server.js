// server.js
// Entry point for Video Content Analyzer backend
// Loads the Express app and starts the server

require('dotenv').config(); // Load environment variables from .env
const App = require('./app'); // Import the Express app class
const Logger = require('./utils/logger');

const logger = new Logger('main');

// Get port from environment or default to 3000
const PORT = process.env.PORT || 3000;

// Create app instance
const appInstance = new App();
const app = appInstance.getApp();

// Start server
app.listen(PORT, () => {
  logger.success(`Server is running on http://localhost:${PORT}`);
  logger.info('Press Ctrl+C to stop the server');
});

// Handle server errors
app.on('error', (err) => {
  logger.error('Server error', err);
  process.exit(1);
});
