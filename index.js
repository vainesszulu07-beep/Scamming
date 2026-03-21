import express from "express";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

// =======================
// SUPABASE
// =======================
const supabase = createClient(
  "https://eimecuiixwgmpfpedxpr.supabase.co",
  "sb_secret_SS1rgcdDo4BPB7vX6t5xTw_ceajtnsF"
);

// =======================
// VIDEOSDK CONFIG
// =======================
const VIDEOSDK_API_KEY = "7b3acbbb-8976-4b84-978a-4533b7b41440";
const VIDEOSDK_SECRET = "62db5287e66364a8d97d73cfa1147fd92d4829bdc873648a09f9c640f366770a";

// =======================
// CREATE ROOM (RAW DEBUG)
// =======================
app.post("/api/create-room", async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    console.log("➡️ Creating room for user:", userId);

    // 1. Generate temp token
    const tempToken = jwt.sign(
      {
        apikey: VIDEOSDK_API_KEY,
        permissions: ["allow_join", "allow_mod"],
        version: 2
      },
      VIDEOSDK_SECRET,
      { expiresIn: "10m" }
    );

    console.log("✅ Temp token created");

    // 2. Call VideoSDK API
    const roomResp = await fetch("https://api.videosdk.live/v2/rooms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tempToken}`,
        "Content-Type": "application/json"
      }
    });

    // 🔥 READ RAW RESPONSE TEXT FIRST
    const rawText = await roomResp.text();

    console.log("📡 VideoSDK STATUS:", roomResp.status);
    console.log("📡 VideoSDK RAW RESPONSE:", rawText);

    let roomData;
    try {
      roomData = JSON.parse(rawText);
    } catch {
      roomData = { raw: rawText }; // if HTML or invalid JSON
    }

    if (!roomResp.ok) {
      return res.status(roomResp.status).json({
        success: false,
        error: "VideoSDK room creation failed",
        status: roomResp.status,
        raw: rawText,
        parsed: roomData
      });
    }

    const roomId = roomData.roomId;

    console.log("✅ Room created:", roomId);

    // 3. Save to Supabase
    const { error: updateError } = await supabase
      .from("profile")
      .update({
        is_live: true,
        stream_started_at: new Date(),
        videosdk_room_id: roomId
      })
      .eq("id", userId);

    if (updateError) {
      console.error("❌ Supabase error:", updateError);
      return res.status(500).json({
        success: false,
        error: "Supabase update failed",
        details: updateError
      });
    }

    // 4. Host token
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
      { expiresIn: "24h" }
    );

    console.log("✅ Host token generated");

    res.json({
      success: true,
      roomId,
      hostToken
    });

  } catch (err) {
    console.error("🔥 SERVER CRASH:", err);

    res.status(500).json({
      success: false,
      error: err.message,
      stack: err.stack
    });
  }
});

// =======================
// VIEWER TOKEN
// =======================
app.post("/api/get-viewer-token", async (req, res) => {
  const { roomId, viewerId, viewerName } = req.body;

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
      { expiresIn: "2h" }
    );

    res.json({ success: true, viewerToken });

  } catch (err) {
    res.status(500).json({
      error: err.message,
      stack: err.stack
    });
  }
});

// =======================
// TEST
// =======================
app.get("/", (req, res) => {
  res.send("Backend running ✅");
});

// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
