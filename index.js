import express from "express";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

// --- Supabase ---
const supabase = createClient(
  "https://eimecuiixwgmpfpedxpr.supabase.co",
  "sb_secret_SS1rgcdDo4BPB7vX6t5xTw_ceajtnsF"
);

// --- VideoSDK ---
const VIDEOSDK_API_KEY = "7b3acbbb-8976-4b84-978a-4533b7b41440";
const VIDEOSDK_SECRET = "62db5287e66364a8d97d73cfa1147fd92d4829bdc873648a09f9c640f366770a";

// =======================
// CREATE OR GET PERSISTENT ROOM
// =======================
app.post("/api/create-room", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  try {
    const { data: profile, error: profileError } = await supabase
      .from("profile")
      .select("videosdk_room_id")
      .eq("id", userId)
      .single();

    if (profileError) throw profileError;

    let roomId = profile?.videosdk_room_id;
    if (!roomId) {
      roomId = `room_${userId}`;
      const { error: updateError } = await supabase
        .from("profile")
        .update({ is_live: true, stream_started_at: new Date(), videosdk_room_id: roomId })
        .eq("id", userId);
      if (updateError) throw updateError;
    }

    // Generate **host token** (24h)
    const hostToken = jwt.sign(
      {
        apikey: VIDEOSDK_API_KEY,
        roomId,
        participantId: userId,
        roles: ["host", "rtc"],
        permissions: ["allow_join", "allow_mod"],
        version: 2
      },
      VIDEOSDK_SECRET,
      { algorithm: "HS256", expiresIn: "24h" }
    );

    res.json({ success: true, roomId, hostToken });
  } catch (err) {
    console.error("CREATE ROOM ERROR:", err);
    res.status(500).json({
      success: false,
      error: err.message,
      stack: err.stack // raw error for debugging
    });
  }
});

// =======================
// GET VIEWER TOKEN
// =======================
app.post("/api/get-viewer-token", async (req, res) => {
  const { roomId, viewerId, viewerName } = req.body;
  if (!roomId || !viewerId || !viewerName) {
    return res.status(400).json({ error: "Missing roomId, viewerId, or viewerName" });
  }

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
    console.error("VIEWER TOKEN ERROR:", err);
    res.status(500).json({ success: false, error: err.message, stack: err.stack });
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
      .update({ is_live: false, stream_ended_at: new Date(), videosdk_room_id: null })
      .eq("id", userId);

    res.json({ success: true, message: "Stream ended" });
  } catch (err) {
    console.error("STOP STREAM ERROR:", err);
    res.status(500).json({ success: false, error: err.message, stack: err.stack });
  }
});

// =======================
// TEST ROUTE
// =======================
app.get("/", (req, res) => res.send("VideoSDK JWT Backend running ✅"));

// =======================
// START SERVER
// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
