import { spawn } from 'node:child_process';
import dotenv from 'dotenv';

// Keep local API auth on same Supabase project as Vite's .env.local client.
dotenv.config({ path: '.env.local', override: true });

const child = spawn('vercel', ['dev', '--listen', '3100'], {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
