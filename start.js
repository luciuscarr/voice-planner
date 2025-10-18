#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('Starting Voice Planner in production mode...\n');

// Build shared package first
console.log('Building shared package...');
const buildShared = spawn('npm', ['run', 'build'], {
  cwd: path.join(__dirname, 'shared'),
  stdio: 'inherit',
  shell: true
});

buildShared.on('close', (code) => {
  if (code !== 0) {
    console.error('Failed to build shared package');
    process.exit(1);
  }

  // Build client
  console.log('Building client...');
  const buildClient = spawn('npm', ['run', 'build'], {
    cwd: path.join(__dirname, 'client'),
    stdio: 'inherit',
    shell: true
  });

  buildClient.on('close', (code) => {
    if (code !== 0) {
      console.error('Failed to build client');
      process.exit(1);
    }

    // Start server
    console.log('Starting server...');
    const server = spawn('npm', ['start'], {
      cwd: path.join(__dirname, 'server'),
      stdio: 'inherit',
      shell: true
    });

    server.on('error', (err) => {
      console.error('Server error:', err);
    });
  });
});
