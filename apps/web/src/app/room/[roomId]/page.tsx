// ============================================================
// PANDU — Enhanced VIP Game Lobby Page
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

const TEAM_THEMES = [
  { id: 'team_A', name: 'Team Ruby', bg: 'from-rose-500/20 to-rose-950/40', border: 'border-rose-500/40', text: 'text-rose-400', badge: 'bg-rose-500/30' },
  { id: 'team_B', name: 'Team Sapphire', bg: 'from-sky-500/20 to-sky-950/40', border: 'border-sky-500/40', text: 'text-sky-400', badge: 'bg-sky-500/30' },
  { id: 'team_C', name: 'Team Emerald', bg: 'from-emerald-500/20 to-emerald-950/40', border: 'border-emerald-500/40', text: 'text-emerald-400', badge: 'bg-emerald-500/30' },
  { id: 'team_D', name: 'Team Amber', bg: 'from-amber-500/20 to-amber-950/40', border: 'border-amber-500/40', text: 'text-amber-400', badge: 'bg-amber-500/30' },
];

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
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    setIsMuted(soundEngine.getMuted());
  }, []);

  const handleToggleMute = () => {
    const muted = soundEngine.toggleMute();
    setIsMuted(muted);
  };

  // Redirect to game table when match starts
  useEffect(() => {
    if (phase !== GamePhase.LOBBY && phase !== GamePhase.GAME_OVER) {
      router.push(`/room/${roomId}/game`);
    }
  }, [phase, roomId, router]);

  // Auto-join if directly navigated via URL link (e.g. pasted invite link)
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

  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden bg-[#030712] text-slate-100">
      {/* Dynamic ambient background glows */}
      <div className="absolute inset-0 bg-radial from-[#0c1824]/60 via-[#030712] to-[#010308] opacity-95 pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-[450px] h-[450px] rounded-full bg-amber-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-[450px] h-[450px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 flex flex-col flex-1 max-w-xl mx-auto w-full p-4 sm:p-6 pb-28">
        {/* Top Navbar */}
        <header className="flex items-center justify-between mb-5">
          <button
            className="text-xs sm:text-sm text-slate-300 hover:text-white px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 shadow-md transition-all flex items-center gap-1.5 cursor-pointer font-bold"
            onClick={() => {
              soundEngine.playCardFlip();
              emitGameAction('room:leave');
              router.push('/');
            }}
          >
            <span>←</span> Leave
          </button>
          
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl tracking-wider bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(245,158,11,0.4)]">
              PANDU
            </h1>
            <span className="text-[10px] uppercase font-black tracking-widest px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-inner">
              LOBBY
            </span>
          </div>

          <button
            className="text-sm p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white border border-white/10 shadow-md transition-all cursor-pointer"
            onClick={handleToggleMute}
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
        </header>

        {/* VIP Room Code Share Card */}
        <motion.div
          className="glass rounded-3xl p-4 sm:p-5 mb-5 relative overflow-hidden border border-amber-500/30 shadow-2xl shadow-black/80"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">
                VIP Private Room Code
              </span>
              <span className="text-3xl sm:text-4xl font-mono font-black tracking-[0.28em] text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                {roomId}
              </span>
            </div>

            <button
              className={`px-4 py-2.5 rounded-2xl font-black text-xs tracking-wider uppercase transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                copied
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/40'
                  : 'bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 text-amber-300 border border-amber-500/40 shadow-lg'
              }`}
              onClick={copyInviteLink}
            >
              {copied ? '✓ Copied!' : '📋 Copy Link'}
            </button>
          </div>
        </motion.div>

        {/* ── Host Control Center ── */}
        {isHost && (
          <motion.div
            className="space-y-4 mb-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {/* Mode Switcher */}
            <div className="glass rounded-2xl p-4 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Game Mode
                </span>
                <span className="text-[11px] text-amber-400 font-semibold">
                  Host Controls
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  className={`p-3.5 rounded-xl text-left transition-all relative overflow-hidden border ${
                    room?.settings.mode === GameMode.INDIVIDUAL
                      ? 'border-amber-400 bg-amber-500/15 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                      : 'border-white/5 bg-white/3 hover:bg-white/5'
                  }`}
                  onClick={() => {
                    soundEngine.playCardFlip();
                    emitGameAction('lobby:setMode', { mode: 'INDIVIDUAL' });
                  }}
                >
                  <div className="text-xl mb-1">👤</div>
                  <div className="font-bold text-sm text-slate-100">Individual</div>
                  <div className="text-[11px] text-slate-400">Solo free-for-all</div>
                </button>

                <button
                  className={`p-3.5 rounded-xl text-left transition-all relative overflow-hidden border ${
                    room?.settings.mode === GameMode.TEAM
                      ? 'border-amber-400 bg-amber-500/15 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                      : 'border-white/5 bg-white/3 hover:bg-white/5'
                  }`}
                  onClick={() => {
                    soundEngine.playCardFlip();
                    emitGameAction('lobby:setMode', { mode: 'TEAM' });
                  }}
                >
                  <div className="text-xl mb-1">👥</div>
                  <div className="font-bold text-sm text-slate-100">Team Mode</div>
                  <div className="text-[11px] text-slate-400">Shared hand & turns</div>
                </button>
              </div>
            </div>

            {/* Custom Rules Steppers */}
            <div className="glass rounded-2xl p-4 border border-white/10 space-y-4">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Rule Customization
              </span>

              {/* Cards Dealt (Y) */}
              <div className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5">
                <div>
                  <p className="font-semibold text-sm text-slate-200">Cards Dealt (Y)</p>
                  <p className="text-[11px] text-slate-400">Hand size per {room?.settings.mode === GameMode.TEAM ? 'team' : 'player'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-lg font-bold transition-all text-amber-300"
                    onClick={() => {
                      soundEngine.playCardFlip();
                      emitGameAction('lobby:updateSettings', { cardsDealt: Math.max(2, (room?.settings.cardsDealt || 4) - 1) });
                    }}
                  >
                    −
                  </button>
                  <span className="text-xl font-bold font-mono w-6 text-center text-amber-400">
                    {room?.settings.cardsDealt || 4}
                  </span>
                  <button
                    className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-lg font-bold transition-all text-amber-300"
                    onClick={() => {
                      soundEngine.playCardFlip();
                      emitGameAction('lobby:updateSettings', { cardsDealt: Math.min(10, (room?.settings.cardsDealt || 4) + 1) });
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Initial Viewable (X) */}
              <div className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5">
                <div>
                  <p className="font-semibold text-sm text-slate-200">Initial Viewable (X)</p>
                  <p className="text-[11px] text-slate-400">Cards peeked at start (max {maxInitialViewable})</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-lg font-bold transition-all text-amber-300"
                    onClick={() => {
                      soundEngine.playCardFlip();
                      emitGameAction('lobby:updateSettings', { initialViewable: Math.max(1, (room?.settings.initialViewable || 2) - 1) });
                    }}
                  >
                    −
                  </button>
                  <span className="text-xl font-bold font-mono w-6 text-center text-amber-400">
                    {room?.settings.initialViewable || 2}
                  </span>
                  <button
                    className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-lg font-bold transition-all text-amber-300"
                    onClick={() => {
                      soundEngine.playCardFlip();
                      emitGameAction('lobby:updateSettings', { initialViewable: Math.min(maxInitialViewable, (room?.settings.initialViewable || 2) + 1) });
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Team Mode Queen Count */}
              {room?.settings.mode === GameMode.TEAM && (
                <div className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5">
                  <div>
                    <p className="font-semibold text-sm text-slate-200">Queen Count</p>
                    <p className="text-[11px] text-slate-400">Determines PANDU endgame turn multiplier</p>
                  </div>
                  <div className="flex gap-1.5">
                    {[2, 3, 4].map(q => (
                      <button
                        key={q}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                          (room?.settings.queenCount || 4) === q
                            ? 'bg-amber-400 text-slate-950 shadow-md'
                            : 'bg-white/10 text-slate-300 hover:bg-white/20'
                        }`}
                        onClick={() => {
                          soundEngine.playCardFlip();
                          emitGameAction('lobby:updateSettings', { queenCount: q });
                        }}
                      >
                        {q}Q
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Team Mode Roster ── */}
        {room?.settings.mode === GameMode.TEAM && (
          <motion.div
            className="glass rounded-2xl p-4 mb-5 border border-white/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-3">
              Team Selection
            </span>

            <div className="grid grid-cols-2 gap-3">
              {TEAM_THEMES.map((theme, idx) => {
                const teamData = room?.teams.find(t => t.id === theme.id);
                const memberCount = teamData?.playerIds.length || 0;
                const isMyTeam = teamData?.playerIds.includes(myPlayerId || '') || false;

                return (
                  <button
                    key={theme.id}
                    className={`p-3 rounded-xl text-left bg-gradient-to-br ${theme.bg} border ${theme.border} transition-all relative ${
                      isMyTeam ? 'ring-2 ring-amber-400 shadow-lg' : 'hover:scale-[1.02]'
                    }`}
                    onClick={() => {
                      soundEngine.playCardFlip();
                      emitGameAction('lobby:joinTeam', { teamId: theme.id });
                    }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-black uppercase tracking-wider ${theme.text}`}>
                        {theme.name}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${theme.badge}`}>
                        {memberCount}/4
                      </span>
                    </div>

                    <div className="flex items-center gap-1 min-h-[28px]">
                      {teamData?.playerIds.map(pid => {
                        const p = room?.players.find(x => x.id === pid);
                        return p ? (
                          <Avatar key={pid} avatarId={p.avatarId} size={24} />
                        ) : null;
                      })}
                      {memberCount === 0 && (
                        <span className="text-[11px] text-slate-500 italic">Empty</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── Player List Roster ── */}
        <motion.div
          className="glass rounded-2xl p-4 sm:p-5 mb-6 border border-white/10 flex-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-3.5">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Connected Players ({room?.players.length || 0})
            </span>
            <span className="text-xs text-slate-400">
              Min 2 players to start
            </span>
          </div>

          <div className="space-y-2.5">
            <AnimatePresence>
              {room?.players.map((player, i) => (
                <motion.div
                  key={player.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Avatar avatarId={player.avatarId} size={42} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm truncate text-slate-100">
                        {player.name}
                      </span>
                      {player.isHost && (
                        <span className="text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full">
                          👑 Host
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {player.isConnected ? '🟢 Online' : '🔴 Disconnected'}
                    </span>
                  </div>

                  <div className={`text-xs px-3 py-1.5 rounded-full font-bold tracking-wide transition-all ${
                    player.isHost
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : player.isReady
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                      : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                  }`}>
                    {player.isHost ? 'Host' : player.isReady ? '✓ Ready' : '⏳ Waiting'}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* ── Fixed Bottom Interactive Action Bar ── */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#070b14] via-[#070b14]/95 to-transparent z-30">
        <div className="max-w-xl mx-auto w-full">
          {isHost ? (
            <div>
              {otherPlayers.length > 0 && !allReady && (
                <p className="text-center text-xs text-amber-300 mb-2 font-medium">
                  ⏳ Waiting for other players to ready up ({readyCount}/{otherPlayers.length} ready)
                </p>
              )}
              {otherPlayers.length === 0 && (
                <p className="text-center text-xs text-slate-400 mb-2">
                  🔗 Share room code with friends to start
                </p>
              )}
              <button
                className="btn-primary w-full text-lg font-black tracking-wider py-4 cursor-pointer"
                onClick={() => {
                  soundEngine.playCardFlip();
                  emitGameAction('lobby:startGame');
                }}
                disabled={!canStart}
              >
                {canStart ? '🎴 START GAME' : (room?.players.length ?? 0) < 2 ? 'WAITING FOR PLAYERS (MIN 2)' : 'WAITING FOR READY'}
              </button>
            </div>
          ) : (
            <button
              className={`w-full py-4 rounded-2xl font-black text-lg tracking-wider transition-all duration-200 cursor-pointer ${
                isMyReady
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400'
                  : 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 hover:brightness-110'
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
    </div>
  );
}
