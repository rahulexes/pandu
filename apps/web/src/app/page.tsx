// ============================================================
// PANDU — Home Page (Responsive Split Layout & Interactive Profile)
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useSocket, emitCreateRoom, emitJoinRoom } from '@/hooks/useSocket';
import { useRoomStore } from '@/stores/roomStore';
import { Avatar, AvatarPicker } from '@/components/lobby/AvatarPicker';
import { soundEngine } from '@/lib/audio';
import { ThreeHeroCards } from '@/components/home/ThreeHeroCards';
import { QRCodeShare } from '@/components/home/QRCodeShare';

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
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
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

    setIsMuted(soundEngine.getMuted());
  }, [setMyName, setMyAvatarId]);

  const handleSaveProfile = (newName: string, newAvatarId: number) => {
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
    setShowProfileModal(false);
  };

  const handleToggleSound = () => {
    const muted = soundEngine.toggleMute();
    setIsMuted(muted);
  };

  // Check for kicked notification on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('kicked') === 'true') {
        const kickedRoom = params.get('room');
        setError(`You were kicked by the room host${kickedRoom ? ` for room ${kickedRoom}` : ''}. 1-minute cooldown active.`);
        window.history.replaceState({}, '', '/');
      }
    }
  }, []);

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
    const cleanCode = roomCode.trim().toUpperCase();
    if (!cleanCode) {
      setError('Please enter a 6-character room code');
      return;
    }

    const kickedUntilStr = typeof window !== 'undefined' ? sessionStorage.getItem(`pandu_kicked_${cleanCode}`) : null;
    if (kickedUntilStr) {
      const kickedUntil = parseInt(kickedUntilStr, 10);
      if (Date.now() < kickedUntil) {
        const remainingSec = Math.ceil((kickedUntil - Date.now()) / 1000);
        setError(`You were kicked from room ${cleanCode}. Cooldown active (${remainingSec}s remaining).`);
        return;
      }
    }

    soundEngine.playCardFlip();
    setLoading(true);
    setError('');

    try {
      const result = await emitJoinRoom(cleanCode, name, avatarId);
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
    <div className="min-h-dvh flex flex-col justify-between p-4 sm:p-6 md:p-10 relative overflow-hidden bg-[#0a0d14] text-slate-100 select-none">
      {/* Three.js 3D Fullscreen Floating Cards Background */}
      <ThreeHeroCards />

      {/* Ambient background glows */}
      <div className="absolute inset-0 bg-radial from-[#121624]/40 via-[#0a0d14]/80 to-[#07090f] opacity-90 pointer-events-none z-0" />
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-[#38bdf8]/8 blur-[160px] pointer-events-none z-0" />
      <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] rounded-full bg-[#c084fc]/8 blur-[160px] pointer-events-none z-0" />
      <div className="absolute -bottom-40 left-1/3 w-[500px] h-[500px] rounded-full bg-[#f472b6]/8 blur-[160px] pointer-events-none z-0" />

      {/* ── Top Bar (Right Settings Button) ── */}
      <header className="relative z-20 flex items-center justify-end w-full max-w-6xl mx-auto pt-1 pointer-events-auto">
        <button
          className="px-4 py-2.5 rounded-full bg-[#131722]/85 hover:bg-[#1c2233] text-slate-200 hover:text-white border border-white/10 shadow-lg shadow-black/40 transition-all cursor-pointer flex items-center gap-2 text-xs md:text-sm font-bold backdrop-blur-xl"
          onClick={() => {
            soundEngine.playCardFlip();
            setShowSettingsModal(true);
          }}
        >
          <span>⚙️</span> Settings
        </button>
      </header>

      {/* ── Main Responsive Container ── */}
      {/* Desktop (md:): Left Half = Logo + Big Profile, Right Half = Centered Create/Join Buttons */}
      {/* Mobile (<md:): Upper Half = Logo + Big Profile, Lower Half = Centered Create/Join Buttons */}
      <div className="relative z-10 flex-1 flex flex-col md:grid md:grid-cols-2 md:items-center md:gap-12 max-w-6xl mx-auto w-full my-auto py-4">
        
        {/* ── LEFT HALF (Desktop) / UPPER HALF (Mobile) ── */}
        <div className="flex flex-col items-center justify-center text-center space-y-4 md:space-y-6">
          {/* Jewel Crown Icon */}
          <motion.div
            className="text-6xl sm:text-7xl md:text-8xl mb-0 filter drop-shadow-[0_4px_20px_rgba(251,191,36,0.5)] select-none pointer-events-none"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            👑
          </motion.div>

          {/* PANDU Gradient Title (No Gemini logos on either side) */}
          <div className="flex items-center justify-center">
            <h1 className="font-display text-6xl sm:text-7xl md:text-8xl font-black tracking-wider bg-gradient-to-r from-[#38bdf8] via-[#c084fc] to-[#f472b6] bg-clip-text text-transparent drop-shadow-[0_4px_35px_rgba(192,132,252,0.5)]">
              PANDU
            </h1>
          </div>

          <p className="text-slate-400 text-xs sm:text-sm md:text-base font-black tracking-[0.35em] uppercase pointer-events-none">
            Multiplayer Card Game
          </p>

          {/* ── Big Interactive Profile (2x Size & Big Name Font) ── */}
          <motion.div
            className="mt-2 group flex items-center gap-4 md:gap-5 bg-[#131722]/90 hover:bg-[#1a2030] backdrop-blur-2xl p-3 sm:p-4 pr-6 sm:pr-8 rounded-3xl border-2 border-purple-500/30 hover:border-purple-400/60 shadow-2xl shadow-purple-500/20 transition-all cursor-pointer pointer-events-auto"
            onClick={() => {
              soundEngine.playCardFlip();
              setShowProfileModal(true);
            }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            title="Click to change your avatar & name"
          >
            {/* 2x Size Avatar (w-20 h-20 / 72px) */}
            <div className="w-18 h-18 sm:w-20 sm:h-20 md:w-22 md:h-22 rounded-full bg-gradient-to-tr from-purple-600 via-pink-500 to-amber-400 flex items-center justify-center p-1 shadow-xl shadow-purple-500/40 group-hover:rotate-6 transition-transform">
              <Avatar avatarId={avatarId} size={70} />
            </div>

            {/* Big Name & Edit Prompt */}
            <div className="text-left">
              <p className="text-lg sm:text-xl md:text-2xl font-black text-white truncate max-w-[170px] sm:max-w-[220px] leading-tight tracking-wide group-hover:text-amber-300 transition-colors">
                {name || 'Player'}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[11px] sm:text-xs text-[#c084fc] font-black uppercase tracking-wider">
                  ✏️ Edit Profile
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── RIGHT HALF (Desktop) / LOWER HALF (Mobile) ── */}
        <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto mt-6 md:mt-0 pointer-events-auto">
          <AnimatePresence mode="wait">
            {mode === 'home' && (
              <motion.div
                key="home-actions"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full space-y-4 sm:space-y-5"
              >
                {/* Primary Gradient Pill: CREATE PRIVATE ROOM */}
                <button
                  className="w-full py-5 sm:py-6 px-8 rounded-3xl font-black text-base sm:text-lg md:text-xl tracking-wider text-white bg-gradient-to-r from-[#0ea5e9] via-[#a855f7] to-[#f43f5e] shadow-2xl shadow-purple-500/40 hover:shadow-purple-500/60 hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-3 border-2 border-white/20"
                  onClick={handleCreateRoom}
                  disabled={loading}
                >
                  <span className="text-xl">✨</span>
                  <span>{loading ? 'CREATING ROOM...' : 'CREATE ROOM'}</span>
                </button>

                {/* Secondary Translucent Pill: JOIN WITH CODE */}
                <button
                  className="w-full py-5 sm:py-6 px-8 rounded-3xl font-black text-base sm:text-lg md:text-xl tracking-wider text-slate-100 bg-[#131722]/90 hover:bg-[#1d2436] border-2 border-white/15 hover:border-purple-400/40 shadow-xl shadow-black/50 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-3 backdrop-blur-xl"
                  onClick={() => {
                    soundEngine.playCardFlip();
                    setMode('join');
                  }}
                >
                  <span className="text-xl">🔗</span>
                  <span>JOIN WITH CODE</span>
                </button>
              </motion.div>
            )}

            {mode === 'join' && (
              <motion.div
                key="join-actions"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full space-y-3.5"
              >
                <button
                  className="text-xs sm:text-sm text-slate-400 hover:text-white flex items-center gap-1.5 mb-1 cursor-pointer font-bold transition-all"
                  onClick={() => {
                    soundEngine.playCardFlip();
                    setMode('home');
                    setError('');
                  }}
                >
                  <span>←</span> Back to Main Menu
                </button>

                <div className="glass-strong rounded-3xl p-6 border-2 border-purple-500/30 shadow-2xl space-y-4 bg-[#131722]/95 backdrop-blur-xl">
                  <h2 className="font-display text-base sm:text-lg text-center text-slate-100 font-bold">
                    Enter 6-Letter Room Code
                  </h2>

                  <div>
                    <input
                      type="text"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      placeholder="e.g. QK5ZPG"
                      maxLength={6}
                      className="w-full bg-[#0c101b] border-2 border-white/15 rounded-2xl px-4 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-[#c084fc] text-center tracking-[0.3em] text-2xl sm:text-3xl font-mono font-black uppercase transition-all shadow-inner"
                    />
                  </div>

                  {error && (
                    <div className="text-xs text-rose-400 text-center bg-rose-500/10 border border-rose-500/20 rounded-2xl py-2 px-3 font-semibold">
                      ⚠️ {error}
                    </div>
                  )}

                  <button
                    className="w-full py-4.5 px-6 rounded-2xl font-black text-base tracking-wider text-white bg-gradient-to-r from-[#0ea5e9] to-[#f43f5e] shadow-xl shadow-purple-500/30 hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
                    onClick={handleJoinRoom}
                    disabled={loading}
                  >
                    <span>🚀</span>
                    <span>{loading ? 'JOINING ROOM...' : 'JOIN ROOM'}</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Profile Edit Modal (Opened by clicking Avatar or Name) ── */}
      <AnimatePresence>
        {showProfileModal && (
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="glass-strong rounded-3xl p-6 sm:p-7 max-w-sm w-full border-2 border-purple-500/40 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto bg-[#131722]/98"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
                  <span>👤</span> Edit Your Profile
                </h3>
                <button
                  className="text-slate-400 hover:text-white text-lg p-1 cursor-pointer"
                  onClick={() => setShowProfileModal(false)}
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
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center p-1 shadow-lg shadow-pink-500/30">
                    <Avatar avatarId={avatarId} size={70} />
                  </div>
                </div>
                <AvatarPicker selectedId={avatarId} onSelect={setAvatarId} />
              </div>

              {/* Name Input */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">
                  Player Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  maxLength={18}
                  className="w-full bg-[#0c101b] border border-white/15 rounded-2xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#c084fc] font-bold text-sm transition-all"
                />
              </div>

              <button
                className="w-full py-3.5 px-6 rounded-2xl font-black text-sm tracking-wider text-white bg-gradient-to-r from-[#0ea5e9] via-[#a855f7] to-[#f43f5e] shadow-lg shadow-purple-500/30 hover:brightness-110 transition-all cursor-pointer"
                onClick={() => handleSaveProfile(name, avatarId)}
              >
                💾 SAVE PROFILE
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Settings Modal (Sound Button & Share QR Code — No Profile) ── */}
      <AnimatePresence>
        {showSettingsModal && (
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="glass-strong rounded-3xl p-6 max-w-sm w-full border-2 border-purple-500/30 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto bg-[#131722]/98"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
                  <span>⚙️</span> Game Settings
                </h3>
                <button
                  className="text-slate-400 hover:text-white text-lg p-1 cursor-pointer"
                  onClick={() => setShowSettingsModal(false)}
                >
                  ✕
                </button>
              </div>

              {/* Sound Setting Toggle */}
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    <span>{isMuted ? '🔇' : '🔊'}</span> Game Audio
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Card sounds & special effects
                  </p>
                </div>
                <button
                  className={`px-4 py-2 rounded-xl text-xs font-black tracking-wider transition-all cursor-pointer ${
                    isMuted
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                  }`}
                  onClick={handleToggleSound}
                >
                  {isMuted ? 'MUTED' : 'ENABLED'}
                </button>
              </div>

              {/* Website QR Code Share */}
              <div className="pt-1">
                <QRCodeShare />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
