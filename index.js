import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import fetch from "node-fetch"; // Needed for API calls to VideoSDK

const app = express();
app.use(express.json());
app.use(cors());

// 🔑 VideoSDK keys
const API_KEY = "7b3acbbb-8976-4b84-978a-4533b7b41440";
const API_SECRET = "62db5287e66364a8d97d73cfa1147fd92d4829bdc873648a09f9c640f366770a";

// =======================
// Generate token (your method)
// =======================
function generateToken({ userId, roomId, role }) {
  let payload = { apikey: API_KEY, version: 2 };

  if (roomId && userId) {
    payload = {
      apikey: API_KEY,
      roomId,
      participantId: userId,
      roles: [role || "host"],
      version: 2
    };
  }

  return jwt.sign(payload, API_SECRET, { algorithm: "HS256", expiresIn: "1h" });
}

// =======================
// Create new room
// =======================
app.post("/api/create-room", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, error: "Missing userId" });

  try {
    // 1. Generate a temporary token to create a room
    const tempToken = generateToken({}); // no roomId yet

    // 2. Call VideoSDK API to create a room
    const roomResp = await fetch("https://api.videosdk.live/v2/rooms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tempToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        // optional room settings
        name: `room_${userId}`,
        metadata: { creator: userId }
      })
    });

    const roomData = await roomResp.json();

    if (!roomResp.ok) {
      return res.status(roomResp.status).json({
        success: false,
        error: "Room creation failed",
        raw: roomData
      });
    }

    const roomId = roomData.roomId;

    // 3. Generate host token for the newly created room
    const hostToken = generateToken({ userId, roomId, role: "host" });

    res.json({ success: true, roomId, hostToken });

  } catch (err) {
    console.error("CREATE ROOM ERROR:", err);
    res.status(500).json({ success: false, error: err.message, stack: err.stack });
  }
});

// =======================
// Simple test route
// =======================
app.get("/", (req, res) => res.send("VideoSDK backend + token generator running ✅"));

// =======================
// Start server
// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
