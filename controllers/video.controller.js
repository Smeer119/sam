const VideoDownloader = require('../services/downloader');
const TranscriberService = require('../services/transcriber');
const WhisperService = require('../services/whisper');
const GPTService = require('../services/gpt');
const supabase = require('../config/supabase');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Logger = require('../utils/logger');

const logger = new Logger('controller');

class VideoController {
  constructor() {
    this.downloader = new VideoDownloader();
    this.transcriber = new TranscriberService();
    this.whisper = new WhisperService();
    this.gpt = new GPTService();
    this.bucketName = process.env.STORAGE_BUCKET || 'content';
  }

  /**
   * Process video URL and return analysis
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async analyzeVideo(req, res) {
    const startTime = Date.now();
    const sessionId = uuidv4();
    
    logger.info('Starting video analysis session', { 
      sessionId,
      url: req.body.url,
      userAgent: req.get('User-Agent')
    });

    // Send initial response to client
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const sendProgress = (step, message, data = null) => {
      const progressData = {
        sessionId,
        step,
        message,
        timestamp: new Date().toISOString(),
        data
      };
      res.write(`data: ${JSON.stringify(progressData)}\n\n`);
      logger.info(`[${sessionId}] ${step}: ${message}`, data);
    };

    let videoPath = null;
    let audioPath = null;
    let supabaseVideoUrl = null;

    try {
      const { url } = req.body;

      if (!url) {
        throw new Error('Video URL is required');
      }

      sendProgress('validation', 'Validating video URL', { url });

      // Step 1: Download video
      sendProgress('download', 'Starting video download...');
      videoPath = await this.downloader.downloadVideo(url);
      sendProgress('download', 'Video downloaded successfully', { path: videoPath });

      // Step 2: Upload to Supabase
      sendProgress('upload', 'Uploading video to Supabase storage...');
      supabaseVideoUrl = await this.uploadToSupabase(videoPath, sessionId);
      sendProgress('upload', 'Video uploaded to Supabase', { url: supabaseVideoUrl });

      // Step 3: Extract audio
      sendProgress('extraction', 'Extracting audio from video...');
      audioPath = await this.transcriber.extractAudio(videoPath);
      sendProgress('extraction', 'Audio extracted successfully', { path: audioPath });

      // Step 4: Transcribe audio
      sendProgress('transcription', 'Transcribing audio with OpenAI Whisper...');
      const transcript = await this.whisper.transcribeAudio(audioPath);
      sendProgress('transcription', 'Audio transcribed successfully', { 
        length: transcript.length,
        preview: transcript.substring(0, 100) + '...'
      });

      // Step 5: Analyze content with GPT
      sendProgress('analysis', 'Analyzing content with GPT-4...');
      const analysis = await this.gpt.analyzeContent(transcript);
      sendProgress('analysis', 'Content analysis completed', analysis);

      // Step 6: Prepare final response
      const processingTime = Date.now() - startTime;
      const finalResult = {
        sessionId,
        success: true,
        processingTime: `${processingTime}ms`,
        videoUrl: supabaseVideoUrl,
        transcript,
        analysis,
        metadata: {
          originalUrl: url,
          processedAt: new Date().toISOString(),
          steps: ['download', 'upload', 'extraction', 'transcription', 'analysis']
        }
      };

      sendProgress('complete', 'Video analysis completed successfully', finalResult);
      
      // Send final result
      res.write(`data: ${JSON.stringify({ type: 'final', result: finalResult })}\n\n`);
      res.end();

      logger.success('Video analysis session completed', {
        sessionId,
        processingTime: `${processingTime}ms`,
        success: true
      });

    } catch (error) {
      logger.error('Video analysis session failed', { sessionId, error: error.message });
      
      const errorResponse = {
        sessionId,
        success: false,
        error: error.message,
        processingTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString()
      };

      sendProgress('error', 'Analysis failed', errorResponse);
      res.write(`data: ${JSON.stringify({ type: 'error', error: errorResponse })}\n\n`);
      res.end();

    } finally {
      // Cleanup temporary files
      await this.cleanup(videoPath, audioPath, sessionId);
    }
  }

  /**
   * Upload video file to Supabase storage
   * @param {string} videoPath - Local path to video file
   * @param {string} sessionId - Session identifier
   * @returns {Promise<string>} - Public URL of uploaded video
   */
  async uploadToSupabase(videoPath, sessionId) {
    logger.info('Starting Supabase upload', { videoPath, sessionId });

    try {
      // Read video file
      const videoBuffer = await fs.readFile(videoPath);
      const fileName = `${sessionId}_${Date.now()}.mp4`;

      logger.info('Uploading to Supabase storage', { 
        bucket: this.bucketName,
        fileName,
        fileSize: `${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`
      });

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .upload(fileName, videoBuffer, {
          contentType: 'video/mp4',
          upsert: false
        });

      if (error) {
        throw new Error(`Supabase upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from(this.bucketName)
        .getPublicUrl(fileName);

      const publicUrl = publicUrlData.publicUrl;

      logger.success('Video uploaded to Supabase successfully', {
        fileName,
        publicUrl,
        path: data.path
      });

      return publicUrl;

    } catch (error) {
      logger.error('Supabase upload failed', error);
      throw error;
    }
  }

  /**
   * Clean up temporary files
   * @param {string} videoPath - Path to video file
   * @param {string} audioPath - Path to audio file
   * @param {string} sessionId - Session identifier
   */
  async cleanup(videoPath, audioPath, sessionId) {
    logger.info('Starting cleanup process', { sessionId });

    try {
      if (videoPath) {
        await this.downloader.cleanup(videoPath);
      }
      
      if (audioPath) {
        await this.transcriber.cleanup(audioPath);
      }

      logger.success('Cleanup completed', { sessionId });
    } catch (error) {
      logger.error('Cleanup failed', { sessionId, error });
    }
  }

  /**
   * Get analysis status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getStatus(req, res) {
    try {
      const status = {
        service: 'Video Content Analyzer',
        status: 'operational',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        features: {
          videoDownload: 'YouTube supported, Instagram/Twitter in development',
          audioExtraction: 'FFmpeg integration',
          transcription: 'OpenAI Whisper',
          contentAnalysis: 'GPT-4 Turbo',
          storage: 'Supabase Storage'
        }
      };

      logger.info('Status check requested', status);
      res.json(status);
    } catch (error) {
      logger.error('Status check failed', error);
      res.status(500).json({ error: 'Status check failed' });
    }
  }

  /**
   * Health check endpoint
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async healthCheck(req, res) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development'
      };

      res.json(health);
    } catch (error) {
      logger.error('Health check failed', error);
      res.status(500).json({ status: 'unhealthy', error: error.message });
    }
  }
}

module.exports = VideoController;
