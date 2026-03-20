// index.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { createClient } from '@supabase/supabase-js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// --- Supabase client (Service Role key required for updates) ---
const supabase = createClient(
  'https://eimecuiixwgmpfpedxpr.supabase.co', // Your Supabase URL
  'sb_secret_SS1rgcdDo4BPB7vX6t5xTw_ceajtnsF' // Service Role key
);

app.use(express.json());

// --- Start / Update Stream ---
app.post('/api/start-stream', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, error: 'Missing userId' });

  try {
    const { error } = await supabase
      .from('profile')
      .update({ 
        is_live: true,
        stream_started_at: new Date(),
        stream_room_id: userId,
        stream_camera_on: true,
        stream_mic_on: true
      })
      .eq('id', userId);

    if (error) throw error;

    res.json({ success: true, message: 'Stream started!', roomId: userId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Stop Stream ---
app.post('/api/stop-stream', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, error: 'Missing userId' });

  try {
    const { error } = await supabase
      .from('profile')
      .update({ 
        is_live: false,
        stream_ended_at: new Date(),
        stream_camera_on: false,
        stream_mic_on: false
      })
      .eq('id', userId);

    if (error) throw error;

    res.json({ success: true, message: 'Stream ended!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Update Camera / Mic Status ---
app.post('/api/update-stream', async (req, res) => {
  const { userId, stream_camera_on, stream_mic_on } = req.body;
  if (!userId) return res.status(400).json({ success: false, error: 'Missing userId' });

  try {
    const { error } = await supabase
      .from('profile')
      .update({ 
        stream_camera_on: stream_camera_on ?? true,
        stream_mic_on: stream_mic_on ?? true
      })
      .eq('id', userId);

    if (error) throw error;

    res.json({ success: true, message: 'Stream status updated!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- WebRTC Signaling via Socket.IO ---
io.on('connection', socket => {
  console.log('User connected:', socket.id);

  // Join a room (roomId = streamer userId)
  socket.on('join-room', roomId => {
    socket.join(roomId);
    console.log(`${socket.id} joined room ${roomId}`);
  });

  // Relay signals between peers
  socket.on('signal', data => {
    // data = { roomId, to, signalData }
    if (data.to) {
      io.to(data.to).emit('signal', { from: socket.id, signalData: data.signalData });
    } else {
      io.to(data.roomId).emit('signal', { from: socket.id, signalData: data.signalData });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// --- Serve a simple status page ---
app.get('/', (req, res) => {
  res.send('Live Stream Backend is running ✅');
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
