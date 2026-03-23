const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 2000;
const COMMAND = 'npx';
const ARGS = ['expo', 'start', '--web', '--clear', '--offline', '--port', '8084'];

function log(message) {
  console.log(`[TunnelRetry] ${message}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startWithRetry(attempt = 1) {
  if (attempt > MAX_RETRIES) {
    log('Max retries reached. Giving up.');
    process.exit(1);
  }

  log(`Attempt ${attempt}/${MAX_RETRIES} to start tunnel...`);

  return new Promise((resolve, reject) => {
    // Spawn the process
    // We use shell: true for Windows compatibility with bunx/npm
    const child = spawn(COMMAND, ARGS, {
      shell: true,
      env: {
        ...process.env,
        FORCE_COLOR: '1',
        EXPO_HOME: path.join(process.cwd(), '.expo-home'),
        EXPO_OFFLINE: '1',
        EXPO_DOCTOR: '0',
        RCT_METRO_PORT: '8084',
        EXPO_DEV_SERVER_PORT: '8084',
      }
    });

    child.stdout.on('data', (data) => {
      process.stdout.write(data);
    });

    child.stderr.on('data', (data) => {
      process.stderr.write(data);
    });

    child.on('error', (err) => {
      log(`Failed to start process: ${err.message}`);
      reject(err);
    });

    child.on('close', async (code) => {
      if (code === 0) {
        log('Process exited cleanly.');
        resolve();
      } else {
        log(`Process exited with code ${code}.`);
        
        // Calculate exponential backoff
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        log(`Waiting ${delay}ms before next attempt...`);
        
        await sleep(delay);
        try {
          await startWithRetry(attempt + 1);
          resolve();
        } catch (e) {
          reject(e);
        }
      }
    });
  });
}

// Start the process
log('Starting reliable tunnel connection...');
startWithRetry().catch(err => {
  console.error(err);
  process.exit(1);
});
