const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Logger = require('../utils/logger');

const logger = new Logger('transcriber');

class TranscriberService {
  constructor() {
    this.tempDir = process.env.TEMP_DIR || './temp';
    this.ensureTempDir();
  }

  /**
   * Ensure temp directory exists
   */
  async ensureTempDir() {
    try {
      await fs.ensureDir(this.tempDir);
      logger.info('Temp directory ensured for transcriber', { path: this.tempDir });
    } catch (error) {
      logger.error('Failed to create temp directory', error);
      throw error;
    }
  }

  /**
   * Extract audio from video file using ffmpeg
   * @param {string} videoPath - Path to video file
   * @returns {Promise<string>} - Path to extracted audio file
   */
  async extractAudio(videoPath) {
    logger.info('Starting audio extraction from video', { videoPath });

    return new Promise(async (resolve, reject) => {
      try {
        // Check if video file exists
        if (!await fs.pathExists(videoPath)) {
          throw new Error(`Video file not found: ${videoPath}`);
        }

        // Generate unique audio file name
        const audioId = uuidv4();
        const audioPath = path.join(this.tempDir, `${audioId}.wav`);

        logger.info('Extracting audio using ffmpeg', { 
          input: videoPath,
          output: audioPath 
        });

        // Use ffmpeg to extract audio
        ffmpeg(videoPath)
          .toFormat('wav')
          .audioCodec('pcm_s16le')
          .audioChannels(1)
          .audioFrequency(16000)
          .on('start', (commandLine) => {
            logger.info('FFmpeg process started', { command: commandLine });
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              logger.info(`Audio extraction progress: ${Math.round(progress.percent)}%`);
            }
          })
          .on('end', () => {
            logger.success('Audio extraction completed successfully', { 
              audioPath,
              format: 'wav',
              codec: 'pcm_s16le'
            });
            resolve(audioPath);
          })
          .on('error', (error) => {
            logger.error('FFmpeg audio extraction failed', error);
            reject(error);
          })
          .save(audioPath);

      } catch (error) {
        logger.error('Audio extraction setup failed', error);
        reject(error);
      }
    });
  }

  /**
   * Get audio information from file
   * @param {string} audioPath - Path to audio file
   * @returns {Promise<Object>} - Audio metadata
   */
  async getAudioInfo(audioPath) {
    logger.info('Getting audio file information', { audioPath });

    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (error, metadata) => {
        if (error) {
          logger.error('Failed to get audio info', error);
          reject(error);
          return;
        }

        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
        
        if (!audioStream) {
          const error = new Error('No audio stream found in file');
          logger.error('Audio stream not found', error);
          reject(error);
          return;
        }

        const info = {
          duration: parseFloat(metadata.format.duration),
          bitRate: parseInt(metadata.format.bit_rate),
          codec: audioStream.codec_name,
          channels: audioStream.channels,
          sampleRate: parseInt(audioStream.sample_rate),
          size: parseInt(metadata.format.size)
        };

        logger.info('Audio file information retrieved', info);
        resolve(info);
      });
    });
  }

  /**
   * Clean up audio file
   * @param {string} audioPath - Path to audio file to delete
   */
  async cleanup(audioPath) {
    try {
      if (await fs.pathExists(audioPath)) {
        await fs.remove(audioPath);
        logger.info('Cleaned up audio file', { path: audioPath });
      }
    } catch (error) {
      logger.error('Audio cleanup failed', error);
    }
  }

  /**
   * Validate video file format for audio extraction
   * @param {string} videoPath - Path to video file
   * @returns {boolean} - Whether file format is supported
   */
  async validateVideoFormat(videoPath) {
    try {
      const supportedFormats = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv'];
      const fileExtension = videoPath.toLowerCase().substring(videoPath.lastIndexOf('.'));
      
      const isSupported = supportedFormats.includes(fileExtension);
      
      logger.info('Video format validation', { 
        file: videoPath,
        extension: fileExtension,
        supported: isSupported 
      });

      return isSupported;
    } catch (error) {
      logger.error('Video format validation failed', error);
      return false;
    }
  }
}

module.exports = TranscriberService;
