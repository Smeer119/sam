const fs = require('fs-extra');
const openai = require('../config/openai');
const Logger = require('../utils/logger');

const logger = new Logger('whisper');

class WhisperService {
  constructor() {
    this.model = 'whisper-1';
  }

  /**
   * Transcribe audio file using OpenAI Whisper
   * @param {string} audioPath - Path to audio file
   * @param {string} language - Language code (optional)
   * @returns {Promise<string>} - Transcribed text
   */
  async transcribeAudio(audioPath, language = null) {
    logger.info('Starting audio transcription', { 
      audioPath, 
      language,
      model: this.model 
    });

    try {
      // Check if audio file exists
      if (!await fs.pathExists(audioPath)) {
        throw new Error(`Audio file not found: ${audioPath}`);
      }

      // Get file stats for logging
      const stats = await fs.stat(audioPath);
      logger.info('Audio file stats', { 
        size: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
        path: audioPath 
      });

      // Prepare transcription request
      const transcriptionOptions = {
        file: fs.createReadStream(audioPath),
        model: this.model,
        response_format: 'text'
      };

      // Add language if specified
      if (language) {
        transcriptionOptions.language = language;
        logger.info('Language specified for transcription', { language });
      }

      logger.info('Sending audio to OpenAI Whisper API...');

      // Call OpenAI Whisper API
      const transcription = await openai.audio.transcriptions.create(transcriptionOptions);

      logger.success('Audio transcription completed', { 
        textLength: transcription.length,
        preview: transcription.substring(0, 100) + '...'
      });

      return transcription;

    } catch (error) {
      logger.error('Audio transcription failed', error);
      
      // Handle specific OpenAI errors
      if (error.response) {
        logger.error('OpenAI API error details', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      }

      throw error;
    }
  }

  /**
   * Validate audio file format
   * @param {string} audioPath - Path to audio file
   * @returns {boolean} - Whether file format is supported
   */
  async validateAudioFormat(audioPath) {
    try {
      const supportedFormats = ['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm'];
      const fileExtension = audioPath.toLowerCase().substring(audioPath.lastIndexOf('.'));
      
      const isSupported = supportedFormats.includes(fileExtension);
      
      logger.info('Audio format validation', { 
        file: audioPath,
        extension: fileExtension,
        supported: isSupported 
      });

      return isSupported;
    } catch (error) {
      logger.error('Audio format validation failed', error);
      return false;
    }
  }

  /**
   * Get supported audio formats
   * @returns {Array<string>} - List of supported formats
   */
  getSupportedFormats() {
    return ['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm'];
  }
}

module.exports = WhisperService;
