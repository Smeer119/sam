const debug = require('debug');

// Create different debug loggers for different components
const loggers = {
  main: debug('video-analyzer:main'),
  downloader: debug('video-analyzer:downloader'),
  transcriber: debug('video-analyzer:transcriber'),
  whisper: debug('video-analyzer:whisper'),
  gpt: debug('video-analyzer:gpt'),
  controller: debug('video-analyzer:controller'),
  supabase: debug('video-analyzer:supabase'),
  ffmpeg: debug('video-analyzer:ffmpeg')
};

// Enhanced logger with timestamps and formatting
class Logger {
  constructor(component) {
    this.debug = loggers[component] || debug(`video-analyzer:${component}`);
  }

  info(message, data = null) {
    const timestamp = new Date().toISOString();
    if (data) {
      this.debug(`[INFO] ${timestamp} - ${message}`, data);
    } else {
      this.debug(`[INFO] ${timestamp} - ${message}`);
    }
  }

  error(message, error = null) {
    const timestamp = new Date().toISOString();
    if (error) {
      this.debug(`[ERROR] ${timestamp} - ${message}`, error);
    } else {
      this.debug(`[ERROR] ${timestamp} - ${message}`);
    }
  }

  warn(message, data = null) {
    const timestamp = new Date().toISOString();
    if (data) {
      this.debug(`[WARN] ${timestamp} - ${message}`, data);
    } else {
      this.debug(`[WARN] ${timestamp} - ${message}`);
    }
  }

  success(message, data = null) {
    const timestamp = new Date().toISOString();
    if (data) {
      this.debug(`[SUCCESS] ${timestamp} - ${message}`, data);
    } else {
      this.debug(`[SUCCESS] ${timestamp} - ${message}`);
    }
  }
}

module.exports = Logger;
