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

/**
 * Generates a token to authorize your server to talk to VideoSDK APIs
 */
function generateServerToken() {
  return jwt.sign(
    { apikey: API_KEY, permissions: ["allow_join"], version: 2 },
    API_SECRET,
    { algorithm: "HS256", expiresIn: "1h" }
  );
}

/**
 * Generates the specific token your frontend needs to join as a host
 */
function generateHostToken(roomId, userId) {
  return jwt.sign(
    {
      apikey: API_KEY,
      permissions: ["allow_join", "allow_mod"], // 'allow_mod' makes them the host
      version: 2,
      roomId: roomId,
      participantId: userId,
      roles: ["rtc"]
    },
    API_SECRET,
    { algorithm: "HS256", expiresIn: "1h" }
  );
}

// MATCHES FRONTEND: fetch(".../api/create-room")
app.post("/api/create-room", async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, message: "No userId provided" });
  }

  try {
    const serverToken = generateServerToken();

    // 1. Ask VideoSDK to create a new room ID
    const roomResponse = await fetch("https://videosdk.live", {
      method: "POST",
      headers: { 
        "Authorization": serverToken, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ customRoomId: `room-${userId.substring(0, 8)}` })
    });

    const roomData = await roomResponse.json();

    if (!roomResponse.ok) {
      throw new Error(roomData.message || "VideoSDK Room Creation Failed");
    }

    const roomId = roomData.roomId;

    // 2. Create the specific host token for this user and this room
    const hostToken = generateHostToken(roomId, userId);

    // 3. Return the exact structure the frontend expects
    res.json({
      success: true,
      roomId: roomId,
      hostToken: hostToken
    });

  } catch (error) {
    console.error("Backend Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Backend ready on port ${PORT}`));
