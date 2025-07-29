const { createClient } = require('@supabase/supabase-js');
const debug = require('debug')('video-analyzer:supabase');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase configuration. Please check your .env file.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

debug('Supabase client initialized');

module.exports = supabase;
