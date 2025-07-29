// main.js - Handles frontend logic for Video Content Analyzer
// Shows debug logs and results from the backend in real-time using Server-Sent Events (SSE)

// DOM Elements
const form = document.getElementById('video-form');
const urlInput = document.getElementById('url-input');
const debugLogs = document.getElementById('debug-logs');
const resultSection = document.getElementById('result-section');
const resultJson = document.getElementById('result-json');
const progressSection = document.getElementById('progress-section');
const progressBar = document.getElementById('progress-bar');
const progressPercentage = document.getElementById('progress-percentage');
const platformBadge = document.getElementById('platform-badge');
const loadingOverlay = document.getElementById('loading-overlay');
const analyzeBtn = document.getElementById('analyze-btn');

let eventSource = null;

// Helper to append debug log to UI
function appendLog(message, type = 'info') {
  debugLogs.innerHTML += message + '\n';
  debugLogs.scrollTop = debugLogs.scrollHeight;
}

// Helper to print formatted log and log to console
function printLog(step, msg, data, type) {
  const log = `[${new Date().toLocaleTimeString()}] [${step}] ${msg}`;
  if (data) {
    appendLog(log + '\n' + JSON.stringify(data, null, 2), type);
    if (type === 'error') {
      console.error(log, data);
    } else if (type === 'success') {
      console.log('%c' + log, 'color:green', data);
    } else {
      console.log(log, data);
    }
  } else {
    appendLog(log, type);
    if (type === 'error') {
      console.error(log);
    } else if (type === 'success') {
      console.log('%c' + log, 'color:green');
    } else {
      console.log(log);
    }
  }
}

// Show/hide loading and progress
function setLoading(loading) {
  analyzeBtn.disabled = loading;
  analyzeBtn.innerHTML = loading ? '⏳ Processing...' : '🚀 Analyze Video';
  progressSection.style.display = loading ? 'block' : 'none';
  if (!loading) {
    progressBar.style.width = '0%';
    progressPercentage.textContent = '0%';
    platformBadge.textContent = '';
  }
}

// Update progress bar
function updateProgress(percentage) {
  progressBar.style.width = percentage + '%';
  progressPercentage.textContent = percentage + '%';
}

// Detect and display platform
function detectPlatform(url) {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
  if (url.includes('instagram.com')) return 'Instagram';
  if (url.includes('tiktok.com')) return 'TikTok';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'Twitter/X';
  if (url.includes('facebook.com') || url.includes('fb.watch')) return 'Facebook';
  if (url.includes('linkedin.com')) return 'LinkedIn';
  if (url.includes('snapchat.com')) return 'Snapchat';
  return 'Unknown';
}

// Step progress logic
const steps = [
  'download',
  'upload',
  'extraction',
  'transcription',
  'analysis',
  'complete'
];

function setStepStatus(step, status) {
  const el = document.getElementById('step-' + step);
  if (!el) return;
  el.classList.remove('processing', 'done', 'error');
  if (status) el.classList.add(status);
}

function resetSteps() {
  steps.forEach(s => setStepStatus(s, null));
}

function markStep(step, status) {
  setStepStatus(step, status);
  // Log to browser console as well
  console.log(`[STEP] ${step.toUpperCase()}: ${status}`);
}

function handleStepProgress(step, type) {
  // Set all previous steps to done, current to processing
  const idx = steps.indexOf(step);
  steps.forEach((s, i) => {
    if (i < idx) setStepStatus(s, 'done');
    else if (i === idx) setStepStatus(s, type === 'error' ? 'error' : 'processing');
    else setStepStatus(s, null);
  });
  if (type === 'error') {
    // Mark all remaining steps as null
    for (let i = idx + 1; i < steps.length; i++) setStepStatus(steps[i], null);
  }
  if (step === 'complete' && type !== 'error') {
    setStepStatus('complete', 'done');
  }
}

// Handle form submission
form.addEventListener('submit', function(e) {
  e.preventDefault();
  
  const url = urlInput.value.trim();
  if (!url) {
    appendLog('❌ Please enter a video URL.', 'error');
    return;
  }

  // Reset UI state
  debugLogs.innerHTML = '🚀 Starting video analysis...\n';
  resultSection.style.display = 'none';
  resultJson.innerHTML = '';
  setLoading(true);
  resetSteps();
  
  // Detect and show platform
  const platform = detectPlatform(url);
  platformBadge.textContent = platform;
  updateProgress(5);

  // Start SSE connection
  if (eventSource) {
    eventSource.close();
  }

  printLog('🎯 submit', `Analyzing ${platform} video...`, { url });

  eventSource = new EventSourcePolyfill(`http://localhost:3000/api/video/analyze`, {
    headers: { 'Content-Type': 'application/json' },
    payload: JSON.stringify({ url })
  });

  eventSource.onmessage = function(event) {
    try {
      const data = JSON.parse(event.data);
      
      if (data.step) {
        const stepEmoji = {
          'validation': '🔍',
          'download': '📥',
          'upload': '☁️',
          'extraction': '🎵',
          'transcription': '📝',
          'analysis': '🧠',
          'complete': '✅',
          'error': '❌'
        };
        
        const emoji = stepEmoji[data.step] || '📋';
        printLog(`${emoji} ${data.step}`, data.message, data.data, data.step === 'error' ? 'error' : 'info');
        
        // Update progress based on step
        const progressMap = {
          'validation': 10,
          'download': 25,
          'upload': 45,
          'extraction': 60,
          'transcription': 75,
          'analysis': 90,
          'complete': 100
        };
        
        if (progressMap[data.step]) {
          updateProgress(progressMap[data.step]);
        }
        
        handleStepProgress(data.step, data.step === 'error' ? 'error' : 'processing');
      }
      
      if (data.type === 'final' && data.result) {
        printLog('🎉 complete', 'Analysis complete! 🚀', data.result, 'success');
        handleStepProgress('complete', 'done');
        updateProgress(100);
        
        // Populate all result fields
        populateResults(data.result);
        
        // Show results section
        resultSection.style.display = 'block';
        setLoading(false);
        
        // Scroll to results
        setTimeout(() => {
          resultSection.scrollIntoView({ behavior: 'smooth' });
        }, 500);
      }
      
      if (data.type === 'error') {
        printLog('❌ error', 'Analysis failed: ' + data.error.error, data.error, 'error');
        handleStepProgress(data.step || 'complete', 'error');
        setLoading(false);
      }
    } catch (err) {
      printLog('⚠️ parse', 'Malformed server event', event.data, 'error');
      setLoading(false);
    }
  };

  eventSource.onerror = function(err) {
    printLog('🔌 connection', 'Connection error or server closed the connection.', err, 'error');
    setLoading(false);
    eventSource.close();
  };
});

