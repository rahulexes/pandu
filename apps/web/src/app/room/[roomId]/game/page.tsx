// ============================================================
// PANDU — Game Table Page (VIP Interactive Card Flow)
// ============================================================

'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useSocket, emitGameAction } from '@/hooks/useSocket';
import { useRoomStore } from '@/stores/roomStore';
import { useGameStore } from '@/stores/gameStore';
import { Card, DeckStack } from '@/components/cards/Card';
import { Avatar } from '@/components/lobby/AvatarPicker';
import { GamePhase, SpecialPowerType, SpecialActionPhase, GameMode } from '@pandu/shared';
import type { ClientCard } from '@pandu/shared';
import { soundEngine } from '@/lib/audio';

export default function GamePage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const router = useRouter();
  const socket = useSocket();
  const gameState = useGameStore((s) => s.gameState);
  const phase = useGameStore((s) => s.phase);
  const drawnCard = useGameStore((s) => s.drawnCard);
  const specialAction = useGameStore((s) => s.specialAction);
  const xReaction = useGameStore((s) => s.xReaction);
  const panduState = useGameStore((s) => s.panduState);
  const timer = useGameStore((s) => s.timer);
  const scores = useGameStore((s) => s.scores);
  const error = useGameStore((s) => s.error);
  const revealedCard = useGameStore((s) => s.revealedCard);
  const isShuffling = useGameStore((s) => s.isShuffling);
  const penaltyPrompt = useGameStore((s) => s.penaltyPrompt);
  const xReactionWrong = useGameStore((s) => s.xReactionWrong);
  const myPlayerId = useRoomStore((s) => s.myPlayerId);

  const [isMuted, setIsMuted] = useState(false);
  const [selectedOwnExchangeCardId, setSelectedOwnExchangeCardId] = useState<string | null>(null);
  const [selectedSwapHandCardId, setSelectedSwapHandCardId] = useState<string | null>(null);
  const [swapDiscardPreview, setSwapDiscardPreview] = useState<ClientCard | null>(null);

  useEffect(() => {
    setIsMuted(soundEngine.getMuted());
  }, []);

  const handleToggleMute = () => {
    const muted = soundEngine.toggleMute();
    setIsMuted(muted);
  };

  const isMyTurn = gameState?.isMyTurn ?? false;
  const isInitialView = phase === GamePhase.INITIAL_VIEW;
  const showDrawButton = isMyTurn && (phase === GamePhase.PLAYER_TURN || phase === GamePhase.DRAWING) && !drawnCard;
  const showCardDecision = isMyTurn && drawnCard !== null;
  const showEndTurn = isMyTurn && (phase === GamePhase.END_TURN || (specialAction?.phase === SpecialActionPhase.COMPLETE));
  const showPanduButton = showEndTurn && !panduState;
  const showXReaction = xReaction?.isActive ?? false;

  // Special power active states
  const isSpecialActive = phase === GamePhase.SPECIAL_ACTION || specialAction !== null;
  const isSelfPeekActive = specialAction?.type === SpecialPowerType.SELF_PEEK && specialAction?.phase === SpecialActionPhase.SELECT_CARD;
  const isOtherPeekActive = specialAction?.type === SpecialPowerType.OTHER_PEEK && specialAction?.phase === SpecialActionPhase.SELECT_CARD;
  const isExchangeActive = specialAction?.type === SpecialPowerType.BLIND_EXCHANGE;

  // Timer countdown
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!timer) {
      setTimeRemaining(null);
      return;
    }
    const interval = setInterval(() => {
      const remaining = Math.max(0, timer.endsAt - Date.now());
      setTimeRemaining(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 200);
    return () => clearInterval(interval);
  }, [timer]);

  // Actions
  const handleDrawCard = useCallback(() => {
    soundEngine.playCardDraw();
    setSelectedSwapHandCardId(null);
    emitGameAction('game:drawCard');
  }, []);

  const handleDiscardDrawn = useCallback(() => {
    soundEngine.playCardFlip();
    setSelectedSwapHandCardId(null);
    emitGameAction('game:discardDrawn');
  }, []);

  const handleConfirmSwap = useCallback(() => {
    if (!selectedSwapHandCardId) return;
    soundEngine.playCardFlip();
    const discardedHandCard = gameState?.myHand.find(c => c.id === selectedSwapHandCardId);
    if (discardedHandCard) {
      setSwapDiscardPreview(discardedHandCard);
      setTimeout(() => {
        setSwapDiscardPreview(null);
      }, 3000);
    }
    emitGameAction('game:replaceCard', { handCardId: selectedSwapHandCardId });
    setSelectedSwapHandCardId(null);
  }, [selectedSwapHandCardId, gameState]);

  const handleChoosePenaltyPosition = useCallback((position: 'LEFT' | 'RIGHT') => {
    soundEngine.playCardFlip();
    useGameStore.getState().setPenaltyPrompt(null);
    emitGameAction('game:placePenaltyCard', { position });
  }, []);

  const handleEndTurn = useCallback(() => {
    soundEngine.playCardFlip();
    setSelectedOwnExchangeCardId(null);
    setSelectedSwapHandCardId(null);
    emitGameAction('game:endTurn');
  }, []);

  const handleCallPandu = useCallback(() => {
    soundEngine.playPanduCall();
    emitGameAction('game:callPandu');
  }, []);

  const handleInitialPeek = useCallback((cardId: string) => {
    soundEngine.playCardFlip();
    emitGameAction('game:peekInitialCard', { cardId });
  }, []);

  const handleSelfPeek = useCallback((cardId: string) => {
    soundEngine.playCardFlip();
    emitGameAction('game:selectSelfPeekCard', { cardId });
  }, []);

  const handleOtherPeek = useCallback((targetPlayerId: string, cardId: string) => {
    soundEngine.playCardFlip();
    emitGameAction('game:selectOtherPeekCard', { targetPlayerId, cardId });
  }, []);

  const handleExchangeOwnSelect = useCallback((cardId: string) => {
    soundEngine.playCardFlip();
    setSelectedOwnExchangeCardId(cardId);
    emitGameAction('game:selectOwnExchangeCard', { cardId });
  }, []);

  const handleExchangeOtherSelect = useCallback((targetPlayerId: string, cardId: string) => {
    soundEngine.playCardFlip();
    emitGameAction('game:selectOtherExchangeCard', { targetPlayerId, cardId });
    setSelectedOwnExchangeCardId(null);
  }, []);

  const handleSkipSpecial = useCallback(() => {
    soundEngine.playCardFlip();
    useGameStore.getState().setRevealedCard(null);
    setSelectedOwnExchangeCardId(null);
    emitGameAction('game:skipSpecial');
  }, []);

  const handleAcknowledgeSpecial = useCallback(() => {
    soundEngine.playCardFlip();
    useGameStore.getState().setRevealedCard(null);
    setSelectedOwnExchangeCardId(null);
    emitGameAction('game:acknowledgeSpecial');
  }, []);

  const handleXReaction = useCallback((cardId: string) => {
    soundEngine.playCardFlip();
    emitGameAction('game:xReaction', { cardId });
  }, []);

  if (scores && scores.length > 0 && (phase === GamePhase.GAME_OVER || phase === GamePhase.SCORING || phase === GamePhase.REVEAL)) {
    return <ScoreScreen scores={scores} roomId={roomId} />;
  }

  // Find the selected swap card in hand
  const selectedSwapCard = gameState?.myHand.find(c => c.id === selectedSwapHandCardId);

  return (
    <div className="game-table min-h-dvh flex flex-col justify-between select-none relative overflow-hidden bg-[#131314] text-[#e3e3e3]">
      {/* Top Floating Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#d96570] text-white px-6 py-2.5 rounded-full shadow-2xl backdrop-blur text-sm font-bold border border-rose-300/40"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            ⚠️ {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between px-4 py-2.5 relative z-20 bg-[#1e1f20]/90 backdrop-blur-md border-b border-white/5 shadow-md">
        <div className="flex items-center gap-2 text-xs text-[#c4c7c5]">
          <span className="text-[10px] font-bold text-[#8e918f] uppercase tracking-wider">Room</span>
          <span className="text-[#9b72cb] font-mono font-black tracking-widest bg-[#131314] px-2.5 py-0.5 rounded-full border border-violet-500/20">{roomId}</span>
        </div>

        {timeRemaining !== null && (
          <motion.div
            className={`text-xs font-black font-mono px-3.5 py-1 rounded-full shadow-inner ${
              timeRemaining < 5000 ? 'text-rose-400 bg-rose-500/20 border border-rose-400/40' : 'text-[#9b72cb] bg-violet-500/20 border border-[#9b72cb]/40'
            }`}
            animate={timeRemaining < 5000 ? { scale: [1, 1.08, 1] } : {}}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            ⏱️ {Math.ceil(timeRemaining / 1000)}s
          </motion.div>
        )}

        <button
          className="text-xs px-3 py-1.5 rounded-full bg-[#131314] hover:bg-[#282a2c] text-[#c4c7c5] border border-white/10 shadow-sm transition-all cursor-pointer font-bold"
          onClick={handleToggleMute}
          title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
      </div>

      {/* ── Opponents Area (Real Card Table) ── */}
      <div className="px-4 py-2 flex justify-center gap-6 flex-wrap relative z-10">
        {gameState?.opponents.map((opponent) => {
          const isTargetableForOtherPeek = isOtherPeekActive;
          const isTargetableForExchange = isExchangeActive && selectedOwnExchangeCardId !== null;

          return (
            <motion.div
              key={opponent.playerId}
              className={`glass rounded-2xl p-3 text-center transition-all shadow-xl ${
                opponent.isActive ? 'border-[#9b72cb] bg-violet-500/10 shadow-[0_0_25px_rgba(155,114,203,0.3)] ring-1 ring-[#9b72cb]' : 'border-white/5'
              } ${opponent.isEliminated ? 'opacity-30' : ''}`}
              layout
            >
              {/* Opponent Header */}
              <div className="flex items-center justify-center gap-2 mb-2">
                <Avatar avatarId={opponent.avatarId} size={28} />
                <span className="text-xs font-bold text-slate-200 truncate max-w-[90px]">{opponent.name}</span>
                {opponent.isActive && (
                  <span className="text-[9px] bg-amber-400/20 text-amber-300 font-bold px-1.5 py-0.5 rounded-full border border-amber-400/30">
                    Turn
                  </span>
                )}
              </div>

              {/* Opponent Face-down Hand Cards */}
              <div className="flex gap-2 justify-center items-center min-h-[84px] py-1">
                {opponent.cards && opponent.cards.length > 0 ? (
                  opponent.cards.map((card, i) => {
                    const isClickable = isTargetableForOtherPeek || isTargetableForExchange;
                    const isRevealingThisCard = revealedCard?.cardId === card.id;
                    const isRevealedFaceUp = isRevealingThisCard && !!revealedCard?.card?.faceUp;
                    const opponentCard = isRevealedFaceUp
                      ? { ...card, rank: revealedCard.card.rank, suit: revealedCard.card.suit, faceUp: true }
                      : card;

                    const peekStyle = isRevealedFaceUp ? 'other' : 'self';
                    const peekLabel = isRevealedFaceUp ? '👁️ VIEWING' : '👁️ PEEKING';

                    return (
                      <div
                        key={card.id || i}
                        className={`transition-all duration-200 ${
                          isClickable ? 'hover:scale-110 cursor-pointer animate-pulse ring-2 ring-emerald-400 rounded-lg shadow-lg' : ''
                        }`}
                        onClick={() => {
                          if (isTargetableForOtherPeek) {
                            handleOtherPeek(opponent.playerId, card.id);
                          } else if (isTargetableForExchange) {
                            handleExchangeOtherSelect(opponent.playerId, card.id);
                          }
                        }}
                      >
                        <Card
                          card={opponentCard}
                          size="sm"
                          index={i}
                          isPeeking={isRevealingThisCard}
                          peekLabel={peekLabel}
                          peekStyle={peekStyle as any}
                        />
                      </div>
                    );
                  })
                ) : (
                  Array.from({ length: opponent.cardCount }).map((_, i) => (
                    <div
                      key={i}
                      className="w-10 h-14 rounded-md bg-sky-950 border border-sky-600/40 shadow-sm"
                    />
                  ))
                )}
              </div>

              {!opponent.isConnected && (
                <span className="text-[10px] text-rose-400 mt-1 block">⚡ Offline</span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* ── Status & Notification Banner ── */}
      <div className="relative z-10 flex flex-col items-center justify-center my-1">
        <AnimatePresence mode="wait">
          {isMyTurn && !isSpecialActive && (
            <motion.div
              key="my-turn"
              className="px-5 py-1.5 rounded-full bg-gradient-to-r from-amber-500/30 to-amber-600/30 border border-amber-400/50 text-amber-300 font-black text-xs tracking-wider shadow-md"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              ✨ YOUR TURN
            </motion.div>
          )}

          {!isMyTurn && gameState?.activePlayerId && (
            <motion.div
              key="waiting"
              className="px-4 py-1 rounded-full bg-white/5 text-slate-400 text-xs border border-white/5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              Waiting for {gameState.opponents.find(o => o.isActive)?.name || 'opponent'}...
            </motion.div>
          )}
        </AnimatePresence>

        {/* Initial View Peek Prompt */}
        {isInitialView && (
          <motion.div
            className="mt-2 px-5 py-2 rounded-xl bg-violet-500/20 border border-violet-400/40 text-violet-300 text-xs font-bold text-center shadow-lg"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
          >
            👀 Initial Peek Phase — Tap up to {gameState?.settings.initialViewable} cards to view!
          </motion.div>
        )}

        {/* PANDU Permanent Flickering Last Round Signal */}
        {panduState && (
          <motion.div
            className="mt-2 px-6 py-2 rounded-2xl bg-rose-600/30 border-2 border-rose-500 text-white font-black text-sm tracking-widest shadow-[0_0_25px_rgba(244,63,94,0.6)] flex items-center gap-2"
            animate={{ opacity: [1, 0.35, 1], scale: [1, 1.03, 1] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <span className="text-amber-400">⚠️</span>
            <span className="bg-gradient-to-r from-amber-300 via-rose-300 to-amber-300 bg-clip-text text-transparent">
              LAST ROUND
            </span>
            <span className="text-amber-400">⚠️</span>
            <span className="text-[10px] text-rose-200 font-bold ml-1 bg-rose-950/80 px-2.5 py-0.5 rounded-full border border-rose-400/30">
              Called by {panduState.callerName}
            </span>
          </motion.div>
        )}
      </div>

      {/* ── Center Table Area (Decks & Action Zone) ── */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-4">
        {/* Draw & Discard Piles */}
        <div className="flex items-center justify-center gap-8 mb-3">
          {/* Draw Pile */}
          <div className="flex flex-col items-center">
            <DeckStack
              count={gameState?.drawPileCount ?? 0}
              label="Draw Deck"
              onClick={showDrawButton ? handleDrawCard : undefined}
              className={showDrawButton ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-slate-900 cursor-pointer animate-pulse' : ''}
            />
            {showDrawButton && (
              <button
                onClick={handleDrawCard}
                className="mt-2 px-3 py-1 rounded-lg bg-amber-400 text-slate-950 text-xs font-black tracking-wider shadow-md hover:bg-amber-300 transition-all cursor-pointer"
              >
                🎴 DRAW
              </button>
            )}
          </div>

          {/* Discard Pile (Stacked with 2nd card peeking top-left) */}
          <div className="flex flex-col items-center">
            <p className="text-[11px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Discard Pile</p>
            <div className="relative w-[76px] h-[108px] flex items-center justify-center">
              {gameState?.visibleDiscards && gameState.visibleDiscards.length > 0 ? (
                <>
                  {/* 2nd Card Underneath (Shifted top-left so top-left corner is visible) */}
                  {gameState.visibleDiscards.length > 1 && (
                    <div className="absolute -top-3 -left-3 z-0 pointer-events-none transform -rotate-6 shadow-md opacity-90">
                      <Card card={gameState.visibleDiscards[0]} size="md" />
                    </div>
                  )}
                  {/* Top Card */}
                  <div className="relative z-10 shadow-2xl">
                    <Card
                      card={gameState.visibleDiscards[gameState.visibleDiscards.length - 1]}
                      size="md"
                    />
                  </div>
                </>
              ) : (
                <div className="w-[74px] h-[104px] rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center text-white/20 text-xs font-bold">
                  Empty
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Swap Discard 3-Second Preview (Shown to player before discarding) ── */}
        <AnimatePresence>
          {swapDiscardPreview && (
            <motion.div
              className="glass-strong rounded-2xl p-4 flex flex-col items-center gap-2 border-2 border-amber-400 shadow-2xl my-2 max-w-xs w-full"
              initial={{ opacity: 0, scale: 0.8, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
            >
              <span className="text-xs font-black text-amber-300 uppercase tracking-widest animate-pulse">
                🔄 Replaced Card Discarding (3s)
              </span>
              <Card card={swapDiscardPreview} size="lg" highlighted />
              <p className="text-[11px] text-slate-300 font-semibold text-center">
                Your replaced card is being discarded to the pile...
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Wrong X-Reaction 3-Second Reveal ── */}
        <AnimatePresence>
          {xReactionWrong && (
            <motion.div
              className="glass-strong rounded-2xl p-4 flex flex-col items-center gap-2 border-2 border-rose-500 shadow-2xl my-2 max-w-xs w-full"
              initial={{ opacity: 0, scale: 0.8, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
            >
              <span className="text-xs font-black text-rose-400 uppercase tracking-widest animate-pulse">
                ❌ Wrong Card Revealed (3s)
              </span>
              <p className="text-xs font-bold text-slate-200 text-center">
                {xReactionWrong.playerName} played mismatched card!
              </p>
              <Card card={xReactionWrong.card} size="lg" highlighted />
              <span className="text-[10px] text-slate-400 italic">Returning card to hand position...</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Interactive Drawn Card & Swap Action Center ── */}
        <AnimatePresence mode="wait">
          {drawnCard && isMyTurn && !swapDiscardPreview && (
            <motion.div
              className="glass-strong rounded-2xl p-4 flex flex-col items-center gap-3 border-2 border-amber-400/60 shadow-2xl mt-1 max-w-md w-full"
              initial={{ opacity: 0, scale: 0.8, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 15 }}
            >
              <div className="flex items-center justify-center gap-6 w-full">
                {/* Drawn Card */}
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black text-amber-300 uppercase tracking-widest mb-1">
                    Drawn Card
                  </span>
                  <Card card={drawnCard} size="md" highlighted />
                </div>

                {/* Arrow indicator if hand card is selected for swap */}
                {selectedSwapCard && (
                  <div className="flex flex-col items-center text-amber-400 font-black text-lg animate-pulse">
                    ⇄
                  </div>
                )}

                {/* Selected Hand Card to Discard */}
                {selectedSwapCard && (
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black text-rose-300 uppercase tracking-widest mb-1">
                      To Discard
                    </span>
                    <Card card={selectedSwapCard} size="md" selected />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 w-full justify-center mt-1">
                {selectedSwapCard ? (
                  <button
                    onClick={handleConfirmSwap}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 text-xs font-black tracking-wider shadow-lg shadow-emerald-500/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    🔄 CONFIRM SWAP & DISCARD
                  </button>
                ) : (
                  <button
                    onClick={handleDiscardDrawn}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white text-xs font-black tracking-wider shadow-lg shadow-rose-500/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    🗑️ DISCARD DRAWN CARD
                  </button>
                )}
              </div>

              <p className="text-[11px] text-amber-200/90 font-semibold text-center">
                {selectedSwapCard
                  ? 'Click CONFIRM to place Drawn Card in hand and preview replaced card for 3s!'
                  : '👉 Tap any card in your hand below to swap with drawn card!'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Penalty Card Placement Prompt (Left / Right) ── */}
        <AnimatePresence>
          {penaltyPrompt && (
            <motion.div
              className="glass-strong rounded-2xl p-5 border-2 border-rose-500 shadow-2xl max-w-sm w-full my-2 text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <p className="text-rose-400 font-black text-sm tracking-wider mb-1">
                ⚠️ PENALTY CARD DEALT!
              </p>
              <p className="text-xs text-slate-200 mb-4 font-semibold">
                Where would you like to place your penalty card in your hand?
              </p>
              <div className="flex gap-3">
                <button
                  className="flex-1 py-3 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400 text-amber-300 text-xs font-black tracking-wider transition-all cursor-pointer shadow-lg"
                  onClick={() => handleChoosePenaltyPosition('LEFT')}
                >
                  ⬅️ EXTREME LEFT<br/><span className="text-[10px] text-amber-200 font-normal">(Position 1)</span>
                </button>
                <button
                  className="flex-1 py-3 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400 text-amber-300 text-xs font-black tracking-wider transition-all cursor-pointer shadow-lg"
                  onClick={() => handleChoosePenaltyPosition('RIGHT')}
                >
                  ➡️ EXTREME RIGHT<br/><span className="text-[10px] text-amber-200 font-normal">(Last Position)</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Special Action Prompts & Controls ── */}
        <AnimatePresence>
          {specialAction && (
            <motion.div
              className="glass-strong rounded-2xl p-4 text-center max-w-sm w-full my-2 border-2 border-amber-400/60 shadow-xl"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <p className="text-amber-300 font-extrabold text-sm mb-1">
                ⚡ SPECIAL POWER TRIGGERED!
              </p>

              {/* 7/8 Self Peek Prompt */}
              {isSelfPeekActive && (
                <p className="text-xs text-slate-200 font-bold">
                  👀 Tap one of your own hand cards below to peek at it!
                </p>
              )}

              {/* 9/10 Other Peek Prompt */}
              {isOtherPeekActive && (
                <p className="text-xs text-slate-200 font-bold">
                  👀 Tap ANY opponent's card above to view it!
                </p>
              )}

              {/* Queen Exchange Prompt */}
              {isExchangeActive && !selectedOwnExchangeCardId && specialAction.phase !== SpecialActionPhase.COMPLETE && (
                <p className="text-xs text-slate-200 font-bold">
                  👑 Step 1: Tap one of YOUR hand cards below to swap.
                </p>
              )}

              {isExchangeActive && selectedOwnExchangeCardId && specialAction.phase !== SpecialActionPhase.COMPLETE && (
                <p className="text-xs text-emerald-300 font-bold animate-pulse">
                  👑 Step 2: Now tap an OPPONENT'S card above to complete exchange!
                </p>
              )}

              {isExchangeActive && specialAction.phase === SpecialActionPhase.COMPLETE && (
                <p className="text-xs text-emerald-300 font-bold">
                  👑 Blind exchange complete! Click CONTINUE to end turn.
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 justify-center mt-3 flex-wrap">
                {specialAction.phase === SpecialActionPhase.COMPLETE ? (
                  <button
                    className="btn-primary text-xs py-2 px-6 font-black tracking-wider cursor-pointer"
                    onClick={handleAcknowledgeSpecial}
                  >
                    ✓ CONTINUE
                  </button>
                ) : (
                  <button
                    className="py-2 px-5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
                    onClick={handleSkipSpecial}
                  >
                    ⏭️ SKIP POWER & END TURN
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Revealed Peeked Card (Special Power Modal) ── */}
        <AnimatePresence>
          {revealedCard && (
            <motion.div
              className="glass-strong rounded-2xl p-4 flex flex-col items-center gap-2 border-2 border-emerald-400 shadow-2xl my-2 max-w-xs w-full"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
            >
              <span className="text-xs font-black text-emerald-400 uppercase tracking-wide">
                👁️ Peeked Card Revealed
              </span>
              <Card card={revealedCard.card} size="lg" highlighted />
              <button
                className="btn-primary text-xs py-1.5 px-6 mt-1 font-bold cursor-pointer"
                onClick={handleAcknowledgeSpecial}
              >
                ✓ Got It!
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── X Reaction Alert & Fast Reaction Zone ── */}
        <AnimatePresence>
          {showXReaction && (
            <motion.div
              className="bg-rose-600/30 border-2 border-rose-400 rounded-2xl p-4 text-center max-w-sm w-full my-2 shadow-[0_0_30px_rgba(244,63,94,0.4)]"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <p className="text-rose-300 font-black text-base tracking-wider animate-pulse">⚡ X REACTION ACTIVE!</p>
              <p className="text-xs text-slate-200 mt-1">Single-tap or double-tap your matching card or Jack below!</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Player's Hand (Bottom) ── */}
      <div className="px-4 pb-20 pt-2 relative z-10">
        <p className="text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
          {gameState?.settings.mode === GameMode.TEAM ? '🤝 Team Hand' : 'Your Hand'} ({gameState?.myHand.length || 0} Cards)
        </p>

        <div className="flex gap-2.5 justify-center flex-wrap">
          {gameState?.myHand.map((card, i) => {
            const isSelectedForExchange = selectedOwnExchangeCardId === card.id;
            const isSelectedForSwap = selectedSwapHandCardId === card.id;
            const isRevealingThisCard = revealedCard?.cardId === card.id;
            const isRevealedFaceUp = isRevealingThisCard && !!revealedCard?.card?.faceUp;
            const isOpponentViewingMyCard = isRevealingThisCard && !revealedCard?.card?.faceUp;

            const myCardToRender = isRevealedFaceUp
              ? { ...card, rank: revealedCard.card.rank, suit: revealedCard.card.suit, faceUp: true }
              : card;

            const myPeekStyle = isOpponentViewingMyCard ? 'being_viewed' : 'self';
            const myPeekLabel = isOpponentViewingMyCard ? '⚠️ BEING VIEWED' : '👁️ VIEWING';

            return (
              <Card
                key={card.id}
                card={myCardToRender}
                size="md"
                index={i}
                selected={isSelectedForExchange || isSelectedForSwap}
                isPeeking={isRevealingThisCard}
                peekLabel={myPeekLabel}
                peekStyle={myPeekStyle as any}
                onClick={() => {
                  if (isInitialView) {
                    handleInitialPeek(card.id);
                    return;
                  }
                  if (showCardDecision && drawnCard) {
                    setSelectedSwapHandCardId(card.id === selectedSwapHandCardId ? null : card.id);
                    return;
                  }
                  if (isSelfPeekActive) {
                    handleSelfPeek(card.id);
                    return;
                  }
                  if (isExchangeActive && !selectedOwnExchangeCardId) {
                    handleExchangeOwnSelect(card.id);
                    return;
                  }
                  if (showXReaction) {
                    handleXReaction(card.id);
                    return;
                  }
                }}
                onDoubleClick={() => {
                  handleXReaction(card.id);
                }}
              />
            );
          })}
          {(!gameState?.myHand || gameState.myHand.length === 0) && (
            <p className="text-slate-500 text-xs py-4 italic">No cards remaining</p>
          )}
        </div>
      </div>

      {/* ── Fixed Bottom Actions: PANDU (Left) & END TURN (Right) ── */}
      <div className="fixed bottom-3 left-0 right-0 px-4 flex items-center justify-between pointer-events-none z-30">
        {/* PANDU Button (Bottom Left) */}
        <div className="pointer-events-auto">
          {showPanduButton && (
            <motion.button
              className="btn-pandu shadow-2xl py-3 px-6 text-sm font-black tracking-widest cursor-pointer"
              onClick={handleCallPandu}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              whileTap={{ scale: 0.95 }}
            >
              👑 CALL PANDU
            </motion.button>
          )}
        </div>

        {/* END TURN Button (Bottom Right) */}
        <div className="pointer-events-auto">
          {showEndTurn && (
            <motion.button
              className="btn-primary shadow-2xl py-3 px-7 text-sm font-black tracking-wider cursor-pointer"
              onClick={handleEndTurn}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              whileTap={{ scale: 0.95 }}
            >
              ✓ END TURN →
            </motion.button>
          )}
        </div>
      </div>

      {/* ── Shuffle Overlay ── */}
      <AnimatePresence>
        {isShuffling && (phase === GamePhase.SHUFFLING || phase === GamePhase.DEALING) && (
          <motion.div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="text-center"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              <div className="text-6xl mb-4">🎴</div>
              <p className="text-amber-400 font-display text-2xl">Shuffling & Dealing...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Score Screen ────────────────────────────────────────

function ScoreScreen({ scores, roomId }: { scores: any[]; roomId: string }) {
  const router = useRouter();
  const rematchVotes = useGameStore((s) => s.rematchVotes);
  const totalPlayers = useGameStore((s) => s.totalPlayers);
  const myPlayerId = useRoomStore((s) => s.myPlayerId);
  const [hasVoted, setHasVoted] = useState(false);

  const hasVotedRematch = hasVoted || (myPlayerId ? rematchVotes.includes(myPlayerId) : false);
  const effectiveTotal = totalPlayers > 0 ? totalPlayers : (scores?.length || 4);

  const RANK_BADGES = ['🥇', '🥈', '🥉'];

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 relative overflow-hidden bg-[#131314] text-[#e3e3e3]">
      <div className="absolute inset-0 bg-radial from-[#1e1f2b]/50 via-[#131314] to-[#0e0e10] opacity-95" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#9b72cb]/12 blur-[140px]" />

      <motion.div
        className="relative z-10 w-full max-w-md space-y-4"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center">
          <span className="text-2xl bg-gradient-to-r from-[#4285f4] via-[#9b72cb] to-[#d96570] bg-clip-text text-transparent">✦</span>
          <h1 className="font-display text-4xl text-center tracking-wide bg-gradient-to-r from-[#4285f4] via-[#9b72cb] to-[#d96570] bg-clip-text text-transparent drop-shadow-[0_4px_25px_rgba(155,114,203,0.5)]">
            MATCH RESULTS
          </h1>
        </div>

        <div className="space-y-3 mt-6">
          {scores.map((score, i) => (
            <motion.div
              key={score.playerId}
              className={`glass rounded-3xl p-4 flex items-center gap-3 shadow-xl ${
                score.rank === 1 ? 'border-violet-500/50 bg-violet-500/10 shadow-[0_0_30px_rgba(155,114,203,0.3)] ring-1 ring-violet-400/40' : 'border-white/5'
              }`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="text-2xl w-10 text-center drop-shadow-md">
                {score.rank <= 3 ? RANK_BADGES[score.rank - 1] : `#${score.rank}`}
              </div>
              <Avatar avatarId={score.avatarId} size={42} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-[#e3e3e3] truncate">{score.playerName}</p>
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {score.cards.map((card: ClientCard) => (
                    <Card key={card.id} card={card} size="sm" />
                  ))}
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black font-mono bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(251,188,4,0.4)]">{score.score}</p>
                <p className="text-[10px] font-bold text-[#8e918f] uppercase tracking-wider">pts</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex gap-3 mt-8">
          <button
            className={`flex-1 py-3.5 px-4 rounded-full font-bold text-sm tracking-wide uppercase transition-all cursor-pointer shadow-xl ${
              hasVotedRematch
                ? 'bg-violet-500/30 border-2 border-[#9b72cb] text-violet-200 animate-pulse'
                : 'btn-primary'
            }`}
            onClick={() => {
              setHasVoted(true);
              emitGameAction('game:rematch');
            }}
          >
            {hasVotedRematch
              ? `⏳ Waiting (${rematchVotes.length}/${effectiveTotal})`
              : `🔄 Rematch (${rematchVotes.length}/${effectiveTotal})`}
          </button>
          <button
            className="btn-secondary flex-1 rounded-full font-bold cursor-pointer"
            onClick={() => {
              emitGameAction('game:returnToLobby');
            }}
          >
            🏠 Lobby
          </button>
        </div>
      </motion.div>
    </div>
  );
}
