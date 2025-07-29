const YTDlpWrap = require('yt-dlp-wrap').default;
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Logger = require('../utils/logger');

const logger = new Logger('downloader');

/**
 * VideoDownloader handles downloading videos from all major social media platforms using yt-dlp
 * Supports: YouTube, Instagram, TikTok, Twitter/X, Facebook, LinkedIn, Snapchat, and many more
 */
class VideoDownloader {
  constructor() {
    this.tempDir = process.env.TEMP_DIR || './temp';
    this.ytDlp = new YTDlpWrap();
    this.ensureTempDir();
  }

  /**
   * Ensure temp directory exists
   */
  async ensureTempDir() {
    try {
      await fs.ensureDir(this.tempDir);
      logger.info('Temp directory ensured', { path: this.tempDir });
    } catch (error) {
      logger.error('Failed to create temp directory', error);
      throw error;
    }
  }

  /**
   * Download video from various social media platforms
   * @param {string} url - Video URL
   * @returns {Promise<string>} - Path to downloaded video file
   */
  /**
   * Download video from any supported social media platform using yt-dlp
   * @param {string} url - Video URL from any platform
   * @returns {Promise<string>} - Path to downloaded video file
   */
  async downloadVideo(url) {
    logger.info('Starting universal video download', { url });

    try {
      const videoId = uuidv4();
      const outputTemplate = path.join(this.tempDir, `${videoId}.%(ext)s`);
      
      logger.info('Downloading with yt-dlp', { outputTemplate });
      
      // Use yt-dlp to download video (supports all major platforms)
      const downloadResult = await this.ytDlp.execPromise([
        url,
        '--output', outputTemplate,
        '--format', 'best[ext=mp4]/best',
        '--no-playlist'
      ]);
      
      logger.info('yt-dlp download completed', { result: downloadResult });
      
      // Find the downloaded file
      const files = await fs.readdir(this.tempDir);
      const downloadedFile = files.find(file => file.startsWith(videoId));
      
      if (!downloadedFile) {
        throw new Error('Downloaded file not found');
      }
      
      const filePath = path.join(this.tempDir, downloadedFile);
      logger.success('Video downloaded successfully', { 
        path: filePath,
        platform: this.detectPlatform(url)
      });
      
      return filePath;
      
    } catch (error) {
      logger.error('Universal video download failed', error);
      throw new Error(`Failed to download video: ${error.message}`);
    }
  }

  /**
   * Download YouTube video
   * @param {string} url - YouTube URL
   * @returns {Promise<string>} - Path to downloaded video
   */
  /**
   * Detect the platform from URL
   * @param {string} url - Video URL
   * @returns {string} - Platform name
   */
  detectPlatform(url) {
    if (this.isYouTubeUrl(url)) return 'YouTube';
    if (this.isInstagramUrl(url)) return 'Instagram';
    if (this.isTwitterUrl(url)) return 'Twitter/X';
    if (this.isTikTokUrl(url)) return 'TikTok';
    if (this.isFacebookUrl(url)) return 'Facebook';
    if (this.isLinkedInUrl(url)) return 'LinkedIn';
    if (this.isSnapchatUrl(url)) return 'Snapchat';
    return 'Unknown';
  }

  /**
   * Check if URL is YouTube
   * @param {string} url - URL to check
   * @returns {boolean}
   */
  isYouTubeUrl(url) {
    return /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)/.test(url);
  }

  /**
   * Check if URL is Instagram
   * @param {string} url - URL to check
   * @returns {boolean}
   */
  isInstagramUrl(url) {
    return /(?:instagram\.com\/p\/|instagram\.com\/reel\/|instagram\.com\/tv\/)/.test(url);
  }

  /**
   * Check if URL is Twitter/X
   * @param {string} url - URL to check
   * @returns {boolean}
   */
  isTwitterUrl(url) {
    return /(?:twitter\.com\/.*\/status\/|x\.com\/.*\/status\/)/.test(url);
  }

  /**
   * Check if URL is TikTok
   * @param {string} url - URL to check
   * @returns {boolean}
   */
  isTikTokUrl(url) {
    return /(?:tiktok\.com\/@.*\/video\/|vm\.tiktok\.com\/)/.test(url);
  }

  /**
   * Check if URL is Facebook
   * @param {string} url - URL to check
   * @returns {boolean}
   */
  isFacebookUrl(url) {
    return /(?:facebook\.com\/.*\/videos\/|fb\.watch\/)/.test(url);
  }

  /**
   * Check if URL is LinkedIn
   * @param {string} url - URL to check
   * @returns {boolean}
   */
  isLinkedInUrl(url) {
    return /(?:linkedin\.com\/posts\/|linkedin\.com\/feed\/update\/)/.test(url);
  }

  /**
   * Check if URL is Snapchat
   * @param {string} url - URL to check
   * @returns {boolean}
   */
  isSnapchatUrl(url) {
    return /(?:snapchat\.com\/spotlight\/)/.test(url);
  }

  /**
   * Clean up downloaded file
   * @param {string} filePath - Path to file to delete
   */
  async cleanup(filePath) {
    try {
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
        logger.info('Cleaned up file', { path: filePath });
      }
    } catch (error) {
      logger.error('Cleanup failed', error);
    }
  }
}

module.exports = VideoDownloader;
