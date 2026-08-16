// ============================================================
// PANDU — Home Page (Permanent Profile & Settings Modal)
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useSocket, emitCreateRoom, emitJoinRoom } from '@/hooks/useSocket';
import { useRoomStore } from '@/stores/roomStore';
import { Avatar, AvatarPicker } from '@/components/lobby/AvatarPicker';
import { soundEngine } from '@/lib/audio';

const COOL_NAMES = [
  'ShadowAce', 'MysticFox', 'LuckyFalcon', 'ThunderWolf',
  'GoldenJack', 'RoyalQueen', 'CyberSamurai', 'VortexKing',
  'NovaStrike', 'PhoenixLord', 'ApexPhantom', 'BlazeRider',
];

function generateRandomProfile() {
  const base = COOL_NAMES[Math.floor(Math.random() * COOL_NAMES.length)];
  const num = Math.floor(Math.random() * 90 + 10);
  const avatar = Math.floor(Math.random() * 16);
  return { name: `${base}_${num}`, avatarId: avatar };
}

export default function HomePage() {
  const router = useRouter();
  const socket = useSocket();
  const { setMyName, setMyAvatarId, isConnected } = useRoomStore();

  const [name, setName] = useState('');
  const [avatarId, setAvatarId] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [mode, setMode] = useState<'home' | 'join'>('home');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Hydrate permanent device profile from localStorage
  useEffect(() => {
    let savedName = localStorage.getItem('pandu_profile_name');
    let savedAvatar = localStorage.getItem('pandu_profile_avatar');

    if (!savedName || savedAvatar === null) {
      const generated = generateRandomProfile();
      savedName = generated.name;
      savedAvatar = generated.avatarId.toString();
      localStorage.setItem('pandu_profile_name', savedName);
      localStorage.setItem('pandu_profile_avatar', savedAvatar);
    }

    const avId = parseInt(savedAvatar, 10) || 0;
    setName(savedName);
    setAvatarId(avId);
    setMyName(savedName);
    setMyAvatarId(avId);
    sessionStorage.setItem('pandu_name', savedName);
    sessionStorage.setItem('pandu_avatar', avId.toString());
  }, [setMyName, setMyAvatarId]);

  const handleSaveSettings = (newName: string, newAvatarId: number) => {
    soundEngine.playCardFlip();
    const trimmed = newName.trim() || name;
    setName(trimmed);
    setAvatarId(newAvatarId);
    setMyName(trimmed);
    setMyAvatarId(newAvatarId);
    localStorage.setItem('pandu_profile_name', trimmed);
    localStorage.setItem('pandu_profile_avatar', newAvatarId.toString());
    sessionStorage.setItem('pandu_name', trimmed);
    sessionStorage.setItem('pandu_avatar', newAvatarId.toString());
    setShowSettings(false);
  };

  const handleCreateRoom = useCallback(async () => {
    soundEngine.playCardFlip();
    setLoading(true);
    setError('');

    try {
      const result = await emitCreateRoom(name, avatarId);
      if (result.success && result.roomCode) {
        router.push(`/room/${result.roomCode}`);
      } else {
        setError(result.error || 'Failed to create room');
      }
    } catch {
      setError('Connection error. Please check server.');
    }
    setLoading(false);
  }, [name, avatarId, router]);

  const handleJoinRoom = useCallback(async () => {
    if (!roomCode.trim()) {
      setError('Please enter a 6-character room code');
      return;
    }
    soundEngine.playCardFlip();
    setLoading(true);
    setError('');

    try {
      const result = await emitJoinRoom(roomCode.trim().toUpperCase(), name, avatarId);
      if (result.success && result.roomCode) {
        router.push(`/room/${result.roomCode}`);
      } else {
        setError(result.error || 'Room not found or game already started');
      }
    } catch {
      setError('Connection error. Please check server.');
    }
    setLoading(false);
  }, [roomCode, name, avatarId, router]);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 relative overflow-hidden bg-[#030712] text-slate-100">
      {/* Dynamic ambient background glows */}
      <div className="absolute inset-0 bg-radial from-[#0d1a29]/70 via-[#030712] to-[#010409] opacity-95 pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-amber-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />

      {/* ── Top Permanent Profile Bar ── */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-20 max-w-md mx-auto">
        <div className="flex items-center gap-3 bg-white/5 hover:bg-white/10 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10 shadow-lg shadow-black/50 transition-all">
          <Avatar avatarId={avatarId} size={36} />
          <div className="text-left">
            <p className="text-xs font-bold text-slate-100 truncate max-w-[120px]">{name || 'Player'}</p>
            <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Profile</p>
          </div>
        </div>

        <button
          className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white border border-white/10 shadow-lg shadow-black/50 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          onClick={() => {
            soundEngine.playCardFlip();
            setShowSettings(true);
          }}
        >
          <span>⚙️</span> Settings
        </button>
      </div>

      {/* Main Container */}
      <motion.div
        className="relative z-10 w-full max-w-md mt-16"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Glowing Logo */}
        <div className="text-center mb-8">
          <div className="inline-block relative">
            <h1 className="font-display text-6xl sm:text-7xl tracking-widest bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_4px_30px_rgba(245,158,11,0.45)]">
              PANDU
            </h1>
          </div>
          <p className="text-slate-400 text-xs mt-2.5 font-black tracking-[0.35em] uppercase">
            Multiplayer Online Card Game
          </p>
        </div>

        {/* Server Connection Status */}
        <div className="flex items-center justify-center gap-2 mb-6 bg-black/40 border border-white/5 py-1.5 px-4 rounded-full w-fit mx-auto shadow-inner">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span className="text-[11px] font-bold text-slate-300 tracking-wide">
            Realtime Cloud Multiplayer Ready
          </span>
        </div>

        {/* Home Action Cards */}
        <AnimatePresence mode="wait">
          {mode === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-4"
            >
              <button
                className="btn-primary w-full py-4 text-lg font-black tracking-wider cursor-pointer shadow-xl"
                onClick={handleCreateRoom}
                disabled={loading}
              >
                {loading ? 'Creating VIP Room...' : '✨ CREATE PRIVATE ROOM'}
              </button>

              <button
                className="btn-secondary w-full py-4 text-lg font-black tracking-wider cursor-pointer"
                onClick={() => {
                  soundEngine.playCardFlip();
                  setMode('join');
                }}
              >
                🔗 JOIN WITH ROOM CODE
              </button>
            </motion.div>
          )}

          {mode === 'join' && (
            <motion.div
              key="join"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-4"
            >
              <button
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 mb-2 cursor-pointer"
                onClick={() => {
                  soundEngine.playCardFlip();
                  setMode('home');
                  setError('');
                }}
              >
                ← Back to Home
              </button>

              <div className="glass rounded-2xl p-6 border border-white/10 space-y-4">
                <h2 className="font-display text-lg text-center text-slate-200">
                  Join Private Room
                </h2>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">
                    6-Character Room Code
                  </label>
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="e.g. QK5ZPG"
                    maxLength={6}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400 text-center tracking-[0.3em] text-2xl font-mono font-bold uppercase transition-all"
                  />
                </div>

                {error && (
                  <div className="text-xs text-rose-400 text-center bg-rose-500/10 border border-rose-500/20 rounded-xl py-2 px-3">
                    ⚠️ {error}
                  </div>
                )}

                <button
                  className="btn-primary w-full py-3.5 text-base font-black tracking-wider cursor-pointer"
                  onClick={handleJoinRoom}
                  disabled={loading}
                >
                  {loading ? 'Joining Room...' : '🚀 JOIN ROOM'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Settings / Profile Modal ── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="glass-strong rounded-3xl p-6 max-w-sm w-full border border-amber-500/30 shadow-2xl space-y-5"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="font-display text-lg text-amber-300">Player Profile Settings</h3>
                <button
                  className="text-slate-400 hover:text-white text-lg p-1"
                  onClick={() => setShowSettings(false)}
                >
                  ✕
                </button>
              </div>

              {/* Avatar Picker */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block text-center">
                  Choose Avatar
                </label>
                <div className="flex justify-center mb-3">
                  <Avatar avatarId={avatarId} size={64} />
                </div>
                <AvatarPicker selectedId={avatarId} onSelect={setAvatarId} />
              </div>

              {/* Name Input */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">
                  Device Display Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  maxLength={18}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 font-bold text-sm transition-all"
                />
              </div>

              <button
                className="btn-primary w-full py-3 text-sm font-black tracking-wider cursor-pointer"
                onClick={() => handleSaveSettings(name, avatarId)}
              >
                💾 SAVE PERMANENT PROFILE
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
