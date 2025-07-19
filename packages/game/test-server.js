// Simple test to run the server
import('dotenv/config');
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
import('./src-backend/server.ts'); 