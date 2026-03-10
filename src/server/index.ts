import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { setupSocket, getRoomManager } from './socket/index';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || ['http://localhost:5173', 'http://localhost:5174'],
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 获取等待中的房间列表
app.get('/api/rooms', (req, res) => {
  const roomManager = getRoomManager();
  if (!roomManager) {
    res.json({ rooms: [] });
    return;
  }
  
  const rooms = roomManager.getRooms()
    .filter(r => r.state === 'waiting')
    .map(r => ({
      id: r.id,
      name: r.name,
      host: r.host,
      playerCount: r.players.length,
      players: r.players.map(p => ({
        id: p.id,
        name: p.name,
        position: p.position,
        type: p.type,
        isReady: p.isReady,
      })),
    }));
  
  res.json({ rooms });
});

// Setup Socket.io
setupSocket(io);

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Mahjong server running on port ${PORT}`);
});
