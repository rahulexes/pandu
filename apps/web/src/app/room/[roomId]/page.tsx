// ============================================================
// PANDU — Fullscreen Landscape Laptop & Mobile Responsive Lobby
// ============================================================

'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  useSocket,
  emitJoinRoom,
  emitGameAction,
} from '@/hooks/useSocket';
import { useRoomStore } from '@/stores/roomStore';
import { useGameStore } from '@/stores/gameStore';
import { Avatar } from '@/components/lobby/AvatarPicker';
import { GameMode, GamePhase } from '@pandu/shared';
import { soundEngine } from '@/lib/audio';
import { ThreeHeroCards } from '@/components/home/ThreeHeroCards';
import { LobbyQRModal } from '@/components/lobby/LobbyQRModal';

const TEAM_THEMES = [
  { id: 'team-1', name: 'Team Alpha', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-400' },
  { id: 'team-2', name: 'Team Omega', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-400' },
  { id: 'team-3', name: 'Team Crimson', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-400' },
  { id: 'team-4', name: 'Team Cobalt', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-400' },
];

export default function LobbyPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const router = useRouter();
  const socket = useSocket();

  const room = useRoomStore((s) => s.room);
  const myPlayerId = useRoomStore((s) => s.myPlayerId);
  const updateSettingsLocal = useRoomStore((s) => s.updateSettings);
  const phase = useGameStore((s) => s.phase);

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
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
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyRoomCode = () => {
    soundEngine.playCardFlip();
    navigator.clipboard.writeText(roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Resilient Host Check
  const effectiveIsHost = Boolean(
    (room?.hostId && myPlayerId && room.hostId === myPlayerId) ||
    (room?.players && room.players.length > 0 && room.players[0].id === myPlayerId)
  );

  const me = room?.players.find((p) => p.id === myPlayerId);
  const isMyReady = me?.isReady ?? false;
  const otherPlayers = room?.players.filter((p) => p.id !== myPlayerId) ?? [];
  const readyCount = otherPlayers.filter((p) => p.isReady).length;
  const allReady = otherPlayers.length > 0 && otherPlayers.every((p) => p.isReady);

  const currentMode = room?.settings.mode ?? GameMode.INDIVIDUAL;
  const activeTeams = room?.teams?.filter((t) => t.playerIds.length > 0) ?? [];
  const canStart =
    effectiveIsHost &&
    (room?.players.length ?? 0) >= 2 &&
    allReady &&
    (currentMode !== GameMode.TEAM || activeTeams.length >= 2);

  // Host Action: Update Game Mode
  const handleSetMode = (mode: GameMode) => {
    soundEngine.playCardFlip();
    updateSettingsLocal({ mode });
    emitGameAction('lobby:updateSettings', { settings: { mode } });
  };
  // Host Action: Update Cards Dealt (+ / -)
  const handleUpdateCardsDealt = (delta: number) => {
    soundEngine.playCardFlip();
    const current = room?.settings.cardsDealt ?? 4;
    const nextCards = Math.max(2, Math.min(10, current + delta));
    const maxPeekable = Math.floor(nextCards / 2);
    const currentPeekable = room?.settings.initialViewable ?? 2;
    const nextPeekable = Math.min(currentPeekable, maxPeekable);
    updateSettingsLocal({ cardsDealt: nextCards, initialViewable: nextPeekable });
    emitGameAction('lobby:updateSettings', { settings: { cardsDealt: nextCards, initialViewable: nextPeekable } });
  };

  // Host Action: Update Peekable Cards (+ / -)
  const handleUpdatePeekable = (delta: number) => {
    soundEngine.playCardFlip();
    const currentCards = room?.settings.cardsDealt ?? 4;
    const maxPeekable = Math.floor(currentCards / 2);
    const currentPeekable = room?.settings.initialViewable ?? 2;
    const nextPeekable = Math.max(0, Math.min(maxPeekable, currentPeekable + delta));
    updateSettingsLocal({ initialViewable: nextPeekable });
    emitGameAction('lobby:updateSettings', { settings: { initialViewable: nextPeekable } });
  };

  // Host Action: Update Queens Count (+ / -)
  const handleUpdateQueens = (delta: number) => {
    soundEngine.playCardFlip();
    const currentQueens = room?.settings.queenCount ?? 4;
    const nextQueens = Math.max(0, Math.min(8, currentQueens + delta));
    updateSettingsLocal({ queenCount: nextQueens });
    emitGameAction('lobby:updateSettings', { settings: { queenCount: nextQueens } });
  };

  // Player Action: Join Team
  const handleJoinTeam = (teamId: string) => {
    soundEngine.playCardFlip();
    emitGameAction('lobby:joinTeam', { teamId });
  };

  // Host Action: Kick Player
  const handleKick = (targetPlayerId: string, targetName: string) => {
    soundEngine.playCardFlip();
    if (window.confirm(`Kick ${targetName} from the room?\nThey will be on a 1-minute cooldown.`)) {
      emitGameAction('lobby:kickPlayer', { targetPlayerId });
    }
  };

  // Helper to find player's team
  const getPlayerTeam = (playerId: string) => {
    if (currentMode !== GameMode.TEAM || !room?.teams) return null;
    const team = room.teams.find((t) => t.playerIds.includes(playerId));
    if (!team) return null;
    return TEAM_THEMES.find((th) => th.id === team.id);
  };

  return (
    <div className="min-h-dvh flex flex-col justify-between p-4 sm:p-6 md:p-8 lg:p-10 relative overflow-hidden bg-[#0c0e17] text-slate-100 select-none">
      {/* Three.js Fullscreen 3D Floating Cards in Lobby Background */}
      <ThreeHeroCards />

      {/* Ambient background glows */}
      <div className="absolute inset-0 bg-radial from-[#151726]/60 via-[#0c0e17]/85 to-[#07080f] opacity-95 pointer-events-none z-0" />
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[550px] h-[400px] rounded-full bg-[#a855f7]/12 blur-[150px] pointer-events-none z-0" />

      {/* ── Main Container (Mobile: max-w-md, Laptop: max-w-6xl Full Landscape Grid) ── */}
      <div className="relative z-10 flex flex-col flex-1 max-w-md md:max-w-6xl mx-auto w-full pb-36 md:pb-32 pointer-events-auto">
        
        {/* ── Top Header Bar ── */}
        <header className="flex items-center justify-between mb-3 pt-1 w-full">
          <button
            className="text-sm text-slate-200 hover:text-white font-bold flex items-center gap-1.5 cursor-pointer transition-all bg-[#141724]/90 hover:bg-[#1f2438] px-4 py-2 rounded-full border border-white/10 shadow-md"
            onClick={() => {
              soundEngine.playCardFlip();
              emitGameAction('room:leave');
              router.push('/');
            }}
          >
            <span className="text-base">❮</span> Leave
          </button>

          <h1 className="font-display text-2xl md:text-4xl tracking-wider font-black bg-gradient-to-r from-[#fbbf24] via-[#f3e8ff] to-[#c084fc] bg-clip-text text-transparent drop-shadow-[0_2px_15px_rgba(192,132,252,0.4)]">
            PANDU
          </h1>

          <button
            className="p-2.5 rounded-full bg-[#141724]/90 hover:bg-[#1f2438] border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer text-lg shadow-md"
            onClick={() => {
              soundEngine.playCardFlip();
              setShowSettings(true);
            }}
          >
            ⚙️
          </button>
        </header>

        {/* ── Room Code Hero Banner (Centered Across Screen) ── */}
        <div className="text-center my-3 md:my-4 p-3 md:p-4 rounded-3xl bg-[#101322]/85 border border-purple-500/20 backdrop-blur-2xl shadow-xl">
          <p className="text-[11px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
            Room Code
          </p>

          {/* Interactive Click-to-Copy Room Code Badge */}
          <motion.button
            className="group inline-flex items-center gap-3 px-6 py-1.5 md:py-2 rounded-3xl bg-[#141724]/90 hover:bg-[#1f2438] border-2 border-purple-500/30 hover:border-purple-400/60 shadow-xl shadow-purple-500/20 transition-all cursor-pointer"
            onClick={copyRoomCode}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            title="Click to copy Room Code"
          >
            <span className="text-4xl sm:text-5xl md:text-6xl font-mono font-black tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-[#d8b4fe] via-[#f3e8ff] to-[#c084fc] drop-shadow-[0_0_25px_rgba(192,132,252,0.65)]">
              {roomId}
            </span>
            <span className="text-xl text-purple-300 group-hover:text-amber-300 transition-colors">
              📋
            </span>
          </motion.button>

          {/* Action Row: Copy Code + Copy Link + Share QR */}
          <div className="flex items-center justify-center gap-2.5 mt-3 flex-wrap">
            <button
              className={`px-4 py-2 rounded-full font-bold text-xs tracking-wider uppercase transition-all duration-200 flex items-center gap-1.5 cursor-pointer shadow-lg border ${
                copiedCode
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black'
                  : 'bg-[#181c2b]/90 hover:bg-[#20263a] text-amber-300 border-amber-400/30 hover:border-amber-400/60'
              }`}
              onClick={copyRoomCode}
            >
              <span>{copiedCode ? '✓' : '📋'}</span>
              <span>{copiedCode ? 'Code Copied!' : 'Copy Code'}</span>
            </button>

            <button
              className={`px-4 py-2 rounded-full font-bold text-xs tracking-wider uppercase transition-all duration-200 flex items-center gap-1.5 cursor-pointer shadow-lg border ${
                copiedLink
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black'
                  : 'bg-[#181c2b]/90 hover:bg-[#20263a] text-slate-200 border-white/10 hover:border-purple-400/40'
              }`}
              onClick={copyInviteLink}
            >
              <span>{copiedLink ? '✓' : '🔗'}</span>
              <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
            </button>

            <button
              className="p-2 px-4 rounded-full font-bold text-xs tracking-wider uppercase transition-all duration-200 flex items-center gap-1.5 cursor-pointer shadow-lg bg-[#181c2b]/90 hover:bg-[#20263a] text-slate-200 border border-white/10 hover:border-purple-400/40"
              onClick={() => {
                soundEngine.playCardFlip();
                setShowQR(true);
              }}
              title="Share Room QR Code"
            >
              <span className="text-sm">📱</span>
              <span className="text-[11px] text-slate-300">QR</span>
            </button>
          </div>
        </div>

        {/* ── Main Landscape 2-Column Grid (Laptop) / Single Column (Mobile) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8 flex-1 mt-2">
          
          {/* ── LEFT COLUMN (Host Game Rules & Mode Customization) ── */}
          <div className="flex flex-col space-y-4">
            {effectiveIsHost ? (
              <div className="space-y-4 p-5 md:p-6 rounded-3xl bg-[#101322]/85 border border-purple-500/25 backdrop-blur-2xl shadow-xl h-full">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <h2 className="text-base font-black text-slate-100 tracking-wide flex items-center gap-2">
                    <span>⚙️</span> Rule Customization
                  </h2>
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">
                    👑 Host Controls
                  </span>
                </div>

                {/* Game Mode Section */}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                    Game Mode
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      className={`p-3.5 rounded-2xl text-center transition-all relative overflow-hidden cursor-pointer ${
                        currentMode === GameMode.INDIVIDUAL
                          ? 'border-2 border-[#eab308] bg-[#221c17]/95 text-[#fbbf24] shadow-[0_0_25px_rgba(234,179,8,0.3)]'
                          : 'border border-white/10 bg-[#141724]/85 text-slate-400 hover:text-slate-200 hover:bg-[#181c2b]'
                      }`}
                      onClick={() => handleSetMode(GameMode.INDIVIDUAL)}
                    >
                      <span className="font-black text-sm tracking-wide block">
                        Individual
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        Free-for-all
                      </span>
                    </button>

                    <button
                      className={`p-3.5 rounded-2xl text-center transition-all relative overflow-hidden cursor-pointer ${
                        currentMode === GameMode.TEAM
                          ? 'border-2 border-[#a855f7] bg-[#1c162b]/95 text-[#c084fc] shadow-[0_0_25px_rgba(168,85,247,0.3)]'
                          : 'border border-white/10 bg-[#141724]/85 text-slate-400 hover:text-slate-200 hover:bg-[#181c2b]'
                      }`}
                      onClick={() => handleSetMode(GameMode.TEAM)}
                    >
                      <span className="font-black text-sm tracking-wide block">
                        Team Mode
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        Co-op Teams
                      </span>
                    </button>
                  </div>
                </div>

                {/* Number of Cards Dealt (Y) & Initial Peekable (X) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Cards Dealt */}
                  <div className="bg-[#141724]/80 p-3 rounded-2xl border border-white/10 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-300">Cards Dealt (Y)</label>
                      <span className="text-xs text-amber-300 font-bold font-mono">
                        {room?.settings.cardsDealt ?? 4}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-[#0c0e17] p-1.5 rounded-xl border border-white/10">
                      <button
                        className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white font-black text-lg flex items-center justify-center cursor-pointer transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={() => handleUpdateCardsDealt(-1)}
                        disabled={(room?.settings.cardsDealt ?? 4) <= 2}
                      >
                        -
                      </button>
                      <span className="font-mono font-black text-sm text-amber-300">
                        {room?.settings.cardsDealt ?? 4} Cards
                      </span>
                      <button
                        className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white font-black text-lg flex items-center justify-center cursor-pointer transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={() => handleUpdateCardsDealt(1)}
                        disabled={(room?.settings.cardsDealt ?? 4) >= 10}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Initial Peekable */}
                  <div className="bg-[#141724]/80 p-3 rounded-2xl border border-white/10 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-300">Peekable Cards (X)</label>
                      <span className="text-xs text-purple-300 font-bold font-mono">
                        {room?.settings.initialViewable ?? 2}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-[#0c0e17] p-1.5 rounded-xl border border-white/10">
                      <button
                        className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white font-black text-lg flex items-center justify-center cursor-pointer transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={() => handleUpdatePeekable(-1)}
                        disabled={(room?.settings.initialViewable ?? 2) <= 0}
                      >
                        -
                      </button>
                      <span className="font-mono font-black text-sm text-purple-300">
                        {room?.settings.initialViewable ?? 2} Peekable
                      </span>
                      <button
                        className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white font-black text-lg flex items-center justify-center cursor-pointer transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={() => handleUpdatePeekable(1)}
                        disabled={(room?.settings.initialViewable ?? 2) >= Math.floor((room?.settings.cardsDealt ?? 4) / 2)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Queens Count */}
                <div className="bg-[#141724]/80 p-3 rounded-2xl border border-white/10">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-300">Queen Cards (Swap Power)</label>
                    <span className="text-xs text-purple-300 font-bold font-mono">
                      {room?.settings.queenCount ?? 4} Queens in deck
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 bg-[#0c0e17] p-1.5 rounded-xl border border-white/10">
                    <button
                      className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white font-black text-lg flex items-center justify-center cursor-pointer transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                      onClick={() => handleUpdateQueens(-1)}
                      disabled={(room?.settings.queenCount ?? 4) <= 0}
                    >
                      -
                    </button>
                    <span className="font-mono font-black text-sm text-purple-300">
                      {(room?.settings.queenCount ?? 4) === 0 ? 'No Queens' : `${room?.settings.queenCount ?? 4} Queens`}
                    </span>
                    <button
                      className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white font-black text-lg flex items-center justify-center cursor-pointer transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                      onClick={() => handleUpdateQueens(1)}
                      disabled={(room?.settings.queenCount ?? 4) >= 8}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Non-Host View: Rules Overview */
              <div className="p-5 md:p-6 rounded-3xl bg-[#101322]/85 border border-white/10 backdrop-blur-2xl space-y-3 shadow-xl h-full">
                <h2 className="text-base font-black text-slate-100 tracking-wide border-b border-white/10 pb-2.5 flex items-center gap-2">
                  <span>📜</span> Match Rules
                </h2>
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mode</span>
                  <span className="text-sm font-black text-amber-300 uppercase">{currentMode}</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cards Hand</span>
                  <span className="text-sm font-bold text-slate-200">{room?.settings.cardsDealt ?? 4} cards</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Queen Powers</span>
                  <span className="text-sm font-bold text-slate-200">{room?.settings.queenCount ?? 4} Queens</span>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN (Players Roster & Team Selection) ── */}
          <div className="flex flex-col space-y-4">
            
            {/* Team Picker (Only in Team Mode) */}
            {currentMode === GameMode.TEAM && (
              <div className="p-5 rounded-3xl bg-[#101322]/85 border border-purple-500/25 backdrop-blur-2xl shadow-xl">
                <h2 className="text-sm font-black text-slate-100 mb-3 flex items-center gap-2">
                  <span>👥</span> Choose Your Team
                </h2>

                <div className="grid grid-cols-2 gap-2.5">
                  {TEAM_THEMES.map((theme) => {
                    const teamObj = room?.teams?.find((t) => t.id === theme.id);
                    const isMyTeam = Boolean(myPlayerId && teamObj?.playerIds.includes(myPlayerId));
                    const memberCount = teamObj?.playerIds.length ?? 0;

                    return (
                      <button
                        key={theme.id}
                        className={`p-3 rounded-2xl border-2 text-left transition-all relative overflow-hidden cursor-pointer ${
                          isMyTeam
                            ? `${theme.border} ${theme.bg} shadow-lg ring-1`
                            : 'border-white/10 bg-[#141724]/85 hover:border-white/20'
                        }`}
                        onClick={() => handleJoinTeam(theme.id)}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-black text-sm ${theme.color}`}>
                            {theme.name}
                          </span>
                          {isMyTeam && (
                            <span className="text-xs font-bold text-emerald-400">✓ YOU</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {memberCount} {memberCount === 1 ? 'player' : 'players'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Players Roster Panel */}
            <div className="p-5 md:p-6 rounded-3xl bg-[#101322]/85 border border-purple-500/25 backdrop-blur-2xl shadow-xl flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2.5">
                <h2 className="text-base font-black text-slate-100 tracking-wide flex items-center gap-2">
                  <span>🎮</span> Connected Players
                </h2>
                <span className="text-xs font-mono font-bold text-purple-300 bg-purple-500/15 px-3 py-1 rounded-full border border-purple-500/30">
                  {room?.players.length ?? 0} / 8
                </span>
              </div>

              <div className="space-y-2.5 max-h-[380px] md:max-h-[460px] overflow-y-auto pr-1 flex-1">
                <AnimatePresence initial={false}>
                  {room?.players.map((player) => {
                    const isMe = player.id === myPlayerId;
                    const isPlayerHost = player.id === room.hostId;
                    const teamTheme = getPlayerTeam(player.id);

                    return (
                      <motion.div
                        key={player.id}
                        className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                          isMe
                            ? 'bg-purple-950/40 border-purple-400/50 shadow-md shadow-purple-950/40'
                            : 'bg-[#141724]/90 border-white/10'
                        }`}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                      >
                        {/* Avatar & Name */}
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar avatarId={player.avatarId} size={44} />
                            {isPlayerHost && (
                              <span className="absolute -top-1.5 -right-1.5 text-xs">👑</span>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-black text-white">
                                {player.name}
                              </span>
                              {isMe && (
                                <span className="text-[10px] text-purple-300 font-bold bg-purple-500/20 px-1.5 py-0.5 rounded-full">
                                  YOU
                                </span>
                              )}
                            </div>

                            {/* Team Tag if in Team Mode */}
                            {teamTheme && (
                              <span className={`text-[10px] font-bold ${teamTheme.color} mt-0.5 block`}>
                                {teamTheme.name}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status / Kick Controls */}
                        <div className="flex items-center gap-2">
                          {isPlayerHost ? (
                            <span className="text-xs font-black text-amber-300 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/30">
                              👑 HOST
                            </span>
                          ) : player.isReady ? (
                            <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
                              ✓ READY
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-slate-400 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                              NOT READY
                            </span>
                          )}

                          {/* Host Kick Button */}
                          {effectiveIsHost && !isMe && (
                            <button
                              className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-all cursor-pointer flex items-center gap-1"
                              onClick={() => handleKick(player.id, player.name)}
                              title="Kick player (1-min cooldown)"
                            >
                              <span>🚫</span>
                              <span>Kick</span>
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Centered Action Button Bar (Shifted Upwards from Bottom Bezel) ── */}
      <footer className="fixed bottom-6 sm:bottom-8 left-0 right-0 px-4 z-30 pointer-events-auto">
        <div className="max-w-md md:max-w-xl mx-auto w-full bg-[#101322]/95 backdrop-blur-2xl p-3 rounded-3xl border-2 border-purple-500/30 shadow-[0_10px_40px_rgba(0,0,0,0.8)]">
          {effectiveIsHost ? (
            <div>
              {/* Host Status Guidance */}
              {otherPlayers.length > 0 && !allReady && (
                <p className="text-center text-xs text-amber-300 mb-2 font-medium">
                  ⏳ Waiting for other players to ready up ({readyCount}/{otherPlayers.length} ready)
                </p>
              )}
              {otherPlayers.length === 0 && (
                <p className="text-center text-xs text-slate-400 mb-2 font-medium">
                  🔗 Share room code with friends to start (min 2 players)
                </p>
              )}
              {currentMode === GameMode.TEAM && activeTeams.length < 2 && (
                <p className="text-center text-xs text-rose-300 mb-2 font-medium">
                  👥 Need at least 2 teams with players to start
                </p>
              )}

              <button
                className={`w-full py-4 rounded-2xl font-black text-sm sm:text-base tracking-wider uppercase transition-all duration-200 cursor-pointer shadow-2xl border-2 ${
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
                {canStart
                  ? '🎴 START GAME'
                  : (room?.players.length ?? 0) < 2
                  ? 'WAITING FOR PLAYERS (MIN 2)'
                  : currentMode === GameMode.TEAM && activeTeams.length < 2
                  ? 'NEED 2+ TEAMS WITH PLAYERS'
                  : 'WAITING FOR READY'}
              </button>
            </div>
          ) : (
            <button
              className={`w-full py-4 rounded-2xl font-black text-sm sm:text-base tracking-wider uppercase transition-all duration-200 cursor-pointer shadow-2xl border-2 ${
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

      {/* ── Lobby Settings Modal ── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="glass-strong rounded-3xl p-6 max-w-sm w-full border-2 border-purple-500/30 shadow-2xl space-y-5 bg-[#131722]/98"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
                  <span>⚙️</span> Room Settings
                </h3>
                <button
                  className="text-slate-400 hover:text-white text-lg p-1 cursor-pointer"
                  onClick={() => setShowSettings(false)}
                >
                  ✕
                </button>
              </div>

              {/* Sound Setting Toggle */}
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    <span>🔊</span> Game Audio
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Card sounds & special effects
                  </p>
                </div>
                <button
                  className={`px-4 py-2 rounded-xl text-xs font-black tracking-wider transition-all cursor-pointer ${
                    soundEngine.getMuted()
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                  }`}
                  onClick={() => {
                    soundEngine.toggleMute();
                    setShowSettings((s) => !s);
                    setTimeout(() => setShowSettings(true), 10);
                  }}
                >
                  {soundEngine.getMuted() ? 'MUTED' : 'ENABLED'}
                </button>
              </div>

              {/* QR Button in Settings */}
              <button
                className="w-full py-3 rounded-2xl font-bold text-xs tracking-wider uppercase bg-[#181c2b] hover:bg-[#20263a] text-slate-200 border border-white/10 flex items-center justify-center gap-2 cursor-pointer transition-all"
                onClick={() => {
                  setShowSettings(false);
                  setShowQR(true);
                }}
              >
                <span>📱</span> Show Room QR Code
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
