// ============================================================
// PANDU — Game Table Page (VIP Interactive Card Flow)
// ============================================================

'use client';

import { useEffect, useState, useCallback, useRef, use } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useSocket, emitGameAction } from '@/hooks/useSocket';
import { useRoomStore } from '@/stores/roomStore';
import { useGameStore } from '@/stores/gameStore';
import { Card, DeckStack } from '@/components/cards/Card';
import { Avatar } from '@/components/lobby/AvatarPicker';
import { CardFlightAnimationOverlay, FlyingCardAnim } from '@/components/cards/CardFlightAnimation';
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
  const flightEvents = useGameStore((s) => s.flightEvents);
  const removeFlight = useGameStore((s) => s.removeFlight);
  const myPlayerId = useRoomStore((s) => s.myPlayerId);

  const [isMuted, setIsMuted] = useState(false);
  const [selectedOwnExchangeCardId, setSelectedOwnExchangeCardId] = useState<string | null>(null);
  const [selectedSwapHandCardId, setSelectedSwapHandCardId] = useState<string | null>(null);
  const [swapDiscardPreview, setSwapDiscardPreview] = useState<ClientCard | null>(null);
  const [activeFlights, setActiveFlights] = useState<FlyingCardAnim[]>([]);

  // DOM Refs for animation coordinates
  const drawDeckRef = useRef<HTMLDivElement>(null);
  const discardPileRef = useRef<HTMLDivElement>(null);
  const actionCenterRef = useRef<HTMLDivElement>(null);
  const myHandRef = useRef<HTMLDivElement>(null);

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

  // Process flight animation events
  useEffect(() => {
    if (!flightEvents || flightEvents.length === 0) return;

    flightEvents.forEach((ev) => {
      const deckRect = drawDeckRef.current?.getBoundingClientRect();
      const discardRect = discardPileRef.current?.getBoundingClientRect();
      const actionRect = actionCenterRef.current?.getBoundingClientRect();
      const handRect = myHandRef.current?.getBoundingClientRect();

      const startX = deckRect?.left ?? window.innerWidth / 2 - 100;
      const startY = deckRect?.top ?? window.innerHeight / 2 - 50;
      const endX = discardRect?.left ?? window.innerWidth / 2 + 50;
      const endY = discardRect?.top ?? window.innerHeight / 2 - 50;

      if (ev.type === 'draw') {
        const targetX = ev.data.playerId === myPlayerId
          ? (actionRect?.left ?? window.innerWidth / 2 - 36)
          : window.innerWidth / 2 - 36;
        const targetY = ev.data.playerId === myPlayerId
          ? (actionRect?.top ?? window.innerHeight / 2 + 50)
          : 60;

        setActiveFlights((prev) => [
          ...prev,
          {
            id: ev.id,
            card: ev.data.card,
            startX,
            startY,
            endX: targetX,
            endY: targetY,
            duration: 0.6,
            rotateStart: -10,
            rotateEnd: 0,
          },
        ]);
      } else if (ev.type === 'discard' || ev.type === 'replace') {
        const fromX = ev.data.playerId === myPlayerId
          ? (handRect?.left ?? window.innerWidth / 2 - 36)
          : window.innerWidth / 2 - 36;
        const fromY = ev.data.playerId === myPlayerId
          ? (handRect?.top ?? window.innerHeight - 150)
          : 60;

        setActiveFlights((prev) => [
          ...prev,
          {
            id: ev.id,
            card: ev.data.card || ev.data.discardedCard,
            startX: fromX,
            startY: fromY,
            endX,
            endY,
            duration: 0.65,
            rotateStart: 5,
            rotateEnd: -5,
            highlighted: true,
          },
        ]);
      } else if (ev.type === 'exchange') {
        // Cross-flight exchange
        setActiveFlights((prev) => [
          ...prev,
          {
            id: `${ev.id}_own`,
            startX: handRect?.left ?? window.innerWidth / 2 - 36,
            startY: handRect?.top ?? window.innerHeight - 150,
            endX: window.innerWidth / 2 - 36,
            endY: 70,
            duration: 0.8,
            scaleStart: 1,
            scaleEnd: 0.85,
          },
          {
            id: `${ev.id}_other`,
            startX: window.innerWidth / 2 - 36,
            startY: 70,
            endX: handRect?.left ?? window.innerWidth / 2 - 36,
            endY: handRect?.top ?? window.innerHeight - 150,
            duration: 0.8,
            scaleStart: 0.85,
            scaleEnd: 1,
            highlighted: true,
          },
        ]);
      }

      removeFlight(ev.id);
    });
  }, [flightEvents, myPlayerId, removeFlight]);

  const handleFlightComplete = (id: string) => {
    setActiveFlights((prev) => prev.filter((f) => f.id !== id));
  };

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
    const discardedHandCard = gameState?.myHand.find(c => c && c.id === selectedSwapHandCardId);
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
  const selectedSwapCard = gameState?.myHand.find(c => c && c.id === selectedSwapHandCardId);

  // Helper to split hand array into 2 structured rows
  const renderHandGrid = (cards: (ClientCard | null)[], isOpponent = false, opponentId?: string) => {
    const totalSlots = Math.max(cards.length, gameState?.settings.cardsDealt || 4);
    const cols = Math.max(2, Math.ceil(totalSlots / 2));
    const topRow = cards.slice(0, cols);
    const bottomRow = cards.slice(cols);

    const renderCardOrEmpty = (card: ClientCard | null, idx: number) => {
      const cardSize = isOpponent ? 'sm' : 'md';
      const slotWidth = isOpponent ? 'w-[52px]' : 'w-[72px]';
      const slotHeight = isOpponent ? 'h-[76px]' : 'h-[104px]';

      if (!card) {
        return (
          <div
            key={`empty_${idx}`}
            className={`${slotWidth} ${slotHeight} rounded-lg border-2 border-dashed border-white/10 flex items-center justify-center text-white/15 text-[10px] font-bold select-none bg-white/[0.02]`}
          >
            Empty
          </div>
        );
      }

      if (isOpponent) {
        const isTargetableForOtherPeek = isOtherPeekActive;
        const isTargetableForExchange = isExchangeActive && selectedOwnExchangeCardId !== null;
        const isClickable = isTargetableForOtherPeek || isTargetableForExchange;
        const isRevealingThisCard = revealedCard?.cardId === card.id;
        const isRevealedFaceUp = isRevealingThisCard && !!revealedCard?.card?.faceUp;
        const oppCardToRender = isRevealedFaceUp
          ? { ...card, rank: revealedCard.card.rank, suit: revealedCard.card.suit, faceUp: true }
          : card;

        const peekStyle = isRevealedFaceUp ? 'other' : 'self';
        const peekLabel = isRevealedFaceUp ? '👁️ VIEWING' : '👁️ PEEKING';

        return (
          <div
            key={card.id || idx}
            className={`transition-all duration-200 ${
              isClickable ? 'hover:scale-110 cursor-pointer animate-pulse ring-2 ring-emerald-400 rounded-lg shadow-lg' : ''
            }`}
            onClick={() => {
              if (!opponentId) return;
              if (isTargetableForOtherPeek) {
                handleOtherPeek(opponentId, card.id);
              } else if (isTargetableForExchange) {
                handleExchangeOtherSelect(opponentId, card.id);
              }
            }}
          >
            <Card
              card={oppCardToRender}
              size="sm"
              index={idx}
              isPeeking={isRevealingThisCard}
              peekLabel={peekLabel}
              peekStyle={peekStyle as any}
            />
          </div>
        );
      }

      // Player's Own Card
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
          key={card.id || idx}
          card={myCardToRender}
          size="md"
          index={idx}
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
    };

    return (
      <div className="flex flex-col gap-2 items-center justify-center">
        {/* Top Row */}
        <div className="flex gap-2.5 justify-center items-center">
          {topRow.map((card, i) => renderCardOrEmpty(card, i))}
        </div>
        {/* Bottom Row */}
        {bottomRow.length > 0 && (
          <div className="flex gap-2.5 justify-center items-center">
            {bottomRow.map((card, i) => renderCardOrEmpty(card, cols + i))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="game-table min-h-dvh flex flex-col justify-between select-none relative overflow-hidden bg-[#131314] text-[#e3e3e3]">
      {/* Floating Card Flight Animation Overlay */}
      <CardFlightAnimationOverlay flights={activeFlights} onComplete={handleFlightComplete} />

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

      {/* ── Fixed Action Button 1: PANDU (Middle Leftmost) ── */}
      <div className="fixed left-3 md:left-6 top-1/2 -translate-y-1/2 z-40 pointer-events-auto">
        <AnimatePresence>
          {showPanduButton && (
            <motion.button
              className="btn-pandu shadow-[0_0_30px_rgba(245,158,11,0.6)] py-4 px-5 md:py-5 md:px-7 text-sm md:text-base font-black tracking-widest cursor-pointer rounded-2xl border-2 border-amber-300 flex flex-col items-center gap-1 bg-gradient-to-b from-amber-400 to-amber-600 text-slate-950"
              onClick={handleCallPandu}
              initial={{ opacity: 0, x: -40, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -40, scale: 0.8 }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
            >
              <span className="text-xl">👑</span>
              <span>CALL</span>
              <span className="text-xs md:text-sm font-black text-amber-950">PANDU</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── Fixed Action Button 2: END TURN (Middle Rightmost) ── */}
      <div className="fixed right-3 md:right-6 top-1/2 -translate-y-1/2 z-40 pointer-events-auto">
        <AnimatePresence>
          {showEndTurn && (
            <motion.button
              className="btn-primary shadow-[0_0_30px_rgba(168,85,247,0.6)] py-4 px-5 md:py-5 md:px-7 text-sm md:text-base font-black tracking-wider cursor-pointer rounded-2xl border-2 border-purple-300 flex flex-col items-center gap-1 bg-gradient-to-b from-purple-500 to-indigo-600 text-white"
              onClick={handleEndTurn}
              initial={{ opacity: 0, x: 40, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.8 }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
            >
              <span className="text-xl">✓</span>
              <span>END</span>
              <span className="text-xs md:text-sm font-black text-purple-200">TURN →</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

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

      {/* ── Opponents Area (Fixed Grid Orientation) ── */}
      <div className="px-4 py-2 flex justify-center gap-6 flex-wrap relative z-10">
        {gameState?.opponents.map((opponent) => {
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

              {/* Opponent Hand Grid (Spatially Fixed) */}
              <div className="min-h-[84px] py-1 flex items-center justify-center">
                {opponent.cards && opponent.cards.length > 0 ? (
                  renderHandGrid(opponent.cards, true, opponent.playerId)
                ) : (
                  <span className="text-xs text-slate-500 italic">No cards</span>
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
        <div className="flex items-center justify-center gap-10 mb-3">
          {/* Draw Pile */}
          <div ref={drawDeckRef} className="flex flex-col items-center">
            <DeckStack
              count={gameState?.drawPileCount ?? 0}
              label="Draw Deck"
              onClick={showDrawButton ? handleDrawCard : undefined}
              className={showDrawButton ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-slate-900 cursor-pointer animate-pulse' : ''}
            />
            {showDrawButton && (
              <button
                onClick={handleDrawCard}
                className="mt-2 px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black tracking-wider shadow-lg transition-all cursor-pointer"
              >
                🎴 DRAW
              </button>
            )}
          </div>

          {/* Discard Pile */}
          <div ref={discardPileRef} className="flex flex-col items-center">
            <p className="text-[11px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Discard Pile</p>
            <div className="relative w-[76px] h-[108px] flex items-center justify-center">
              {gameState?.visibleDiscards && gameState.visibleDiscards.length > 0 ? (
                <>
                  {gameState.visibleDiscards.length > 1 && (
                    <div className="absolute -top-3 -left-3 z-0 pointer-events-none transform -rotate-6 shadow-md opacity-90">
                      <Card card={gameState.visibleDiscards[0]} size="md" />
                    </div>
                  )}
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
              className="glass-strong rounded-2xl p-5 flex flex-col items-center gap-3 border-2 border-amber-400 shadow-2xl my-2 max-w-sm w-full"
              initial={{ opacity: 0, scale: 0.8, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
            >
              <span className="text-sm font-black text-amber-300 uppercase tracking-widest animate-pulse">
                🔄 Replaced Card Discarding (3s)
              </span>
              <Card card={swapDiscardPreview} size="lg" highlighted />
              <p className="text-xs text-slate-200 font-semibold text-center">
                Your replaced card is being discarded to the pile...
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Wrong X-Reaction 3-Second Reveal ── */}
        <AnimatePresence>
          {xReactionWrong && (
            <motion.div
              className="glass-strong rounded-2xl p-5 flex flex-col items-center gap-3 border-2 border-rose-500 shadow-2xl my-2 max-w-sm w-full"
              initial={{ opacity: 0, scale: 0.8, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
            >
              <span className="text-sm font-black text-rose-400 uppercase tracking-widest animate-pulse">
                ❌ Wrong Card Revealed (3s)
              </span>
              <p className="text-sm font-bold text-slate-200 text-center">
                {xReactionWrong.playerName} played mismatched card!
              </p>
              <Card card={xReactionWrong.card} size="lg" highlighted />
              <span className="text-xs text-slate-400 italic">Returning card to hand position...</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Interactive Drawn Card & Swap Action Center (BOLD & PROMINENT) ── */}
        <AnimatePresence mode="wait">
          {drawnCard && isMyTurn && !swapDiscardPreview && (
            <motion.div
              ref={actionCenterRef}
              className="glass-strong rounded-3xl p-6 flex flex-col items-center gap-4 border-2 border-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.4)] mt-1 max-w-lg w-full bg-[#1e1f20]/95"
              initial={{ opacity: 0, scale: 0.85, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 15 }}
            >
              <div className="flex items-center justify-center gap-8 w-full">
                {/* Drawn Card */}
                <div className="flex flex-col items-center">
                  <span className="text-xs font-black text-amber-300 uppercase tracking-widest mb-1.5">
                    Drawn Card
                  </span>
                  <Card card={drawnCard} size="lg" highlighted />
                </div>

                {/* Arrow indicator if hand card is selected for swap */}
                {selectedSwapCard && (
                  <div className="flex flex-col items-center text-amber-400 font-black text-2xl animate-pulse">
                    ⇄
                  </div>
                )}

                {/* Selected Hand Card to Discard */}
                {selectedSwapCard && (
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-black text-rose-300 uppercase tracking-widest mb-1.5">
                      To Discard
                    </span>
                    <Card card={selectedSwapCard} size="lg" selected />
                  </div>
                )}
              </div>

              {/* Action Buttons (Large & Bold) */}
              <div className="flex gap-3 w-full justify-center mt-2">
                {selectedSwapCard ? (
                  <button
                    onClick={handleConfirmSwap}
                    className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 text-sm font-black tracking-wider shadow-xl shadow-emerald-500/40 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    🔄 CONFIRM SWAP & DISCARD
                  </button>
                ) : (
                  <button
                    onClick={handleDiscardDrawn}
                    className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white text-sm font-black tracking-wider shadow-xl shadow-rose-500/40 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    🗑️ DISCARD DRAWN CARD
                  </button>
                )}
              </div>

              <p className="text-xs md:text-sm text-amber-200 font-bold text-center">
                {selectedSwapCard
                  ? 'Click CONFIRM to place Drawn Card in hand and preview replaced card for 3s!'
                  : '👉 Tap any card in your hand below to swap with drawn card!'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Penalty Card Placement Prompt (Bold & Prominent) ── */}
        <AnimatePresence>
          {penaltyPrompt && (
            <motion.div
              className="glass-strong rounded-3xl p-6 border-2 border-rose-500 shadow-2xl max-w-md w-full my-2 text-center bg-[#1e1f20]/95"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <p className="text-rose-400 font-black text-base tracking-wider mb-1">
                ⚠️ PENALTY CARD DEALT!
              </p>
              <p className="text-sm text-slate-200 mb-5 font-bold">
                Where would you like to place your penalty card in your hand?
              </p>
              <div className="flex gap-4">
                <button
                  className="flex-1 py-4 px-4 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border-2 border-amber-400 text-amber-300 text-sm font-black tracking-wider transition-all cursor-pointer shadow-xl"
                  onClick={() => handleChoosePenaltyPosition('LEFT')}
                >
                  ⬅️ EXTREME LEFT<br/><span className="text-xs text-amber-200 font-normal">(Position 1)</span>
                </button>
                <button
                  className="flex-1 py-4 px-4 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border-2 border-amber-400 text-amber-300 text-sm font-black tracking-wider transition-all cursor-pointer shadow-xl"
                  onClick={() => handleChoosePenaltyPosition('RIGHT')}
                >
                  ➡️ EXTREME RIGHT<br/><span className="text-xs text-amber-200 font-normal">(Last Position)</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Special Action Prompts & Controls (Bold & Prominent) ── */}
        <AnimatePresence>
          {specialAction && (
            <motion.div
              className="glass-strong rounded-3xl p-5 text-center max-w-md w-full my-2 border-2 border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.3)] bg-[#1e1f20]/95"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <p className="text-amber-300 font-black text-base md:text-lg mb-2">
                ⚡ SPECIAL POWER TRIGGERED!
              </p>

              {/* 7/8 Self Peek Prompt */}
              {isSelfPeekActive && (
                <p className="text-sm text-slate-100 font-extrabold">
                  👀 Tap one of your own hand cards below to peek at it!
                </p>
              )}

              {/* 9/10 Other Peek Prompt */}
              {isOtherPeekActive && (
                <p className="text-sm text-slate-100 font-extrabold">
                  👀 Tap ANY opponent's card above to view it!
                </p>
              )}

              {/* Queen Exchange Prompt */}
              {isExchangeActive && !selectedOwnExchangeCardId && specialAction.phase !== SpecialActionPhase.COMPLETE && (
                <p className="text-sm text-slate-100 font-extrabold">
                  👑 Step 1: Tap one of YOUR hand cards below to swap.
                </p>
              )}

              {isExchangeActive && selectedOwnExchangeCardId && specialAction.phase !== SpecialActionPhase.COMPLETE && (
                <p className="text-sm text-emerald-300 font-extrabold animate-pulse">
                  👑 Step 2: Now tap an OPPONENT'S card above to complete exchange!
                </p>
              )}

              {isExchangeActive && specialAction.phase === SpecialActionPhase.COMPLETE && (
                <p className="text-sm text-emerald-300 font-extrabold">
                  👑 Blind exchange complete! Click CONTINUE to end turn.
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 justify-center mt-4 flex-wrap">
                {specialAction.phase === SpecialActionPhase.COMPLETE ? (
                  <button
                    className="btn-primary text-sm py-3 px-8 font-black tracking-wider cursor-pointer shadow-xl rounded-2xl"
                    onClick={handleAcknowledgeSpecial}
                  >
                    ✓ CONTINUE
                  </button>
                ) : (
                  <button
                    className="py-3 px-6 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-slate-200 hover:text-white text-xs font-bold transition-all cursor-pointer"
                    onClick={handleSkipSpecial}
                  >
                    ⏭️ SKIP POWER & END TURN
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Revealed Peeked Card Modal Overlay (Centered & Bold) ── */}
        <AnimatePresence>
          {revealedCard && (
            <motion.div
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="glass-strong rounded-3xl p-6 flex flex-col items-center gap-4 border-2 border-emerald-400 shadow-[0_0_40px_rgba(52,211,153,0.5)] max-w-sm w-full bg-[#1e1f20]"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.8 }}
              >
                <span className="text-sm font-black text-emerald-400 uppercase tracking-wider">
                  👁️ PEEKED CARD REVEALED
                </span>
                <Card card={revealedCard.card} size="lg" highlighted />
                <button
                  className="btn-primary text-sm py-3 px-8 mt-2 font-black tracking-wider cursor-pointer rounded-2xl shadow-xl"
                  onClick={handleAcknowledgeSpecial}
                >
                  ✓ Got It!
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── X Reaction Alert & Fast Reaction Zone ── */}
        <AnimatePresence>
          {showXReaction && (
            <motion.div
              className="bg-rose-600/30 border-2 border-rose-400 rounded-3xl p-5 text-center max-w-md w-full my-2 shadow-[0_0_30px_rgba(244,63,94,0.4)]"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <p className="text-rose-300 font-black text-base tracking-wider animate-pulse">⚡ X REACTION ACTIVE!</p>
              <p className="text-xs text-slate-200 mt-1 font-bold">Single-tap or double-tap your matching card below!</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Player's Hand (Bottom Grid Layout) ── */}
      <div ref={myHandRef} className="px-4 pb-14 pt-2 relative z-10">
        <p className="text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
          {gameState?.settings.mode === GameMode.TEAM ? '🤝 Team Hand' : 'Your Hand'} ({gameState?.myHand.filter(Boolean).length || 0} Cards)
        </p>

        {gameState?.myHand && gameState.myHand.length > 0 ? (
          renderHandGrid(gameState.myHand)
        ) : (
          <p className="text-slate-500 text-xs py-4 text-center italic">No cards remaining</p>
        )}
      </div>
    </div>
  );
}

// ── Score Screen Component ──────────────────────────

function ScoreScreen({ scores, roomId }: { scores: any[]; roomId: string }) {
  const router = useRouter();
  const sorted = [...scores].sort((a, b) => a.rank - b.rank);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-[#131314] text-[#e3e3e3] relative overflow-hidden">
      <motion.div
        className="glass-strong rounded-3xl p-8 max-w-md w-full text-center border-2 border-amber-400 shadow-[0_0_40px_rgba(245,158,11,0.3)] bg-[#1e1f20]/95"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <span className="text-4xl mb-2 block">🏆</span>
        <h1 className="text-2xl font-black text-amber-400 tracking-wider mb-1">GAME OVER</h1>
        <p className="text-xs text-slate-400 mb-6 uppercase tracking-widest font-bold">Final Standings</p>

        <div className="flex flex-col gap-3 mb-8">
          {sorted.map((s, i) => (
            <div
              key={s.playerId || i}
              className={`flex items-center justify-between p-3.5 rounded-2xl border ${
                i === 0
                  ? 'bg-amber-400/20 border-amber-400 text-amber-300 font-black shadow-lg'
                  : 'bg-white/5 border-white/10 text-slate-200 font-bold'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-black w-6 text-center">{i === 0 ? '👑' : `#${s.rank || i + 1}`}</span>
                <Avatar avatarId={s.avatarId} size={28} />
                <span className="text-sm truncate max-w-[140px]">{s.playerName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 uppercase">Score</span>
                <span className="text-base font-black font-mono">{s.score}</span>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            soundEngine.playCardFlip();
            router.push(`/room/${roomId}`);
          }}
          className="btn-primary w-full py-4 rounded-2xl text-sm font-black tracking-wider cursor-pointer shadow-xl"
        >
          RETURN TO LOBBY
        </button>
      </motion.div>
    </div>
  );
}
