// index.js
import express from 'express';
import http from 'http';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';

const app = express();
const server = http.createServer(app);

app.use(cors()); // allow all origins
app.use(express.json());

// --- Hardcoded Supabase service role key ---
const supabase = createClient(
  'https://eimecuiixwgmpfpedxpr.supabase.co', // Supabase URL
  'sb_secret_SS1rgcdDo4BPB7vX6t5xTw_ceajtnsF' // Service Role key
);

// --- Start stream ---
app.post('/api/start-stream', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, error: 'Missing userId' });

  try {
    const { error } = await supabase
      .from('profile')
      .update({ is_live: true, stream_started_at: new Date() })
      .eq('id', userId);

    if (error) throw error;

    res.json({ success: true, message: 'Stream started!', userId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Stop stream ---
app.post('/api/stop-stream', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, error: 'Missing userId' });

  try {
    const { error } = await supabase
      .from('profile')
      .update({ is_live: false, stream_ended_at: new Date() })
      .eq('id', userId);

    if (error) throw error;

    res.json({ success: true, message: 'Stream stopped!', userId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Root endpoint (optional) ---
app.get('/', (req, res) => {
  res.json({ success: true, message: 'Backend is running!' });
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
