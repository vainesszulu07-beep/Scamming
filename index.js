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
// CREATE ROOM (FIXED)
// =======================
app.post("/api/create-room", async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    console.log("➡️ Creating room for:", userId);

    // ✅ CORRECT TEMP TOKEN
    const tempToken = jwt.sign(
      {
        apikey: VIDEOSDK_API_KEY,
        permissions: ["allow_join"],
        version: 2
      },
      VIDEOSDK_SECRET,
      {
        algorithm: "HS256",
        expiresIn: "10m"
      }
    );

    // ✅ CREATE ROOM ON VIDEOSDK
    const roomResp = await fetch("https://api.videosdk.live/v2/rooms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tempToken}`,
        "Content-Type": "application/json"
      }
    });

    const rawText = await roomResp.text();

    console.log("📡 STATUS:", roomResp.status);
    console.log("📡 RAW:", rawText);

    let roomData;
    try {
      roomData = JSON.parse(rawText);
    } catch {
      roomData = { raw: rawText };
    }

    // ❌ FAIL → RETURN RAW ERROR
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

    // =======================
    // SAVE TO SUPABASE
    // =======================
    const { error: dbError } = await supabase
      .from("profile")
      .update({
        is_live: true,
        stream_started_at: new Date(),
        videosdk_room_id: roomId
      })
      .eq("id", userId);

    if (dbError) {
      console.error("❌ Supabase error:", dbError);

      return res.status(500).json({
        success: false,
        error: "Database update failed",
        details: dbError
      });
    }

    // =======================
    // HOST TOKEN (FIXED)
    // =======================
    const hostToken = jwt.sign(
      {
        apikey: VIDEOSDK_API_KEY,
        roomId,
        participantId: userId,
        roles: ["host"],
        permissions: ["allow_join"],
        version: 2
      },
      VIDEOSDK_SECRET,
      {
        algorithm: "HS256",
        expiresIn: "24h"
      }
    );

    console.log("✅ Host token generated");

    res.json({
      success: true,
      roomId,
      hostToken
    });

  } catch (err) {
    console.error("🔥 SERVER ERROR:", err);

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

  if (!roomId || !viewerId || !viewerName) {
    return res.status(400).json({
      error: "Missing roomId, viewerId, or viewerName"
    });
  }

  try {
    const viewerToken = jwt.sign(
      {
        apikey: VIDEOSDK_API_KEY,
        roomId,
        participantId: viewerId,
        roles: ["viewer"],
        permissions: ["allow_join"],
        name: viewerName,
        version: 2
      },
      VIDEOSDK_SECRET,
      {
        algorithm: "HS256",
        expiresIn: "2h"
      }
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
// STOP STREAM
// =======================
app.post("/api/stop-stream", async (req, res) => {
  const { userId } = req.body;

  try {
    await supabase
      .from("profile")
      .update({
        is_live: false,
        stream_ended_at: new Date(),
        videosdk_room_id: null
      })
      .eq("id", userId);

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({
      error: err.message,
      stack: err.stack
    });
  }
});

// =======================
app.get("/", (req, res) => {
  res.send("Backend running ✅");
});

// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
