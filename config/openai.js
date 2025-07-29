const OpenAI = require('openai');
const debug = require('debug')('video-analyzer:openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OpenAI API key. Please check your .env file.');
}

debug('OpenAI client initialized');

module.exports = openai;
