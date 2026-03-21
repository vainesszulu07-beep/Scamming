import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";

const app = express();
app.use(express.json());
app.use(cors());

// 🔥 YOUR VIDEOSDK KEYS
const API_KEY = "7b3acbbb-8976-4b84-978a-4533b7b41440";
const API_SECRET = "62db5287e66364a8d97d73cfa1147fd92d4829bdc873648a09f9c640f366770a";

// =======================
// 🔑 GENERATE TOKEN
// =======================
app.post("/api/token", (req, res) => {
  try {
    const { userId, roomId, role } = req.body;

    // ✅ BASIC TOKEN (for room creation)
    let payload = {
      apikey: API_KEY,
      version: 2
    };

    // ✅ If joining a room → add more fields
    if (roomId && userId) {
      payload = {
        apikey: API_KEY,
        roomId: roomId,
        participantId: userId,
        roles: [role || "host"], // default host
        version: 2
      };
    }

    const token = jwt.sign(payload, API_SECRET, {
      algorithm: "HS256",
      expiresIn: "1h"
    });

    res.json({
      success: true,
      token,
      payload // 👈 useful for debugging
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// =======================
app.get("/", (req, res) => {
  res.send("Token server running ✅");
});

// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server on port", PORT);
});