// Populate all result fields with data from backend
function populateResults(result) {
  try {
    // Video Information
    const originalUrl = document.getElementById('original-url');
    const supabaseUrl = document.getElementById('supabase-url');
    const processingTime = document.getElementById('processing-time');
    const platformDetected = document.getElementById('platform-detected');
    
    if (result.metadata && result.metadata.originalUrl) {
      originalUrl.href = result.metadata.originalUrl;
      originalUrl.textContent = result.metadata.originalUrl;
    }
    
    if (result.videoUrl) {
      supabaseUrl.href = result.videoUrl;
      supabaseUrl.textContent = result.videoUrl;
    }
    
    if (result.processingTime) {
      processingTime.textContent = result.processingTime;
    }
    
    if (result.metadata && result.metadata.originalUrl) {
      platformDetected.textContent = detectPlatform(result.metadata.originalUrl);
    }
    
    // Transcription
    const transcriptionContent = document.getElementById('transcription-content');
    if (result.transcript) {
      transcriptionContent.textContent = result.transcript;
    } else {
      transcriptionContent.textContent = 'No transcription available';
    }
    
    // AI Analysis Results
    if (result.analysis) {
      populateHooks(result.analysis.hooks || []);
      populateCTAs(result.analysis.ctas || result.analysis.CTAs || []);
      populateUSPs(result.analysis.usps || result.analysis.USPs || []);
    }
    
    // Raw JSON
    const resultJson = document.getElementById('result-json');
    resultJson.textContent = JSON.stringify(result, null, 2);
    
  } catch (error) {
    console.error('Error populating results:', error);
    printLog('⚠️ display', 'Error displaying results', error, 'error');
  }
}

// Populate hooks
function populateHooks(hooks) {
  const hooksList = document.getElementById('hooks-list');
  if (!hooks || hooks.length === 0) {
    hooksList.innerHTML = '<div class="hook-item">No hooks generated</div>';
    return;
  }
  
  hooksList.innerHTML = hooks.map((hook, index) => 
    `<div class="hook-item">
      <strong>Hook ${index + 1}:</strong> ${typeof hook === 'string' ? hook : hook.text || hook.content || JSON.stringify(hook)}
    </div>`
  ).join('');
}

// Populate CTAs
function populateCTAs(ctas) {
  const ctasList = document.getElementById('ctas-list');
  if (!ctas || ctas.length === 0) {
    ctasList.innerHTML = '<div class="cta-item">No CTAs generated</div>';
    return;
  }
  
  ctasList.innerHTML = ctas.map((cta, index) => 
    `<div class="cta-item">
      <strong>CTA ${index + 1}:</strong> ${typeof cta === 'string' ? cta : cta.text || cta.content || JSON.stringify(cta)}
    </div>`
  ).join('');
}

// Populate USPs
function populateUSPs(usps) {
  const uspsList = document.getElementById('usps-list');
  if (!usps || usps.length === 0) {
    uspsList.innerHTML = '<div class="usp-item">No USPs generated</div>';
    return;
  }
  
  uspsList.innerHTML = usps.map((usp, index) => 
    `<div class="usp-item">
      <strong>USP ${index + 1}:</strong> ${typeof usp === 'string' ? usp : usp.text || usp.content || JSON.stringify(usp)}
    </div>`
  ).join('');
}

// Toggle raw JSON display
function toggleRawJson() {
  const rawJson = document.getElementById('raw-json');
  const toggle = document.getElementById('json-toggle');
  
  if (rawJson.style.display === 'none') {
    rawJson.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    rawJson.style.display = 'none';
    toggle.textContent = '▼';
  }
}

// Polyfill for EventSource with POST support (SSE via fetch)
// This is needed because browsers only support GET for EventSource
class EventSourcePolyfill {
  constructor(url, options) {
    this.url = url;
    this.options = options || {};
    this.controller = new AbortController();
    this.listeners = {};
    this.connect();
  }
  connect() {
    fetch(this.url, {
      method: 'POST',
      headers: this.options.headers || {},
      body: this.options.payload || null,
      signal: this.controller.signal,
    }).then(async (response) => {
      if (!response.body) throw new Error('No response body');
      const reader = response.body.getReader();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += new TextDecoder().decode(value);
        let lines = buffer.split(/\n\n/);
        buffer = lines.pop();
        for (const line of lines) {
          if (this.listeners['message']) {
            this.listeners['message']({ data: line.replace(/^data: /, '') });
          }
        }
      }
    }).catch((err) => {
      if (this.listeners['error']) {
        this.listeners['error'](err);
      }
    });
  }
  close() {
    this.controller.abort();
  }
  set onmessage(fn) {
    this.listeners['message'] = fn;
  }
  set onerror(fn) {
    this.listeners['error'] = fn;
  }
}
