import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// Test Supabase connection
router.post('/test', async (req, res) => {
  try {
    const { supabaseUrl, supabaseAnonKey } = req.body;
    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(400).json({ error: 'Supabase URL and Anon Key are required.' });
    }

    const client = createClient(supabaseUrl, supabaseAnonKey);
    const { error } = await client.from('profiles').select('count', { count: 'exact', head: true });

    if (error && error.code !== 'PGRST116' && error.code !== '42P01' && error.message && error.message.includes('JWT')) {
      return res.status(400).json({ error: 'Invalid Supabase JWT / Anon Key.' });
    }

    res.json({ success: true, message: 'Supabase connection successful' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to connect to Supabase' });
  }
});

// Save Supabase configuration to .env and process.env
router.post('/config', async (req, res) => {
  try {
    const { supabaseUrl, supabaseAnonKey } = req.body;
    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(400).json({ error: 'Supabase URL and Anon Key are required.' });
    }

    // Update process.env
    process.env.SUPABASE_URL = supabaseUrl;
    process.env.SUPABASE_ANON_KEY = supabaseAnonKey;
    process.env.VITE_SUPABASE_URL = supabaseUrl;
    process.env.VITE_SUPABASE_ANON_KEY = supabaseAnonKey;

    // Update .env file
    const envPath = path.resolve(process.cwd(), '.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }

    const updateEnvVar = (content: string, key: string, value: string) => {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      const newLine = `${key}="${value}"`;
      if (regex.test(content)) {
        return content.replace(regex, newLine);
      }
      return content + `\n${newLine}`;
    };

    envContent = updateEnvVar(envContent, 'SUPABASE_URL', supabaseUrl);
    envContent = updateEnvVar(envContent, 'SUPABASE_ANON_KEY', supabaseAnonKey);
    envContent = updateEnvVar(envContent, 'VITE_SUPABASE_URL', supabaseUrl);
    envContent = updateEnvVar(envContent, 'VITE_SUPABASE_ANON_KEY', supabaseAnonKey);

    fs.writeFileSync(envPath, envContent, 'utf-8');

    // Also update .env.example if needed
    const envExamplePath = path.resolve(process.cwd(), '.env.example');
    if (fs.existsSync(envExamplePath)) {
      let exampleContent = fs.readFileSync(envExamplePath, 'utf-8');
      exampleContent = updateEnvVar(exampleContent, 'SUPABASE_URL', 'YOUR_SUPABASE_PROJECT_URL');
      exampleContent = updateEnvVar(exampleContent, 'SUPABASE_ANON_KEY', 'YOUR_SUPABASE_ANON_KEY');
      fs.writeFileSync(envExamplePath, exampleContent, 'utf-8');
    }

    res.json({ success: true, message: 'Supabase configuration saved successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save configuration' });
  }
});

export default router;
