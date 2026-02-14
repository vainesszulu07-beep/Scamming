import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 5000;

// Serve static files from public folder
app.use(express.static(path.join(__dirname, "public")));

// Homepage
app.get("/", (req, res) => {
  res.sendFile("login.html", { root: path.join(__dirname, "public") });
});

// Optional: simple route to test server is running
app.get("/ping", (req, res) => {
  res.send("Server is up ✅");
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
