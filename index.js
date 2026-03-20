// index.js
import express from "express";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

// --- Supabase client ---
const supabase = createClient(
  "https://eimecuiixwgmpfpedxpr.supabase.co",
  "sb_secret_SS1rgcdDo4BPB7vX6t5xTw_ceajtnsF"
);

// --- VideoSDK API key ---
const VIDEOSDK_API_KEY = "7b3acbbb-8976-4b84-978a-4533b7b41440";

// -------------------------------
// Create or reuse a persistent room
// -------------------------------
app.post("/api/create-room", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  try {
    // 1. Check if user already has a room
    const { data: profile, error: profileError } = await supabase
      .from("profile")
      .select("videosdk_room_id, videosdk_host_token")
      .eq("id", userId)
      .single();

    if (profileError) throw profileError;

    let roomId = profile?.videosdk_room_id;
    let hostToken = profile?.videosdk_host_token;

    // 2. If no room exists, create a new one
    if (!roomId) {
      const roomResp = await fetch("https://api.videosdk.live/v2/rooms", {
        method: "POST",
        headers: {
          Authorization: VIDEOSDK_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `room_${userId}`,
          // enable persistent broadcast
          mode: "sfu", // SFU allows multiple viewers
          record: true // optional: persist stream on VideoSDK
        }),
      });
      const roomData = await roomResp.json();
      roomId = roomData.id;

      // 3. Create host token
      const hostTokenResp = await fetch(
        `https://api.videosdk.live/v2/rooms/${roomId}/tokens`,
        {
          method: "POST",
          headers: {
            Authorization: VIDEOSDK_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role: "host" }),
        }
      );
      const hostTokenData = await hostTokenResp.json();
      hostToken = hostTokenData.token;

      // 4. Update Supabase profile
      const { error: updateError } = await supabase
        .from("profile")
        .update({
          is_live: true,
          stream_started_at: new Date(),
          videosdk_room_id: roomId,
          videosdk_host_token: hostToken,
        })
        .eq("id", userId);

      if (updateError) throw updateError;
    }

    res.json({ success: true, roomId, hostToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------
// Get viewer token
// -------------------------------
app.post("/api/get-viewer-token", async (req, res) => {
  const { roomId, viewerName } = req.body;
  if (!roomId || !viewerName)
    return res.status(400).json({ error: "Missing roomId or viewerName" });

  try {
    const resp = await fetch(
      `https://api.videosdk.live/v2/rooms/${roomId}/tokens`,
      {
        method: "POST",
        headers: {
          Authorization: VIDEOSDK_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: "viewer", name: viewerName }),
      }
    );

    const data = await resp.json();
    res.json({ success: true, viewerToken: data.token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------
// Stop stream
// -------------------------------
app.post("/api/stop-stream", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  try {
    await supabase
      .from("profile")
      .update({
        is_live: false,
        stream_ended_at: new Date(),
        videosdk_room_id: null,
        videosdk_host_token: null,
      })
      .eq("id", userId);

    res.json({ success: true, message: "Stream ended" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------
// Test route
// -------------------------------
app.get("/", (req, res) => {
  res.send("VideoSDK Backend running ✅");
});

// -------------------------------
// Start server
// -------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
