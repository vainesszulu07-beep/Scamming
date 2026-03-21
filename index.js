// backend.js
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";

const app = express();
app.use(express.json());
app.use(cors());

// 🔑 VideoSDK Credentials
const API_KEY = "7b3acbbb-8976-4b84-978a-4533b7b41440";
const API_SECRET = "62db5287e66364a8d97d73cfa1147fd92d4829bdc873648a09f9c640f366770a";

// =======================
// Server Token needs "allow_join" at minimum to create rooms
// =======================
function generateServerToken() {
  return jwt.sign(
    { 
      apikey: API_KEY, 
      permissions: ["allow_join"], // MANDATORY
      version: 2 
    },
    API_SECRET,
    { algorithm: "HS256", expiresIn: "1h" }
  );
}

// =======================
// Host Token needs "allow_join" and "allow_mod" to start the stream
// =======================
function generateHostToken(roomId, userId) {
  return jwt.sign(
    {
      apikey: API_KEY,
      permissions: ["allow_join", "allow_mod"], // MANDATORY
      version: 2,
      roomId: roomId,
      participantId: userId,
      roles: ["rtc"] // "rtc" is the standard role for v2
    },
    API_SECRET,
    { algorithm: "HS256", expiresIn: "1h" }
  );
}

// =======================
// Create room endpoint
// =======================
app.post("/api/create-room", async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, message: "No userId provided" });
  }

  try {
    const serverToken = generateServerToken();

    // 1️⃣ Call VideoSDK API to create a room
    const roomResponse = await fetch("https://api.videosdk.live/v2/rooms", {
      method: "POST",
      headers: {
        "Authorization": serverToken, // MUST include Bearer
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: `room-${userId.substring(0, 8)}`, // optional display name
        metadata: { creator: userId }
      })
    });

    const roomData = await roomResponse.json();

    if (!roomResponse.ok) {
      return res.status(roomResponse.status).json({
        success: false,
        error: "Room creation failed",
        raw: roomData
      });
    }

    const roomId = roomData.roomId;

    // 2️⃣ Generate host token for frontend
    const hostToken = generateHostToken(roomId, userId);

    // 3️⃣ Return data to frontend
    res.json({
      success: true,
      roomId,
      hostToken
    });

  } catch (error) {
    console.error("Backend Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =======================
// Test route
// =======================
app.get("/", (req, res) => res.send("VideoSDK backend running ✅"));

// =======================
// Start server
// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
