#!/usr/bin/env node
/**
 * Combined startup script for TrendOS
 * Runs both Node.js server and Python trend finder with colored console logs
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(color, prefix, message) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${color}[${prefix}]${colors.reset} ${message}`);
}

// Check if Python .env exists
const pythonEnvPath = path.join(__dirname, 'clip_trend_finder', '.env');
if (!fs.existsSync(pythonEnvPath)) {
  log(colors.red, 'ERROR', '.env file not found in clip_trend_finder/');
  log(colors.yellow, 'INFO', 'Please copy clip_trend_finder/.env.example to clip_trend_finder/.env');
  process.exit(1);
}

log(colors.cyan, 'STARTUP', 'Starting TrendOS Full Stack Application...');
console.log('');

// Start Node.js server
log(colors.blue, 'NODE', 'Starting Express server on port 4070...');
const nodeProcess = spawn('npm', ['run', 'dev'], {
  cwd: __dirname,
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true,
});

nodeProcess.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    log(colors.blue, 'NODE', line);
  });
});

nodeProcess.stderr.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    log(colors.red, 'NODE', line);
  });
});

// Wait a moment for Node to start, then start Python
setTimeout(() => {
  log(colors.green, 'PYTHON', 'Starting Python Trend Finder...');
  const pythonPath = process.platform === 'win32' 
    ? path.join(__dirname, 'clip_trend_finder', 'venv', 'Scripts', 'python.exe')
    : path.join(__dirname, 'clip_trend_finder', 'venv', 'bin', 'python3');
  
  const pythonProcess = spawn(pythonPath, ['main.py'], {
    cwd: path.join(__dirname, 'clip_trend_finder'),
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: false,
  });

  pythonProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      log(colors.green, 'PYTHON', line);
    });
  });

  pythonProcess.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      log(colors.red, 'PYTHON', line);
    });
  });

  pythonProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      log(colors.red, 'PYTHON', `Process exited with code ${code}`);
    }
  });

  // Store Python PID for cleanup
  global.pythonProcess = pythonProcess;
}, 2000);

nodeProcess.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    log(colors.red, 'NODE', `Process exited with code ${code}`);
  }
  if (global.pythonProcess) {
    global.pythonProcess.kill();
  }
  process.exit(code || 0);
});

// Handle cleanup on exit
process.on('SIGINT', () => {
  log(colors.yellow, 'CLEANUP', 'Stopping all processes...');
  nodeProcess.kill();
  if (global.pythonProcess) {
    global.pythonProcess.kill();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  log(colors.yellow, 'CLEANUP', 'Stopping all processes...');
  nodeProcess.kill();
  if (global.pythonProcess) {
    global.pythonProcess.kill();
  }
  process.exit(0);
});

log(colors.green, 'STARTUP', 'All services started!');
log(colors.cyan, 'INFO', 'Frontend/Backend: http://localhost:4070');
log(colors.cyan, 'INFO', 'Press Ctrl+C to stop all services');
console.log('');

