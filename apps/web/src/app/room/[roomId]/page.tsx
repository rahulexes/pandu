// ============================================================
// PANDU — Game Lobby Page (Matching Reference Aesthetic)
// ============================================================

'use client';

import { useEffect, useState, useRef, use } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useSocket, emitGameAction, emitJoinRoom } from '@/hooks/useSocket';
import { useRoomStore } from '@/stores/roomStore';
import { useGameStore } from '@/stores/gameStore';
import { Avatar, AvatarPicker } from '@/components/lobby/AvatarPicker';
import { GameMode, GamePhase } from '@pandu/shared';
import { soundEngine } from '@/lib/audio';
import { LobbyQRModal } from '@/components/lobby/LobbyQRModal';

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const router = useRouter();
  const socket = useSocket();
  const room = useRoomStore((s) => s.room);
  const isConnected = useRoomStore((s) => s.isConnected);
  const myPlayerId = useRoomStore((s) => s.myPlayerId);
  const myName = useRoomStore((s) => s.myName);
  const phase = useGameStore((s) => s.phase);

  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Redirect to game table when match starts
  useEffect(() => {
    if (phase !== GamePhase.LOBBY && phase !== GamePhase.GAME_OVER) {
      router.push(`/room/${roomId}/game`);
    }
  }, [phase, roomId, router]);

  // Auto-join if directly navigated via URL link
  const hasAutoJoinedRef = useRef(false);
  useEffect(() => {
    const savedRoom = typeof window !== 'undefined' ? sessionStorage.getItem('pandu_room') : null;
    const currentMyId = typeof window !== 'undefined' ? sessionStorage.getItem('pandu_player_id') : null;
    if (!room && (!savedRoom || savedRoom !== roomId || !currentMyId)) {
      if (!hasAutoJoinedRef.current) {
        hasAutoJoinedRef.current = true;
        const name = (typeof window !== 'undefined' && sessionStorage.getItem('pandu_name')) || `Player_${Math.floor(Math.random() * 900 + 100)}`;
        const avatar = parseInt((typeof window !== 'undefined' && sessionStorage.getItem('pandu_avatar')) || '0', 10);
        emitJoinRoom(roomId, name, avatar);
      }
    }
  }, [room, roomId]);

  const copyInviteLink = () => {
    soundEngine.playCardFlip();
    const link = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Robust check for Host identification
  const hostPlayer = room?.players.find(p => p.isHost);
  const isHost = hostPlayer ? (hostPlayer.id === myPlayerId || hostPlayer.name === myName) : false;
  
  const me = room?.players.find(p => p.id === myPlayerId || p.name === myName);
  const isMyReady = me?.isReady ?? false;

  const otherPlayers = room?.players.filter(p => !p.isHost) || [];
  const readyCount = otherPlayers.filter(p => p.isReady).length;
  const allReady = otherPlayers.length > 0 && otherPlayers.every(p => p.isReady);
  const canStart = isHost && (room?.players.length ?? 0) >= 2 && (allReady || otherPlayers.length === 0);

  const maxInitialViewable = Math.floor((room?.settings.cardsDealt || 4) / 2);
  const currentMode = room?.settings.mode || GameMode.INDIVIDUAL;

  return (
    <div className="min-h-dvh flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden bg-[#0c0e17] text-slate-100 select-none">
      {/* Ambient background glows */}
      <div className="absolute inset-0 bg-radial from-[#151726]/60 via-[#0c0e17] to-[#07080f] opacity-95 pointer-events-none" />
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[450px] h-[350px] rounded-full bg-[#a855f7]/12 blur-[140px] pointer-events-none" />

      {/* Decorative background cards (from reference image) */}
      <div className="absolute top-20 left-2 w-20 h-28 rounded-xl bg-gradient-to-br from-[#1a1429] to-[#0d0a17] border border-[#a855f7]/30 shadow-2xl rotate-[-28deg] opacity-60 pointer-events-none flex items-center justify-center">
        <span className="text-3xl text-purple-400/50">♠</span>
      </div>
      <div className="absolute top-16 right-3 w-20 h-28 rounded-xl bg-gradient-to-br from-[#261f18] to-[#120d09] border border-[#eab308]/30 shadow-2xl rotate-[25deg] opacity-60 pointer-events-none flex items-center justify-center">
        <span className="text-3xl text-amber-400/50">♣</span>
      </div>

      <div className="relative z-10 flex flex-col flex-1 max-w-md mx-auto w-full pb-24">
        {/* ── Top Header ── */}
        <header className="flex items-center justify-between mb-4 pt-1">
          <button
            className="text-sm text-slate-200 hover:text-white font-bold flex items-center gap-1.5 cursor-pointer transition-all"
            onClick={() => {
              soundEngine.playCardFlip();
              emitGameAction('room:leave');
              router.push('/');
            }}
          >
            <span className="text-base">❮</span> Leave
          </button>
          
          <h1 className="font-display text-2xl tracking-wider font-black bg-gradient-to-r from-[#fbbf24] via-[#f3e8ff] to-[#c084fc] bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(192,132,252,0.4)]">
            PANDU
          </h1>

          <button
            className="p-2 rounded-full text-slate-300 hover:text-white transition-all cursor-pointer text-lg"
            onClick={() => {
              soundEngine.playCardFlip();
              setShowSettings(true);
            }}
          >
            ⚙️
          </button>
        </header>

        {/* ── Room Code Hero Section ── */}
        <div className="text-center my-3 relative">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">
            Room Code
          </p>

          <motion.div
            className="text-5xl sm:text-6xl font-mono font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-[#d8b4fe] via-[#f3e8ff] to-[#c084fc] drop-shadow-[0_0_25px_rgba(192,132,252,0.65)] my-1"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            {roomId}
          </motion.div>

          {/* Action Row: Copy Link + Share QR */}
          <div className="flex items-center justify-center gap-2.5 mt-3">
            <button
              className={`px-5 py-2.5 rounded-full font-bold text-xs tracking-wider uppercase transition-all duration-200 flex items-center gap-2 cursor-pointer shadow-lg border ${
                copied
                  ? 'bg-[#1aa260] text-white border-emerald-400'
                  : 'bg-[#181c2b]/90 hover:bg-[#20263a] text-slate-200 border-white/10 hover:border-purple-400/40'
              }`}
              onClick={copyInviteLink}
            >
              <span>📋</span>
              <span>{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>

            <button
              className="p-2.5 px-3.5 rounded-full font-bold text-xs tracking-wider uppercase transition-all duration-200 flex items-center gap-1.5 cursor-pointer shadow-lg bg-[#181c2b]/90 hover:bg-[#20263a] text-slate-200 border border-white/10 hover:border-purple-400/40"
              onClick={() => {
                soundEngine.playCardFlip();
                setShowQR(true);
              }}
              title="Share Room QR Code"
            >
              <span className="text-sm">📱</span>
              <span className="text-[11px] text-slate-300">Share QR</span>
            </button>
          </div>
        </div>

        {/* ── Game Mode Section ── */}
        <div className="mt-4 mb-4">
          <h2 className="text-sm font-black text-slate-100 tracking-wide mb-2.5">
            Game Mode
          </h2>

          <div className="grid grid-cols-2 gap-3">
            {/* Individual Mode Card */}
            <button
              className={`p-4 rounded-2xl text-center transition-all relative overflow-hidden cursor-pointer ${
                currentMode === GameMode.INDIVIDUAL
                  ? 'border-2 border-[#eab308] bg-[#221c17]/90 text-[#fbbf24] shadow-[0_0_25px_rgba(234,179,8,0.25)]'
                  : 'border border-white/10 bg-[#141724]/70 text-slate-400 hover:text-slate-200 hover:bg-[#181c2b]'
              }`}
              onClick={() => {
                if (isHost) {
                  soundEngine.playCardFlip();
                  emitGameAction('lobby:setMode', { mode: 'INDIVIDUAL' });
                }
              }}
              disabled={!isHost}
            >
              <span className="font-black text-base tracking-wide block">
                Individual
              </span>
            </button>

            {/* Team Mode Card */}
            <button
              className={`p-4 rounded-2xl text-center transition-all relative overflow-hidden cursor-pointer ${
                currentMode === GameMode.TEAM
                  ? 'border-2 border-[#a855f7] bg-[#1c162b]/90 text-[#c084fc] shadow-[0_0_25px_rgba(168,85,247,0.25)]'
                  : 'border border-white/10 bg-[#141724]/70 text-slate-400 hover:text-slate-200 hover:bg-[#181c2b]'
              }`}
              onClick={() => {
                if (isHost) {
                  soundEngine.playCardFlip();
                  emitGameAction('lobby:setMode', { mode: 'TEAM' });
                }
              }}
              disabled={!isHost}
            >
              <span className="font-black text-base tracking-wide block">
                Team Mode
              </span>
            </button>
          </div>
        </div>

        {/* ── Rule Customization Section ── */}
        <div className="mb-4">
          <h2 className="text-sm font-black text-slate-100 tracking-wide mb-2.5">
            Rule Customization
          </h2>

          <div className="grid grid-cols-2 gap-3">
            {/* Cards Dealt (Y) */}
            <div className="bg-[#141724]/80 border border-white/10 p-3.5 rounded-2xl text-center">
              <p className="text-xs font-bold text-slate-300 mb-2">
                Cards Dealt <span className="text-amber-400 font-bold">(Y)</span>
              </p>
              <div className="flex items-center justify-center gap-2.5 bg-[#0e101a] py-1.5 px-3 rounded-xl border border-white/5 mx-auto">
                <button
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 active:scale-95 flex items-center justify-center text-lg font-bold text-slate-300 transition-all cursor-pointer disabled:opacity-30"
                  onClick={() => {
                    if (isHost) {
                      soundEngine.playCardFlip();
                      emitGameAction('lobby:updateSettings', { cardsDealt: Math.max(2, (room?.settings.cardsDealt || 4) - 1) });
                    }
                  }}
                  disabled={!isHost}
                >
                  −
                </button>
                <span className="text-xl font-bold font-mono w-6 text-center text-slate-100">
                  {room?.settings.cardsDealt || 4}
                </span>
                <button
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 active:scale-95 flex items-center justify-center text-lg font-bold text-amber-300 transition-all cursor-pointer disabled:opacity-30"
                  onClick={() => {
                    if (isHost) {
                      soundEngine.playCardFlip();
                      emitGameAction('lobby:updateSettings', { cardsDealt: Math.min(10, (room?.settings.cardsDealt || 4) + 1) });
                    }
                  }}
                  disabled={!isHost}
                >
                  +
                </button>
              </div>
            </div>

            {/* Initial Viewable (X) */}
            <div className="bg-[#141724]/80 border border-white/10 p-3.5 rounded-2xl text-center">
              <p className="text-xs font-bold text-slate-300 mb-2">
                Initial Viewable <span className="text-amber-400 font-bold">(X)</span>
              </p>
              <div className="flex items-center justify-center gap-2.5 bg-[#0e101a] py-1.5 px-3 rounded-xl border border-white/5 mx-auto">
                <button
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 active:scale-95 flex items-center justify-center text-lg font-bold text-slate-300 transition-all cursor-pointer disabled:opacity-30"
                  onClick={() => {
                    if (isHost) {
                      soundEngine.playCardFlip();
                      emitGameAction('lobby:updateSettings', { initialViewable: Math.max(1, (room?.settings.initialViewable || 2) - 1) });
                    }
                  }}
                  disabled={!isHost}
                >
                  −
                </button>
                <span className="text-xl font-bold font-mono w-6 text-center text-slate-100">
                  {room?.settings.initialViewable || 2}
                </span>
                <button
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 active:scale-95 flex items-center justify-center text-lg font-bold text-amber-300 transition-all cursor-pointer disabled:opacity-30"
                  onClick={() => {
                    if (isHost) {
                      soundEngine.playCardFlip();
                      emitGameAction('lobby:updateSettings', { initialViewable: Math.min(maxInitialViewable, (room?.settings.initialViewable || 2) + 1) });
                    }
                  }}
                  disabled={!isHost}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Connected Players Section ── */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-sm font-black text-slate-100 tracking-wide">
              Connected Players ({room?.players.length || 0})
            </h2>
          </div>

          <div className="space-y-2.5">
            <AnimatePresence>
              {room?.players.map((player, i) => (
                <motion.div
                  key={player.id}
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#141724]/90 border border-purple-500/20 shadow-lg"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ delay: i * 0.05 }}
                >
                  {/* Glowing Avatar */}
                  <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-purple-700 to-indigo-500 flex items-center justify-center p-0.5 shadow-md shadow-purple-500/30">
                    <Avatar avatarId={player.avatarId} size={40} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm truncate text-slate-100">
                        {player.name}
                      </span>
                      {player.isHost && (
                        <span className="text-amber-400 text-sm">👑</span>
                      )}
                    </div>
                    {player.isHost && (
                      <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full inline-block mt-0.5">
                        Host
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Online</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Fixed Bottom Action Button ── */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0c0e17] via-[#0c0e17]/95 to-transparent z-30">
        <div className="max-w-md mx-auto w-full">
          {isHost ? (
            <button
              className={`w-full py-4 rounded-full font-black text-sm sm:text-base tracking-wider uppercase transition-all duration-200 cursor-pointer shadow-2xl border-2 ${
                canStart
                  ? 'border-purple-400 bg-gradient-to-r from-[#7c3aed] to-[#c084fc] text-white hover:brightness-110 shadow-purple-500/40 animate-pulse'
                  : 'border-purple-500/40 bg-gradient-to-r from-[#581c87]/80 to-[#7e22ce]/80 text-purple-200 shadow-purple-900/30'
              }`}
              onClick={() => {
                if (canStart) {
                  soundEngine.playCardFlip();
                  emitGameAction('lobby:startGame');
                }
              }}
              disabled={!canStart}
            >
              {canStart ? '🎴 START GAME' : (room?.players.length ?? 0) < 2 ? 'WAITING FOR PLAYERS (MIN 2)' : 'WAITING FOR READY'}
            </button>
          ) : (
            <button
              className={`w-full py-4 rounded-full font-black text-sm sm:text-base tracking-wider uppercase transition-all duration-200 cursor-pointer shadow-2xl border-2 ${
                isMyReady
                  ? 'border-emerald-400 bg-emerald-500 text-slate-950 shadow-emerald-500/40'
                  : 'border-purple-400 bg-gradient-to-r from-[#7c3aed] to-[#c084fc] text-white shadow-purple-500/40'
              }`}
              onClick={() => {
                soundEngine.playCardFlip();
                emitGameAction('lobby:toggleReady');
              }}
            >
              {isMyReady ? '✓ READY (TAP TO UNREADY)' : '⚡ READY UP'}
            </button>
          )}
        </div>
      </footer>

      {/* ── Lobby Dynamic Room QR Modal ── */}
      <AnimatePresence>
        {showQR && (
          <LobbyQRModal
            roomCode={roomId}
            onClose={() => setShowQR(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
