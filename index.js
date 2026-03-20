import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { createClient } from '@supabase/supabase-js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// --- Supabase (Service Role) ---
const supabase = createClient(
  'https://eimecuiixwgmpfpedxpr.supabase.co',
  'sb_secret_SS1rgcdDo4BPB7vX6t5xTw_ceajtnsF'
);

app.use(express.json());

// ===============================
// 🔴 STREAM CONTROL API
// ===============================

// Start Stream
app.post('/api/start-stream', async (req, res) => {
  const { userId } = req.body;

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

    res.json({ success: true, roomId: userId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stop Stream
app.post('/api/stop-stream', async (req, res) => {
  const { userId } = req.body;

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

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update mic/camera
app.post('/api/update-stream', async (req, res) => {
  const { userId, stream_camera_on, stream_mic_on } = req.body;

  try {
    const { error } = await supabase
      .from('profile')
      .update({
        stream_camera_on,
        stream_mic_on
      })
      .eq('id', userId);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// 🔵 SOCKET.IO SIGNALING
// ===============================

const rooms = {}; // roomId => { streamer: socketId, viewers: Set }

// On connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // ===========================
  // JOIN ROOM
  // ===========================
  socket.on('join-room', (data) => {
    const roomId = typeof data === 'string' ? data : data.roomId;
    const viewerId = data?.viewerId || null;
    const isStreamer = data?.isStreamer || false;

    socket.join(roomId);

    // Initialize room
    if (!rooms[roomId]) {
      rooms[roomId] = {
        streamer: null,
        viewers: new Set()
      };
    }

    if (isStreamer) {
      rooms[roomId].streamer = socket.id;
      console.log(`🎥 Streamer joined room ${roomId}`);
    } else {
      rooms[roomId].viewers.add(socket.id);
      console.log(`👁 Viewer joined room ${roomId}`);

      // Notify streamer a viewer joined
      if (rooms[roomId].streamer) {
        io.to(rooms[roomId].streamer).emit('viewer-joined', {
          viewerSocketId: socket.id,
          viewerId
        });
      }
    }

    console.log(`Room ${roomId} users:`, io.sockets.adapter.rooms.get(roomId)?.size);
  });

  // ===========================
  // SIGNALING (WebRTC)
  // ===========================
  socket.on('signal', ({ to, roomId, signalData }) => {
    if (to) {
      // Direct message
      io.to(to).emit('signal', {
        from: socket.id,
        signalData
      });
    } else {
      // Broadcast to others in room
      socket.to(roomId).emit('signal', {
        from: socket.id,
        signalData
      });
    }
  });

  // ===========================
  // DISCONNECT
  // ===========================
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    // Remove from rooms
    for (const roomId in rooms) {
      const room = rooms[roomId];

      if (room.streamer === socket.id) {
        console.log(`❌ Streamer left room ${roomId}`);

        // Notify all viewers
        socket.to(roomId).emit('stream-ended');

        delete rooms[roomId];
      } else if (room.viewers.has(socket.id)) {
        room.viewers.delete(socket.id);

        console.log(`Viewer left room ${roomId}`);

        // Notify streamer
        if (room.streamer) {
          io.to(room.streamer).emit('viewer-left', {
            viewerSocketId: socket.id
          });
        }
      }
    }
  });
});

// ===============================
// HEALTH CHECK
// ===============================
app.get('/', (req, res) => {
  res.send('🚀 Live Streaming Backend Running');
});

// ===============================
// START SERVER
// ===============================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
