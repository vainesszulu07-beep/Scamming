import express from "express";
import jwt from "jsonwebtoken";
import cors from "cors";
import fetch from "node-fetch"; // for calling VideoSDK API

const app = express();
app.use(express.json());
app.use(cors());

// =======================
// VideoSDK Keys
// =======================
const VIDEOSDK_API_KEY = "7b3acbbb-8976-4b84-978a-4533b7b41440";
const VIDEOSDK_SECRET = "62db5287e66364a8d97d73cfa1147fd92d4829bdc873648a09f9c640f366770a";

// =======================
// CREATE NEW ROOM
// =======================
app.post("/api/create-room", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    console.log("➡️ Creating new room for user:", userId);

    // 1️⃣ Generate a temporary token to create a room
    const tempToken = jwt.sign(
      { apikey: VIDEOSDK_API_KEY, version: 2 },
      VIDEOSDK_SECRET,
      { algorithm: "HS256", expiresIn: "10m" } // short-lived
    );

    // 2️⃣ Create room via VideoSDK API
    const roomResp = await fetch("https://api.videosdk.live/v2/rooms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tempToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: `room_${userId}_${Date.now()}`, // unique name
        // optional: enableRecording: true
      })
    });

    const rawText = await roomResp.text();

    console.log("📡 VideoSDK STATUS:", roomResp.status);
    console.log("📡 VideoSDK RAW RESPONSE:", rawText);

    let roomData;
    try {
      roomData = JSON.parse(rawText);
    } catch {
      roomData = { raw: rawText };
    }

    if (!roomResp.ok) {
      return res.status(roomResp.status).json({
        success: false,
        error: "VideoSDK room creation failed",
        raw: rawText,
        parsed: roomData
      });
    }

    const roomId = roomData.roomId;
    console.log("✅ Room created:", roomId);

    // 3️⃣ Generate host token for WebRTC
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
    console.error("🔥 CREATE ROOM ERROR:", err);
    res.status(500).json({ success: false, error: err.message, stack: err.stack });
  }
});

// =======================
// TEST ROUTE
// =======================
app.get("/", (req, res) => res.send("VideoSDK Room Backend running ✅"));

// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
