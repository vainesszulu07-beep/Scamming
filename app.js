import express from 'express';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Serve static files from the 'public' folder
app.use(express.static(path.join(process.cwd(), 'public')));

// Root route -> serve login.html from public
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'login.html'));
});

// Health check route
app.get('/health', (req, res) => {
  res.send('Server is running!');
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
