// ============================================================
// PANDU — Server Entry Point
// ============================================================

import { createServer } from 'http';
import { SocketManager } from './network/SocketManager.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

const httpServer = createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

const socketManager = new SocketManager(httpServer);

httpServer.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║         🎴 PANDU Game Server 🎴          ║
  ║                                          ║
  ║   Running on port ${PORT}                 ║
  ║   Socket.IO ready for connections        ║
  ╚══════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SERVER] SIGTERM received, shutting down...');
  httpServer.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[SERVER] SIGINT received, shutting down...');
  httpServer.close(() => {
    process.exit(0);
  });
});
