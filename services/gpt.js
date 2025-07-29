const openai = require('../config/openai');
const Logger = require('../utils/logger');

const logger = new Logger('gpt');

class GPTService {
  constructor() {
    this.model = 'gpt-4-turbo-preview'; // Using GPT-4 as requested
    this.maxTokens = 1000;
    this.temperature = 0.7;
  }

  /**
   * Analyze transcript to generate hooks, CTAs, and USPs
   * @param {string} transcript - Video transcript text
   * @returns {Promise<Object>} - Analysis results with hook, cta, usp
   */
  async analyzeContent(transcript) {
    logger.info('Starting content analysis with GPT', { 
      model: this.model,
      transcriptLength: transcript.length,
      transcriptPreview: transcript.substring(0, 200) + '...'
    });

    try {
      const prompt = this.createAnalysisPrompt(transcript);
      
      logger.info('Sending analysis request to OpenAI GPT', {
        promptLength: prompt.length,
        maxTokens: this.maxTokens,
        temperature: this.temperature
      });

      const completion = await openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert content analyst specializing in social media video content. Your task is to analyze video transcripts and extract key marketing elements.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        response_format: { type: 'json_object' }
      });

      const response = completion.choices[0].message.content;
      logger.info('GPT analysis response received', { 
        responseLength: response.length,
        tokensUsed: completion.usage.total_tokens
      });

      // Parse the JSON response
      const analysis = JSON.parse(response);
      
      // Validate the response structure
      this.validateAnalysisResponse(analysis);

      logger.success('Content analysis completed successfully', {
        hook: analysis.hook.substring(0, 50) + '...',
        cta: analysis.cta.substring(0, 50) + '...',
        usp: analysis.usp.substring(0, 50) + '...'
      });

      return analysis;

    } catch (error) {
      logger.error('Content analysis failed', error);
      
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
   * Create analysis prompt for GPT
   * @param {string} transcript - Video transcript
   * @returns {string} - Formatted prompt
   */
  createAnalysisPrompt(transcript) {
    return `
Analyze the following video transcript and extract three key marketing elements. Return your response as a JSON object with exactly these three fields:

**Instructions:**
1. **hook**: Identify the most attention-grabbing opening or compelling moment that would make viewers stop scrolling and watch. This should be the strongest hook from the video content.

2. **cta**: Extract or infer the main call-to-action. This could be explicit (like "subscribe", "buy now", "follow me") or implicit (what action the creator wants viewers to take).

3. **usp**: Determine the unique selling proposition or value proposition - what makes this content/creator/product unique or valuable compared to others.

**Requirements:**
- Each field should be a clear, concise string (50-150 characters)
- Focus on marketing impact and viewer engagement
- If any element is not clearly present, infer the most logical one based on context
- Return valid JSON format only

**Video Transcript:**
${transcript}

**Response Format:**
{
  "hook": "Your identified hook here",
  "cta": "Your identified call-to-action here", 
  "usp": "Your identified unique selling proposition here"
}
`;
  }

  /**
   * Validate analysis response structure
   * @param {Object} analysis - Analysis response to validate
   * @throws {Error} - If validation fails
   */
  validateAnalysisResponse(analysis) {
    const requiredFields = ['hook', 'cta', 'usp'];
    
    for (const field of requiredFields) {
      if (!analysis[field] || typeof analysis[field] !== 'string') {
        throw new Error(`Invalid analysis response: missing or invalid '${field}' field`);
      }
      
      if (analysis[field].trim().length === 0) {
        throw new Error(`Invalid analysis response: '${field}' field is empty`);
      }
    }

    logger.info('Analysis response validation passed', {
      hookLength: analysis.hook.length,
      ctaLength: analysis.cta.length,
      uspLength: analysis.usp.length
    });
  }

  /**
   * Generate alternative analysis with different temperature
   * @param {string} transcript - Video transcript
   * @param {number} temperature - Temperature for creativity (0.0-2.0)
   * @returns {Promise<Object>} - Alternative analysis results
   */
  async generateAlternativeAnalysis(transcript, temperature = 1.2) {
    logger.info('Generating alternative analysis', { temperature });
    
    const originalTemp = this.temperature;
    this.temperature = temperature;
    
    try {
      const result = await this.analyzeContent(transcript);
      return result;
    } finally {
      this.temperature = originalTemp;
    }
  }

  /**
   * Set model configuration
   * @param {Object} config - Configuration object
   */
  setConfig(config) {
    if (config.model) {
      this.model = config.model;
      logger.info('Model updated', { model: this.model });
    }
    
    if (config.maxTokens) {
      this.maxTokens = config.maxTokens;
      logger.info('Max tokens updated', { maxTokens: this.maxTokens });
    }
    
    if (config.temperature !== undefined) {
      this.temperature = config.temperature;
      logger.info('Temperature updated', { temperature: this.temperature });
    }
  }
}

module.exports = GPTService;
