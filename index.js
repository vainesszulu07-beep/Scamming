import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
// Remove 'import fetch' if using Node.js 18+

const app = express();
app.use(express.json());
app.use(cors());

const API_KEY = "7b3acbbb-8976-4b84-978a-4533b7b41440";
const API_SECRET = "62db5287e66364a8d97d73cfa1147fd92d4829bdc873648a09f9c640f366770a";

// 1. Fixed Server Token: Added 'permissions' (Mandatory for API calls)
function generateServerToken() {
  const payload = { 
    apikey: API_KEY, 
    permissions: ["allow_join"], // Required to authorize the API request
    version: 2 
  };
  return jwt.sign(payload, API_SECRET, { algorithm: "HS256", expiresIn: "1h" });
}

// 2. Fixed Host Token: Added 'permissions' alongside roles
function generateHostToken(userId, roomId) {
  const payload = {
    apikey: API_KEY,
    roomId,
    participantId: userId,
    permissions: ["allow_join", "allow_mod"], // Host needs these to manage the room
    roles: ["rtc"], // 'rtc' is the standard role for participants
    version: 2
  };
  return jwt.sign(payload, API_SECRET, { algorithm: "HS256", expiresIn: "1h" });
}

app.post("/api/create-room", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, error: "Missing userId" });

  try {
    const serverToken = generateServerToken();

    const roomResp = await fetch("https://api.videosdk.live/v2/rooms", {
      method: "POST",
      headers: {
        Authorization: serverToken, // Usually 'Bearer' prefix is optional but token is mandatory
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: `room_${userId}` })
    });

    const roomData = await roomResp.json();

    if (!roomResp.ok) {
      return res.status(roomResp.status).json({ success: false, error: roomData });
    }

    const roomId = roomData.roomId;
    const hostToken = generateHostToken(userId, roomId);

    res.json({ success: true, roomId, hostToken });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
