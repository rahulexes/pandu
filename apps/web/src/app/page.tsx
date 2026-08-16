// ============================================================
// PANDU — Home Page (3D Floating Three.js Cards & QR Settings)
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
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'profile' | 'qr'>('profile');
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
    <div className="min-h-dvh flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden bg-[#0a0d14] text-slate-100 select-none">
      {/* Three.js 3D Fullscreen Floating Cards Background */}
      <ThreeHeroCards />

      {/* Softer low-contrast ambient background glows */}
      <div className="absolute inset-0 bg-radial from-[#121624]/40 via-[#0a0d14]/80 to-[#07090f] opacity-90 pointer-events-none z-0" />
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-[#38bdf8]/8 blur-[160px] pointer-events-none z-0" />
      <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] rounded-full bg-[#c084fc]/8 blur-[160px] pointer-events-none z-0" />
      <div className="absolute -bottom-40 left-1/3 w-[500px] h-[500px] rounded-full bg-[#f472b6]/8 blur-[160px] pointer-events-none z-0" />

      {/* ── Top Bar (Device Profile & Settings) ── */}
      <header className="relative z-20 flex items-center justify-between w-full max-w-md mx-auto pt-2 pointer-events-auto">
        {/* Left Profile Chip */}
        <div className="flex items-center gap-3 bg-[#131722]/80 hover:bg-[#1c2233] backdrop-blur-xl pl-2 pr-5 py-2 rounded-full border border-white/10 shadow-lg shadow-black/40 transition-all">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center p-0.5 shadow-md shadow-pink-500/20">
            <Avatar avatarId={avatarId} size={36} />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-100 truncate max-w-[130px] leading-tight">
              {name || 'Player'}
            </p>
            <p className="text-[10px] text-[#c084fc] font-bold uppercase tracking-widest leading-none mt-0.5">
              Device Profile
            </p>
          </div>
        </div>

        {/* Right Settings Button */}
        <button
          className="px-4 py-2.5 rounded-full bg-[#131722]/80 hover:bg-[#1c2233] text-slate-200 hover:text-white border border-white/10 shadow-lg shadow-black/40 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          onClick={() => {
            soundEngine.playCardFlip();
            setSettingsTab('profile');
            setShowSettings(true);
          }}
        >
          <span>⚙️</span> Settings
        </button>
      </header>

      {/* ── Central Hero Logo (Overlaying 3D floating cards) ── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full my-auto pointer-events-none">
        <div className="flex flex-col items-center justify-center">
          {/* Jewel Crown Icon */}
          <motion.div
            className="text-5xl sm:text-6xl mb-1 filter drop-shadow-[0_4px_16px_rgba(251,191,36,0.45)] select-none"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            👑
          </motion.div>

          {/* PANDU Gradient Title with Sparkles */}
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl sm:text-3xl text-[#38bdf8] animate-pulse">✦</span>
            <h1 className="font-display text-6xl sm:text-7xl font-black tracking-wider bg-gradient-to-r from-[#38bdf8] via-[#c084fc] to-[#f472b6] bg-clip-text text-transparent drop-shadow-[0_4px_30px_rgba(192,132,252,0.45)]">
              PANDU
            </h1>
            <span className="text-2xl sm:text-3xl text-[#f472b6] animate-pulse">✦</span>
          </div>

          {/* Subtext */}
          <p className="text-slate-400 text-xs sm:text-sm mt-1 font-black tracking-[0.3em] uppercase text-center">
            Multiplayer Card Game
          </p>
        </div>
      </main>

      {/* ── Bottom Interactive Action Buttons (Bigger & Prominent) ── */}
      <footer className="relative z-20 w-full max-w-md mx-auto pb-4 pointer-events-auto">
        <AnimatePresence mode="wait">
          {mode === 'home' && (
            <motion.div
              key="home-actions"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-4"
            >
              {/* Primary Gradient Pill: CREATE PRIVATE ROOM */}
              <button
                className="w-full py-4.5 sm:py-5 px-8 rounded-full font-black text-base sm:text-lg tracking-wider text-white bg-gradient-to-r from-[#0ea5e9] via-[#a855f7] to-[#f43f5e] shadow-2xl shadow-purple-500/30 hover:shadow-purple-500/50 hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2.5 border border-white/20"
                onClick={handleCreateRoom}
                disabled={loading}
              >
                <span className="text-lg">✨</span>
                <span>{loading ? 'CREATING ROOM...' : 'CREATE PRIVATE ROOM'}</span>
              </button>

              {/* Secondary Translucent Pill: JOIN WITH CODE */}
              <button
                className="w-full py-4.5 sm:py-5 px-8 rounded-full font-bold text-base sm:text-lg tracking-wider text-slate-200 bg-[#131722]/85 hover:bg-[#1c2233] border border-white/15 hover:border-white/25 shadow-xl shadow-black/50 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2.5 backdrop-blur-xl"
                onClick={() => {
                  soundEngine.playCardFlip();
                  setMode('join');
                }}
              >
                <span className="text-lg">🔗</span>
                <span>JOIN WITH CODE</span>
              </button>
            </motion.div>
          )}

          {mode === 'join' && (
            <motion.div
              key="join-actions"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-3"
            >
              <button
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 mb-1 cursor-pointer font-bold transition-all"
                onClick={() => {
                  soundEngine.playCardFlip();
                  setMode('home');
                  setError('');
                }}
              >
                <span>←</span> Back to Main Menu
              </button>

              <div className="glass-strong rounded-3xl p-5 border border-purple-500/30 shadow-2xl space-y-4">
                <h2 className="font-display text-base text-center text-slate-100">
                  Enter 6-Letter Room Code
                </h2>

                <div>
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="e.g. QK5ZPG"
                    maxLength={6}
                    className="w-full bg-[#0c101b] border border-white/15 rounded-2xl px-4 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-[#c084fc] text-center tracking-[0.3em] text-2xl font-mono font-black uppercase transition-all shadow-inner"
                  />
                </div>

                {error && (
                  <div className="text-xs text-rose-400 text-center bg-rose-500/10 border border-rose-500/20 rounded-2xl py-2 px-3 font-semibold">
                    ⚠️ {error}
                  </div>
                )}

                <button
                  className="w-full py-4.5 px-6 rounded-full font-black text-base tracking-wider text-white bg-gradient-to-r from-[#0ea5e9] to-[#f43f5e] shadow-xl shadow-purple-500/30 hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
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
      </footer>

      {/* ── Settings & QR Code Modal ── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="glass-strong rounded-3xl p-6 max-w-sm w-full border border-purple-500/30 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex gap-2">
                  <button
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      settingsTab === 'profile'
                        ? 'bg-gradient-to-r from-[#0ea5e9] to-[#c084fc] text-white shadow-md'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                    onClick={() => {
                      soundEngine.playCardFlip();
                      setSettingsTab('profile');
                    }}
                  >
                    👤 Profile
                  </button>
                  <button
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      settingsTab === 'qr'
                        ? 'bg-gradient-to-r from-[#c084fc] to-[#f472b6] text-white shadow-md'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                    onClick={() => {
                      soundEngine.playCardFlip();
                      setSettingsTab('qr');
                    }}
                  >
                    📱 Share QR Code
                  </button>
                </div>

                <button
                  className="text-slate-400 hover:text-white text-lg p-1 cursor-pointer"
                  onClick={() => setShowSettings(false)}
                >
                  ✕
                </button>
              </div>

              {/* Tab 1: Profile Settings */}
              {settingsTab === 'profile' && (
                <div className="space-y-4">
                  {/* Avatar Picker */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block text-center">
                      Choose Avatar
                    </label>
                    <div className="flex justify-center mb-3">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center p-1 shadow-lg shadow-pink-500/20">
                        <Avatar avatarId={avatarId} size={58} />
                      </div>
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
                      className="w-full bg-[#0c101b] border border-white/15 rounded-2xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#c084fc] font-bold text-sm transition-all"
                    />
                  </div>

                  <button
                    className="w-full py-3.5 px-6 rounded-full font-black text-sm tracking-wider text-white bg-gradient-to-r from-[#0ea5e9] via-[#a855f7] to-[#f43f5e] shadow-lg shadow-purple-500/30 hover:brightness-110 transition-all cursor-pointer"
                    onClick={() => handleSaveSettings(name, avatarId)}
                  >
                    💾 SAVE PROFILE
                  </button>
                </div>
              )}

              {/* Tab 2: Website QR Code Share */}
              {settingsTab === 'qr' && (
                <div>
                  <QRCodeShare />
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

