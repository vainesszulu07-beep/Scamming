import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 5000;

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from "public"
app.use(express.static(path.join(__dirname, 'public')));

// Default route -> email.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'email.html'));
});

// Optional: serve Google login page
app.get('/google', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'google.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
