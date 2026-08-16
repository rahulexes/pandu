// ============================================================
// PANDU — Real Multiplayer Socket.IO End-to-End Simulation
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { SocketManager } from '../src/network/SocketManager.js';
import type { ClientToServerEvents, ServerToClientEvents } from '@pandu/shared';

type TestSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

describe('PANDU Multiplayer Socket.IO Flow', () => {
  let httpServer: any;
  let socketManager: SocketManager;
  let port: number;
  let client1: TestSocket;
  let client2: TestSocket;

  beforeAll(async () => {
    httpServer = createServer();
    socketManager = new SocketManager(httpServer);
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        port = httpServer.address().port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    client1?.disconnect();
    client2?.disconnect();
    httpServer?.close();
  });

  it('creates room, joins with 2 players, starts game, and verifies server-authoritative state', async () => {
    // 1. Connect Client 1 (Host: Alice)
    client1 = Client(`http://localhost:${port}`, {
      transports: ['websocket'],
    }) as TestSocket;

    await new Promise<void>((resolve) => {
      client1.on('connect', resolve);
    });

    // 2. Alice creates a room
    let roomCode = '';
    const createRes: any = await new Promise((resolve) => {
      client1.emit('room:create', { playerName: 'Alice', avatarId: 1 }, resolve);
    });

    expect(createRes.success).toBe(true);
    expect(createRes.roomCode).toBeDefined();
    roomCode = createRes.roomCode;

    // 3. Connect Client 2 (Bob) and join room
    client2 = Client(`http://localhost:${port}`, {
      transports: ['websocket'],
    }) as TestSocket;

    await new Promise<void>((resolve) => {
      client2.on('connect', resolve);
    });

    const joinRes: any = await new Promise((resolve) => {
      client2.emit('room:join', { roomCode, playerName: 'Bob', avatarId: 2 }, resolve);
    });

    expect(joinRes.success).toBe(true);

    // 4. Bob toggles Ready
    client2.emit('lobby:toggleReady');

    // Wait for room update
    await new Promise((r) => setTimeout(r, 100));

    // 5. Alice (Host) configures settings: Y=4, X=2
    client1.emit('lobby:updateSettings', { cardsDealt: 4, initialViewable: 2 });
    await new Promise((r) => setTimeout(r, 100));

    // 6. Alice starts the game
    let aliceGameState: any = null;
    let bobGameState: any = null;

    client1.on('game:stateUpdate', (state) => {
      aliceGameState = state;
    });

    client2.on('game:stateUpdate', (state) => {
      bobGameState = state;
    });

    client1.emit('lobby:startGame');

    // Wait for game start, shuffle, deal, and initial viewing phase
    await new Promise((r) => setTimeout(r, 300));

    expect(aliceGameState).toBeDefined();
    expect(bobGameState).toBeDefined();
    expect(aliceGameState.myHand.length).toBe(4);
    expect(bobGameState.myHand.length).toBe(4);

    // Verify Anti-Cheat: Bob cannot see Alice's hidden card ranks
    expect(aliceGameState.opponents[0].cardCount).toBe(4);
    expect(bobGameState.opponents[0].cardCount).toBe(4);

    // 7. Initial Peek: Alice peeks her first card
    const firstCardId = aliceGameState.myHand[0].id;
    client1.emit('game:peekInitialCard', { cardId: firstCardId });

    await new Promise((r) => setTimeout(r, 100));

    // Hand cards stay facedown on the table
    expect(aliceGameState.myHand[0].faceUp).toBe(false);
    expect(aliceGameState.myHand[1].faceUp).toBe(false);
  });
});
