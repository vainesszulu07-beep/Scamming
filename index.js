import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";

const app = express();
app.use(express.json());
app.use(cors());

// 🔑 VideoSDK keys
const API_KEY = "7b3acbbb-8976-4b84-978a-4533b7b41440";
const API_SECRET = "62db5287e66364a8d97d73cfa1147fd92d4829bdc873648a09f9c640f366770a";

// =======================
// Generate server token only
// =======================
app.get("/api/server-token", (req, res) => {
  try {
    const payload = { apikey: API_KEY, version: 2 };
    const serverToken = jwt.sign(payload, API_SECRET, { algorithm: "HS256", expiresIn: "1h" });

    res.json({
      success: true,
      serverToken,
      payload // optional, useful for debugging
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =======================
// Test route
// =======================
app.get("/", (req, res) => res.send("VideoSDK server token generator running ✅"));

// =======================
// Start server
// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
