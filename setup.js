#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Setting up Voice Planner...\n');

// Check if we're in the right directory
if (!fs.existsSync('package.json')) {
  console.error('❌ Please run this script from the voice-planner root directory');
  process.exit(1);
}

try {
  // Install root dependencies
  console.log('Installing root dependencies...');
  execSync('npm install', { stdio: 'inherit' });

  // Install shared package dependencies
  console.log('Installing shared package dependencies...');
  execSync('cd shared && npm install', { stdio: 'inherit' });

  // Build shared package
  console.log('Building shared package...');
  execSync('cd shared && npm run build', { stdio: 'inherit' });

  // Install server dependencies
  console.log('Installing server dependencies...');
  execSync('cd server && npm install', { stdio: 'inherit' });

  // Install client dependencies
  console.log('Installing client dependencies...');
  execSync('cd client && npm install', { stdio: 'inherit' });

  // Create data directory
  console.log('Creating data directory...');
  if (!fs.existsSync('data')) {
    fs.mkdirSync('data');
  }

  console.log('\nSetup complete!');
  console.log('\nTo start the development servers:');
  console.log('  npm run dev');
  console.log('\nOr start them separately:');
  console.log('  npm run dev:server  (backend on port 3001)');
  console.log('  npm run dev:client (frontend on port 5173)');

} catch (error) {
  console.error('Setup failed:', error.message);
  process.exit(1);
}
