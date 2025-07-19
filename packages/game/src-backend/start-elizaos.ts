import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startElizaOS() {
  try {
    console.log('[BACKEND] Starting ElizaOS server using CLI...');
    
    // Change to the package directory
    const packageDir = path.join(__dirname, '..');
    process.chdir(packageDir);
    
    // Start ElizaOS using the CLI
    const { stdout, stderr } = await execAsync('npx elizaos start --port 3000', {
      env: {
        ...process.env,
        NODE_ENV: 'production',
      }
    });
    
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    
  } catch (error) {
    console.error('[BACKEND] Failed to start ElizaOS:', error);
    process.exit(1);
  }
}

startElizaOS(); 