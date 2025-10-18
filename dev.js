#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('Starting Voice Planner development servers...\n');

// Start server
console.log('Starting backend server...');
const server = spawn('npm', ['run', 'dev:server'], {
  cwd: path.join(__dirname, 'server'),
  stdio: 'inherit',
  shell: true
});

// Start client
console.log('Starting frontend server...');
const client = spawn('npm', ['run', 'dev'], {
  cwd: path.join(__dirname, 'client'),
  stdio: 'inherit',
  shell: true
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nShutting down servers...');
  server.kill('SIGINT');
  client.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.kill('SIGTERM');
  client.kill('SIGTERM');
  process.exit(0);
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

client.on('error', (err) => {
  console.error('Client error:', err);
});
