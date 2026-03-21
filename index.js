import express from "express";
import cors from "cors";
import fetch from "node-fetch"; // needed for VideoSDK API calls

const app = express();
app.use(express.json());
app.use(cors());

// 🔑 Your VideoSDK API key
const API_KEY = "7b3acbbb-8976-4b84-978a-4533b7b41440";

// =======================
// Create a new room
// =======================
app.post("/api/create-room", async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, error: "Missing userId" });
  }

  try {
    // Call VideoSDK API using API_KEY directly
    const roomResp = await fetch("https://api.videosdk.live/v2/rooms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`, // ✅ Use API_KEY directly
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: `room_${userId}`, // optional display name
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

    // ✅ Return the roomId to the frontend
    res.json({
      success: true,
      roomId: roomData.roomId
    });

  } catch (err) {
    console.error("CREATE ROOM ERROR:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =======================
// Test route
// =======================
app.get("/", (req, res) => res.send("VideoSDK room creation backend running ✅"));

// =======================
// Start server
// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
