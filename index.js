import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { createClient } from '@supabase/supabase-js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// --- Hardcoded Supabase client ---
const supabase = createClient(
  'https://eimecuiixwgmpfpedxpr.supabase.co', // your Supabase URL
  'sb_secret_SS1rgcdDo4BPB7vX6t5xTw_ceajtnsF' // your Service Role key
);

app.use(express.json());

// --- Start stream API ---
app.post('/api/start-stream', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, error: 'Missing userId' });

  try {
    const { error } = await supabase
      .from('profile')
      .update({ is_live: true, stream_started_at: new Date() })
      .eq('id', userId);

    if (error) throw error;

    res.json({ success: true, message: 'Stream started!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Stop stream API ---
app.post('/api/stop-stream', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, error: 'Missing userId' });

  try {
    const { error } = await supabase
      .from('profile')
      .update({ is_live: false, stream_ended_at: new Date() })
      .eq('id', userId);

    if (error) throw error;

    res.json({ success: true, message: 'Stream ended!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- WebRTC signaling ---
io.on('connection', socket => {
  console.log('User connected:', socket.id);

  socket.on('join-room', roomId => {
    socket.join(roomId);
    console.log(`${socket.id} joined room ${roomId}`);
  });

  socket.on('signal', data => {
    io.to(data.to).emit('signal', { from: socket.id, signalData: data.signalData });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(3000, () => console.log('Server running on port 3000'));
