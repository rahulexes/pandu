// ============================================================
// PANDU — Game Lobby Page (3D Three.js Background & Fix Rules Stepper)
// ============================================================

'use client';

import { useEffect, useState, useRef, use } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useSocket, emitGameAction, emitJoinRoom } from '@/hooks/useSocket';
import { useRoomStore } from '@/stores/roomStore';
import { useGameStore } from '@/stores/gameStore';
import { Avatar } from '@/components/lobby/AvatarPicker';
import { GameMode, GamePhase } from '@pandu/shared';
import { soundEngine } from '@/lib/audio';
import { LobbyQRModal } from '@/components/lobby/LobbyQRModal';
import { ThreeHeroCards } from '@/components/home/ThreeHeroCards';

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const router = useRouter();
  const socket = useSocket();
  const room = useRoomStore((s) => s.room);
  const isConnected = useRoomStore((s) => s.isConnected);
  const myPlayerId = useRoomStore((s) => s.myPlayerId);
  const myName = useRoomStore((s) => s.myName);
  const updateSettingsLocal = useRoomStore((s) => s.updateSettings);
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

  // Resilient Host Check
  const savedIsHost = typeof window !== 'undefined' && sessionStorage.getItem('pandu_is_host') === 'true';
  const savedPlayerId = typeof window !== 'undefined' ? sessionStorage.getItem('pandu_player_id') : null;
  const hostPlayer = room?.players.find((p) => p.isHost) || (room?.players && room.players[0]);
  const isHost =
    savedIsHost ||
    (hostPlayer
      ? hostPlayer.id === myPlayerId ||
        hostPlayer.id === savedPlayerId ||
        hostPlayer.name === myName
      : true);

  const me = room?.players.find((p) => p.id === myPlayerId || p.name === myName);
  const isMyReady = me?.isReady ?? false;

  const otherPlayers = room?.players.filter((p) => !p.isHost) || [];
  const readyCount = otherPlayers.filter((p) => p.isReady).length;
  const allReady = otherPlayers.length > 0 && otherPlayers.every((p) => p.isReady);
  const canStart = isHost && (room?.players.length ?? 0) >= 2 && (allReady || otherPlayers.length === 0);

  const cardsDealt = room?.settings.cardsDealt || 4;
  const initialViewable = room?.settings.initialViewable || 2;
  const maxInitialViewable = Math.floor(cardsDealt / 2);
  const currentMode = room?.settings.mode || GameMode.INDIVIDUAL;

  const handleUpdateCardsDealt = (newVal: number) => {
    soundEngine.playCardFlip();
    const clamped = Math.max(2, Math.min(10, newVal));
    const newMaxView = Math.floor(clamped / 2);
    const adjustedView = Math.min(initialViewable, newMaxView);
    updateSettingsLocal({ cardsDealt: clamped, initialViewable: adjustedView });
    emitGameAction('lobby:updateSettings', { cardsDealt: clamped, initialViewable: adjustedView });
  };

  const handleUpdateInitialViewable = (newVal: number) => {
    soundEngine.playCardFlip();
    const clamped = Math.max(1, Math.min(maxInitialViewable, newVal));
    updateSettingsLocal({ initialViewable: clamped });
    emitGameAction('lobby:updateSettings', { initialViewable: clamped });
  };

  const handleSetMode = (mode: GameMode) => {
    soundEngine.playCardFlip();
    updateSettingsLocal({ mode });
    emitGameAction('lobby:setMode', { mode });
  };

  return (
    <div className="min-h-dvh flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden bg-[#0c0e17] text-slate-100 select-none">
      {/* Three.js Fullscreen 3D Floating Cards in Lobby Background */}
      <ThreeHeroCards />

      {/* Ambient background glows */}
      <div className="absolute inset-0 bg-radial from-[#151726]/60 via-[#0c0e17]/85 to-[#07080f] opacity-95 pointer-events-none z-0" />
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[450px] h-[350px] rounded-full bg-[#a855f7]/12 blur-[140px] pointer-events-none z-0" />

      <div className="relative z-10 flex flex-col flex-1 max-w-md mx-auto w-full pb-24 pointer-events-auto">
        {/* ── Top Header ── */}
        <header className="flex items-center justify-between mb-4 pt-1">
          <button
            className="text-sm text-slate-200 hover:text-white font-bold flex items-center gap-1.5 cursor-pointer transition-all bg-[#141724]/80 hover:bg-[#1f2438] px-3.5 py-1.5 rounded-full border border-white/10"
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
            className="p-2 rounded-full bg-[#141724]/80 hover:bg-[#1f2438] border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer text-lg"
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
              className="p-2.5 px-4 rounded-full font-bold text-xs tracking-wider uppercase transition-all duration-200 flex items-center gap-1.5 cursor-pointer shadow-lg bg-[#181c2b]/90 hover:bg-[#20263a] text-slate-200 border border-white/10 hover:border-purple-400/40"
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

        {/* ── Game Mode & Rule Customization (Host Only) ── */}
        {isHost ? (
          <div className="space-y-4 mb-4">
            {/* Game Mode Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-black text-slate-100 tracking-wide">
                  Game Mode
                </h2>
                <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                  Host Setting
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Individual Mode Card */}
                <button
                  className={`p-4 rounded-2xl text-center transition-all relative overflow-hidden cursor-pointer ${
                    currentMode === GameMode.INDIVIDUAL
                      ? 'border-2 border-[#eab308] bg-[#221c17]/95 text-[#fbbf24] shadow-[0_0_25px_rgba(234,179,8,0.25)]'
                      : 'border border-white/10 bg-[#141724]/85 text-slate-400 hover:text-slate-200 hover:bg-[#181c2b]'
                  }`}
                  onClick={() => handleSetMode(GameMode.INDIVIDUAL)}
                >
                  <span className="font-black text-base tracking-wide block">
                    Individual
                  </span>
                </button>

                {/* Team Mode Card */}
                <button
                  className={`p-4 rounded-2xl text-center transition-all relative overflow-hidden cursor-pointer ${
                    currentMode === GameMode.TEAM
                      ? 'border-2 border-[#a855f7] bg-[#1c162b]/95 text-[#c084fc] shadow-[0_0_25px_rgba(168,85,247,0.25)]'
                      : 'border border-white/10 bg-[#141724]/85 text-slate-400 hover:text-slate-200 hover:bg-[#181c2b]'
                  }`}
                  onClick={() => handleSetMode(GameMode.TEAM)}
                >
                  <span className="font-black text-base tracking-wide block">
                    Team Mode
                  </span>
                </button>
              </div>
            </div>

            {/* Rule Customization Section */}
            <div>
              <h2 className="text-sm font-black text-slate-100 tracking-wide mb-2">
                Rule Customization
              </h2>

              <div className="grid grid-cols-2 gap-3">
                {/* Cards Dealt (Y) */}
                <div className="bg-[#141724]/90 border border-white/10 p-3.5 rounded-2xl text-center backdrop-blur-md">
                  <p className="text-xs font-bold text-slate-300 mb-2">
                    Cards Dealt <span className="text-amber-400 font-bold">(Y)</span>
                  </p>
                  <div className="flex items-center justify-center gap-2.5 bg-[#0e101a] py-1.5 px-3 rounded-xl border border-white/10 mx-auto">
                    <button
                      className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center text-xl font-bold text-slate-200 hover:text-amber-300 transition-all cursor-pointer"
                      onClick={() => handleUpdateCardsDealt(cardsDealt - 1)}
                      aria-label="Decrease cards dealt"
                    >
                      −
                    </button>
                    <span className="text-xl font-bold font-mono w-6 text-center text-amber-300">
                      {cardsDealt}
                    </span>
                    <button
                      className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center text-xl font-bold text-slate-200 hover:text-amber-300 transition-all cursor-pointer"
                      onClick={() => handleUpdateCardsDealt(cardsDealt + 1)}
                      aria-label="Increase cards dealt"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Initial Viewable (X) */}
                <div className="bg-[#141724]/90 border border-white/10 p-3.5 rounded-2xl text-center backdrop-blur-md">
                  <p className="text-xs font-bold text-slate-300 mb-2">
                    Initial Viewable <span className="text-amber-400 font-bold">(X)</span>
                  </p>
                  <div className="flex items-center justify-center gap-2.5 bg-[#0e101a] py-1.5 px-3 rounded-xl border border-white/10 mx-auto">
                    <button
                      className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center text-xl font-bold text-slate-200 hover:text-amber-300 transition-all cursor-pointer"
                      onClick={() => handleUpdateInitialViewable(initialViewable - 1)}
                      aria-label="Decrease initial viewable"
                    >
                      −
                    </button>
                    <span className="text-xl font-bold font-mono w-6 text-center text-amber-300">
                      {initialViewable}
                    </span>
                    <button
                      className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center text-xl font-bold text-slate-200 hover:text-amber-300 transition-all cursor-pointer"
                      onClick={() => handleUpdateInitialViewable(initialViewable + 1)}
                      aria-label="Increase initial viewable"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Guest Read-Only Summary Banner */
          <div className="bg-[#141724]/90 border border-purple-500/20 p-3.5 rounded-2xl mb-4 backdrop-blur-md flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-base">🎮</span>
              <div>
                <p className="font-bold text-slate-200">
                  {currentMode === GameMode.TEAM ? '👥 Team Mode' : '👤 Individual Mode'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {cardsDealt} Cards per hand • {initialViewable} Initial peeks
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 bg-purple-500/20 border border-purple-500/30 px-2.5 py-1 rounded-full">
              Configured by Host
            </span>
          </div>
        )}

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
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#141724]/90 border border-purple-500/20 shadow-lg backdrop-blur-md"
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
      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0c0e17] via-[#0c0e17]/95 to-transparent z-30 pointer-events-auto">
        <div className="max-w-md mx-auto w-full">
          {isHost ? (
            <button
              className={`w-full py-4.5 rounded-full font-black text-sm sm:text-base tracking-wider uppercase transition-all duration-200 cursor-pointer shadow-2xl border-2 ${
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
              className={`w-full py-4.5 rounded-full font-black text-sm sm:text-base tracking-wider uppercase transition-all duration-200 cursor-pointer shadow-2xl border-2 ${
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
