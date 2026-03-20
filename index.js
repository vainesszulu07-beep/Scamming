import express from "express";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import cors from "cors";
import wrtc, { MediaStream, MediaStreamTrack } from "wrtc";
import fetch from "node-fetch";

const app = express();
app.use(express.json());
app.use(cors());

// --- Supabase client ---
const supabase = createClient(
  "https://eimecuiixwgmpfpedxpr.supabase.co",
  "sb_secret_SS1rgcdDo4BPB7vX6t5xTw_ceajtnsF"
);

// --- VideoSDK Config ---
const VIDEOSDK_API_KEY = "7b3acbbb-8976-4b84-978a-4533b7b41440";
const VIDEOSDK_SECRET = "62db5287e66364a8d97d73cfa1147fd92d4829bdc873648a09f9c640f366770a"; // replace with your VideoSDK secret

// Keep track of server-side broadcasters
const serverBroadcasters = {};

// =======================
// CREATE OR GET ROOM (persistent)
// =======================
app.post("/api/create-room", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  try {
    // 1. Check if user already has a room in Supabase
    const { data: profile, error: profileError } = await supabase
      .from("profile")
      .select("videosdk_room_id")
      .eq("id", userId)
      .single();
    if (profileError) throw profileError;

    let roomId = profile?.videosdk_room_id;

    // 2. If no room exists, create a persistent roomId
    if (!roomId) {
      roomId = `room_${userId}`;
      await supabase
        .from("profile")
        .update({
          is_live: true,
          stream_started_at: new Date(),
          videosdk_room_id: roomId
        })
        .eq("id", userId);
    }

    // 3. Generate a host token (JWT)
    const hostToken = jwt.sign(
      {
        apikey: VIDEOSDK_API_KEY,
        roomId,
        participantId: `server_${userId}`,
        roles: ["host", "rtc"],
        permissions: ["allow_join", "allow_mod"],
        version: 2
      },
      VIDEOSDK_SECRET,
      { algorithm: "HS256", expiresIn: "24h" }
    );

    // 4. Start server-side broadcast if not already running
    if (!serverBroadcasters[userId]) {
      startServerBroadcast(roomId, hostToken);
      serverBroadcasters[userId] = true;
    }

    res.json({ success: true, roomId, hostToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =======================
// START SERVER-SIDE BROADCAST FUNCTION
// =======================
function startServerBroadcast(roomId, hostToken) {
  console.log("Starting server-side broadcast for room:", roomId);

  const pc = new wrtc.RTCPeerConnection();

  // Optional: black video + silent audio for demo (replace with actual media if needed)
  const videoTrack = new MediaStreamTrack({ kind: "video" });
  const audioTrack = new MediaStreamTrack({ kind: "audio" });
  const mediaStream = new MediaStream([videoTrack, audioTrack]);
  mediaStream.getTracks().forEach(track => pc.addTrack(track, mediaStream));

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      // VideoSDK signaling automatically handles ICE for host JWT
      console.log("New ICE candidate from server broadcaster");
    }
  };

  (async () => {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const response = await fetch(
      `https://api.videosdk.live/v2/rooms/${roomId}/webrtc`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      }
    );

    const answerSdp = await response.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

    console.log(`Server-side broadcast running for room ${roomId} ✅`);
  })();
}

// =======================
// GET VIEWER TOKEN
// =======================
app.post("/api/get-viewer-token", async (req, res) => {
  const { roomId, viewerId, viewerName } = req.body;
  if (!roomId || !viewerId || !viewerName)
    return res.status(400).json({ error: "Missing roomId, viewerId or viewerName" });

  try {
    const viewerToken = jwt.sign(
      {
        apikey: VIDEOSDK_API_KEY,
        roomId,
        participantId: viewerId,
        roles: ["viewer", "rtc"],
        permissions: ["allow_join"],
        name: viewerName,
        version: 2
      },
      VIDEOSDK_SECRET,
      { algorithm: "HS256", expiresIn: "2h" }
    );

    res.json({ success: true, viewerToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =======================
// STOP STREAM
// =======================
app.post("/api/stop-stream", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  try {
    await supabase
      .from("profile")
      .update({
        is_live: false,
        stream_ended_at: new Date(),
        videosdk_room_id: null
      })
      .eq("id", userId);

    // Stop server-side broadcast
    if (serverBroadcasters[userId]) {
      serverBroadcasters[userId] = false;
      console.log("Server broadcast stopped for room:", userId);
    }

    res.json({ success: true, message: "Stream ended" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =======================
// TEST ROUTE
// =======================
app.get("/", (req, res) => res.send("VideoSDK JWT Backend + Server Broadcast running ✅"));

// =======================
// START SERVER
// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
