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
  const penaltyPrompt = useGameStore((s) => s.penaltyPrompt);
  const xReactionWrong = useGameStore((s) => s.xReactionWrong);
  const exchangedBanner = useGameStore((s) => s.exchangedBanner);
  const blinkingCardIds = useGameStore((s) => s.blinkingCardIds);
  const myPlayerId = useRoomStore((s) => s.myPlayerId);

  const [isMuted, setIsMuted] = useState(false);
  const [selectedOwnExchangeCardId, setSelectedOwnExchangeCardId] = useState<string | null>(null);
  const [selectedOtherExchangeCardId, setSelectedOtherExchangeCardId] = useState<string | null>(null);
  const [selectedOtherExchangePlayerId, setSelectedOtherExchangePlayerId] = useState<string | null>(null);
  const [selectedSwapHandCardId, setSelectedSwapHandCardId] = useState<string | null>(null);
  const [swapDiscardPreview, setSwapDiscardPreview] = useState<ClientCard | null>(null);

  // DOM Refs for animation coordinates
  const drawDeckRef = useRef<HTMLDivElement>(null);
  const discardPileRef = useRef<HTMLDivElement>(null);
  const actionCenterRef = useRef<HTMLDivElement>(null);
  const myHandRef = useRef<HTMLDivElement>(null);
  const floatingPenaltyRef = useRef<HTMLDivElement>(null);

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
  const hasDiscardCard = (gameState?.visibleDiscards && gameState.visibleDiscards.length > 0) ?? false;

  // Special power active states
  const isSpecialActive = phase === GamePhase.SPECIAL_ACTION || specialAction !== null;
  const isSelfPeekActive = specialAction?.type === SpecialPowerType.SELF_PEEK && specialAction?.phase === SpecialActionPhase.SELECT_CARD;
  const isOtherPeekActive = specialAction?.type === SpecialPowerType.OTHER_PEEK && specialAction?.phase === SpecialActionPhase.SELECT_CARD;
  const isExchangeActive = specialAction?.type === SpecialPowerType.BLIND_EXCHANGE;

  // Helper to get element bounding rect by ID with fallback
  const getCardRect = (elementId: string) => {
    if (typeof document === 'undefined') return null;
    const el = document.getElementById(elementId);
    if (el) return el.getBoundingClientRect();
    return null;
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

  // Handle placement of penalty card directly into a chosen slot index without reindexing remaining cards
  const handlePlacePenaltyAtSlot = useCallback((slotIndex?: number) => {
    soundEngine.playCardFlip();
    const penaltyCardId = penaltyPrompt?.cardId;
    if (penaltyCardId) {
      useGameStore.getState().triggerCardBlink(penaltyCardId);
    }
    useGameStore.getState().setPenaltyPrompt(null);
    emitGameAction('game:placePenaltyCard', { slotIndex });
  }, [penaltyPrompt]);

  const handleEndTurn = useCallback(() => {
    soundEngine.playCardFlip();
    setSelectedOwnExchangeCardId(null);
    setSelectedOtherExchangeCardId(null);
    setSelectedOtherExchangePlayerId(null);
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

  // Queen Step 1: Select Own Card
  const handleExchangeOwnSelect = useCallback((cardId: string) => {
    soundEngine.playCardFlip();
    setSelectedOwnExchangeCardId(cardId);
    emitGameAction('game:selectOwnExchangeCard', { cardId });
  }, []);

  // Queen Step 2: Select Other Card (Floats both, asks confirmation)
  const handleExchangeOtherSelect = useCallback((targetPlayerId: string, cardId: string) => {
    soundEngine.playCardFlip();
    setSelectedOtherExchangeCardId(cardId);
    setSelectedOtherExchangePlayerId(targetPlayerId);
  }, []);

  // Queen Step 3: Confirm Exchange
  const handleConfirmQueenExchange = useCallback(() => {
    if (!selectedOtherExchangePlayerId || !selectedOtherExchangeCardId) return;
    soundEngine.playCardFlip();
    emitGameAction('game:selectOtherExchangeCard', {
      targetPlayerId: selectedOtherExchangePlayerId,
      cardId: selectedOtherExchangeCardId,
    });
    setSelectedOwnExchangeCardId(null);
    setSelectedOtherExchangeCardId(null);
    setSelectedOtherExchangePlayerId(null);
  }, [selectedOtherExchangePlayerId, selectedOtherExchangeCardId]);

  // Queen Cancel Selection
  const handleCancelQueenSelection = useCallback(() => {
    soundEngine.playCardFlip();
    setSelectedOwnExchangeCardId(null);
    setSelectedOtherExchangeCardId(null);
    setSelectedOtherExchangePlayerId(null);
  }, []);

  const handleSkipSpecial = useCallback(() => {
    soundEngine.playCardFlip();
    useGameStore.getState().setRevealedCard(null);
    setSelectedOwnExchangeCardId(null);
    setSelectedOtherExchangeCardId(null);
    setSelectedOtherExchangePlayerId(null);
    emitGameAction('game:skipSpecial');
  }, []);

  const handleAcknowledgeSpecial = useCallback(() => {
    soundEngine.playCardFlip();
    useGameStore.getState().setRevealedCard(null);
    setSelectedOwnExchangeCardId(null);
    setSelectedOtherExchangeCardId(null);
    setSelectedOtherExchangePlayerId(null);
    emitGameAction('game:acknowledgeSpecial');
  }, []);

  // ── Sequential Card-by-Card Reveal (Last Place -> 1st Place, 1 card / 0.75s) ──
  const [showFinalStandings, setShowFinalStandings] = useState(false);
  const [revealedSlots, setRevealedSlots] = useState<Set<string>>(new Set());

  const isGameEnding = Boolean(
    (scores && scores.length > 0) ||
    phase === GamePhase.GAME_OVER ||
    phase === GamePhase.SCORING ||
    phase === GamePhase.REVEAL
  );

  useEffect(() => {
    if (!isGameEnding || !scores || scores.length === 0 || showFinalStandings) return;

    // Order players from LAST position (highest rank number) to 1st position (Rank 1)
    const reversePlayers = [...scores].sort((a, b) => b.rank - a.rank);
    let isCancelled = false;
    let totalDelay = 0;
    const timeouts: NodeJS.Timeout[] = [];

    reversePlayers.forEach((player) => {
      const cardCount = player.cards?.length || 0;
      for (let i = 0; i < cardCount; i++) {
        const slotKey = `${player.playerId}_${i}`;
        const t = setTimeout(() => {
          if (isCancelled) return;
          soundEngine.playCardFlip();
          setRevealedSlots((prev) => new Set([...prev, slotKey]));
        }, totalDelay);
        timeouts.push(t);
        totalDelay += 750; // 0.75s per card
      }
    });

    // After all players' cards are revealed, wait 5 seconds, then show Final Standings
    const finalTimer = setTimeout(() => {
      if (isCancelled) return;
      soundEngine.playVictory();
      setShowFinalStandings(true);
    }, totalDelay + 5000);
    timeouts.push(finalTimer);

    return () => {
      isCancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, [isGameEnding, scores, showFinalStandings]);

  // X-Reaction Fast Discard Handler
  const handleXReaction = useCallback((cardId: string) => {
    soundEngine.playCardFlip();
    emitGameAction('game:xReaction', { cardId });
  }, []);

  // Show final standings only after sequential reveal on table
  if (showFinalStandings && scores && scores.length > 0) {
    return <ScoreScreen scores={scores} roomId={roomId} />;
  }

  // Find the selected swap card in hand
  const selectedSwapCard = gameState?.myHand.find(c => c && c.id === selectedSwapHandCardId);

  // Helper to split hand array: MAX 6 cards in Line 1, 7th card onwards alone in Line 2
  const renderHandGrid = (cards: (ClientCard | null)[], isOpponent = false, opponentId?: string) => {
    const topRow = cards.slice(0, 6);
    const bottomRow = cards.slice(6);
    const isPenaltyActiveForMe = !isOpponent && !!penaltyPrompt;
    const hasEmptySlotInHand = !isOpponent && cards.some(c => c === null);

    const renderCardOrEmpty = (card: ClientCard | null, idx: number) => {
      const slotWidth = isOpponent ? 'w-[50px] md:w-[56px]' : 'w-[68px] md:w-[76px]';
      const slotHeight = isOpponent ? 'h-[72px] md:h-[80px]' : 'h-[98px] md:h-[108px]';

      if (!card) {
        if (isPenaltyActiveForMe) {
          return (
            <motion.div
              key={`empty_${idx}`}
              id={`my-card-slot-empty-${idx}`}
              className={`${slotWidth} ${slotHeight} rounded-xl border-2 border-dashed border-rose-400 bg-rose-500/20 flex flex-col items-center justify-center text-rose-300 text-[10px] font-black cursor-pointer hover:scale-105 hover:bg-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.6)] animate-pulse`}
              onClick={() => handlePlacePenaltyAtSlot(idx)}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="text-sm">⬇️</span>
              <span>PLACE</span>
            </motion.div>
          );
        }

        return (
          <div
            key={`empty_${idx}`}
            className={`${slotWidth} ${slotHeight} rounded-lg border-2 border-dashed border-white/10 flex items-center justify-center text-white/15 text-[10px] font-bold select-none bg-white/[0.02]`}
          >
            Empty
          </div>
        );
      }

      const isBlinking = (blinkingCardIds?.includes(card.id)) ?? false;

      if (isOpponent) {
        const isTargetableForOtherPeek = isOtherPeekActive;
        const isTargetableForExchange = isExchangeActive && selectedOwnExchangeCardId !== null;
        const isClickable = isTargetableForOtherPeek || isTargetableForExchange;
        const isSelectedOther = selectedOtherExchangeCardId === card.id;
        const isRevealingThisCard = revealedCard?.cardId === card.id;
        const isRevealedFaceUp = isRevealingThisCard && !!revealedCard?.card?.faceUp;

        // Sequential reveal slot check
        const slotKey = `${opponentId}_${idx}`;
        const isSlotRevealed = revealedSlots.has(slotKey);
        const oppScoreObj = scores?.find((s) => s.playerId === opponentId);
        const finalOppCard = oppScoreObj?.cards?.[idx];
        const oppCardToRender = (isGameEnding && isSlotRevealed && finalOppCard)
          ? { ...finalOppCard, faceUp: true }
          : isRevealedFaceUp
          ? { ...card, rank: revealedCard.card.rank, suit: revealedCard.card.suit, faceUp: true }
          : card;

        const peekStyle = isRevealedFaceUp ? 'other' : 'self';
        const peekLabel = isRevealedFaceUp ? '👁️ PEEK' : '👁️ PEEK';

        return (
          <motion.div
            key={card.id || idx}
            id={`opp-card-slot-${opponentId}-${card.id}`}
            animate={
              isBlinking
                ? { opacity: [1, 0.15, 1, 0.15, 1], scale: [1, 1.15, 1, 1.15, 1] }
                : {}
            }
            transition={
              isBlinking
                ? { duration: 1.5, times: [0, 0.25, 0.5, 0.75, 1], ease: 'easeInOut' }
                : {}
            }
            className={`transition-all duration-300 transform ${
              isBlinking
                ? 'ring-4 ring-amber-400 rounded-lg shadow-[0_0_30px_rgba(245,158,11,0.9)] z-40'
                : isSelectedOther
                ? '-translate-y-5 scale-110 ring-4 ring-emerald-400 rounded-lg shadow-[0_20px_35px_rgba(52,211,153,0.7)] z-30 animate-bounce'
                : isRevealedFaceUp
                ? '-translate-y-4 scale-105 ring-4 ring-emerald-400 rounded-lg shadow-xl z-20'
                : isClickable
                ? 'hover:scale-110 hover:-translate-y-2 cursor-pointer ring-2 ring-emerald-400/80 rounded-lg shadow-lg animate-pulse'
                : ''
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
          </motion.div>
        );
      }

      // Player's Own Card
      const isSelectedForExchange = selectedOwnExchangeCardId === card.id;
      const isSelectedForSwap = selectedSwapHandCardId === card.id;
      const isRevealingThisCard = revealedCard?.cardId === card.id;
      const isRevealedFaceUp = isRevealingThisCard && !!revealedCard?.card?.faceUp;
      const isOpponentViewingMyCard = isRevealingThisCard && !revealedCard?.card?.faceUp;

      // Sequential reveal for player's own cards
      const mySlotKey = `${myPlayerId}_${idx}`;
      const isMySlotRevealed = revealedSlots.has(mySlotKey);
      const myScoreObj = scores?.find((s) => s.playerId === myPlayerId);
      const finalMyCard = myScoreObj?.cards?.[idx];
      const myCardToRender = (isGameEnding && isMySlotRevealed && finalMyCard)
        ? { ...finalMyCard, faceUp: true }
        : isRevealedFaceUp
        ? { ...card, rank: revealedCard.card.rank, suit: revealedCard.card.suit, faceUp: true }
        : card;

      const myPeekStyle = isOpponentViewingMyCard ? 'being_viewed' : 'self';
      const myPeekLabel = isOpponentViewingMyCard ? '⚠️ BEING VIEWED' : '👁️ PEEK';

      return (
        <motion.div
          key={card.id || idx}
          id={`my-card-slot-${card.id}`}
          animate={
            isBlinking
              ? { opacity: [1, 0.15, 1, 0.15, 1], scale: [1, 1.15, 1, 1.15, 1] }
              : {}
          }
          transition={
            isBlinking
              ? { duration: 1.5, times: [0, 0.25, 0.5, 0.75, 1], ease: 'easeInOut' }
              : {}
          }
          className={`transition-all duration-300 transform ${
            isBlinking
              ? 'ring-4 ring-amber-400 rounded-xl shadow-[0_0_35px_rgba(245,158,11,0.9)] z-40'
              : isSelectedForExchange
              ? '-translate-y-5 scale-110 ring-4 ring-amber-400 rounded-xl shadow-[0_20px_35px_rgba(245,158,11,0.7)] z-30 animate-bounce'
              : isRevealedFaceUp
              ? '-translate-y-4 scale-105 ring-4 ring-amber-400 rounded-xl shadow-xl z-20'
              : isSelectedForSwap
              ? '-translate-y-3 scale-105 ring-4 ring-emerald-400 rounded-xl shadow-xl z-20'
              : 'hover:-translate-y-1.5 cursor-pointer'
          }`}
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
            if (isExchangeActive) {
              if (!selectedOwnExchangeCardId) {
                handleExchangeOwnSelect(card.id);
              } else if (selectedOwnExchangeCardId === card.id) {
                setSelectedOwnExchangeCardId(null);
                setSelectedOtherExchangeCardId(null);
                setSelectedOtherExchangePlayerId(null);
              }
              return;
            }

            // PRIMARY GAMEPLAY ACTION: FAST DISCARD (X-RULE)
            if (hasDiscardCard) {
              handleXReaction(card.id);
            }
          }}
        >
          <Card
            card={myCardToRender}
            size="md"
            index={idx}
            selected={isSelectedForExchange || isSelectedForSwap}
            isPeeking={isRevealingThisCard}
            peekLabel={myPeekLabel}
            peekStyle={myPeekStyle as any}
          />
        </motion.div>
      );
    };

    const renderNewPenaltySlot = () => {
      const nextIdx = cards.length;
      return (
        <motion.div
          id={`my-card-slot-new-${nextIdx}`}
          className="w-[68px] md:w-[76px] h-[98px] md:h-[108px] rounded-xl border-2 border-dashed border-amber-400 bg-amber-500/20 flex flex-col items-center justify-center text-amber-300 text-[10px] font-black cursor-pointer hover:scale-105 hover:bg-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.6)] animate-pulse"
          onClick={() => handlePlacePenaltyAtSlot(nextIdx)}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="text-sm">➕</span>
          <span>PLACE</span>
        </motion.div>
      );
    };

    const showNewSlot = isPenaltyActiveForMe && !hasEmptySlotInHand;

    return (
      <div className="flex flex-col gap-2.5 items-center justify-center">
        {/* Line 1 (Max 6 cards) */}
        <div className="flex gap-2.5 md:gap-3 justify-center items-center flex-wrap">
          {topRow.map((card, i) => renderCardOrEmpty(card, i))}
          {showNewSlot && topRow.length < 6 && renderNewPenaltySlot()}
        </div>

        {/* Line 2 (7th card onwards alone) */}
        {(bottomRow.length > 0 || (showNewSlot && topRow.length >= 6)) && (
          <div className="flex gap-2.5 md:gap-3 justify-center items-center flex-wrap">
            {bottomRow.map((card, i) => renderCardOrEmpty(card, 6 + i))}
            {showNewSlot && topRow.length >= 6 && renderNewPenaltySlot()}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="game-table min-h-dvh flex flex-col justify-between select-none relative overflow-hidden bg-[#131314] text-[#e3e3e3]">

      {/* ── 1.2s Center "EXCHANGED" Pop-up ── */}
      <AnimatePresence>
        {exchangedBanner && (
          <motion.div
            className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.3 }}
          >
            <div className="bg-gradient-to-r from-amber-500 via-emerald-500 to-amber-500 text-slate-950 px-8 py-4 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.8)] border-2 border-white/80 font-black text-xl md:text-2xl tracking-widest flex items-center gap-3">
              <span>👑</span>
              <span>EXCHANGED</span>
              <span>👑</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Floating Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#d96570] text-white px-6 py-2 rounded-full shadow-2xl backdrop-blur text-xs md:text-sm font-bold border border-rose-300/40"
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
      <div className="w-full bg-[#1e1f20]/90 backdrop-blur-md border-b border-white/5 shadow-md relative z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 md:px-8 py-2">
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
      </div>

      {/* ── Opponents Area (Max 6 in Line 1, 7th in Line 2) ── */}
      <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-1.5 flex justify-center gap-4 md:gap-7 flex-wrap relative z-10">
        {gameState?.opponents.map((opponent) => {
          return (
            <motion.div
              key={opponent.playerId}
              className={`glass rounded-2xl p-2.5 md:p-3 text-center transition-all shadow-xl ${
                opponent.isActive ? 'border-[#9b72cb] bg-violet-500/10 shadow-[0_0_25px_rgba(155,114,203,0.3)] ring-1 ring-[#9b72cb]' : 'border-white/5'
              } ${opponent.isEliminated ? 'opacity-30' : ''}`}
              layout
            >
              {/* Opponent Header */}
              <div className="flex items-center justify-center gap-2 mb-1.5 flex-wrap">
                <Avatar avatarId={opponent.avatarId} size={26} />
                <span className="text-xs md:text-sm font-bold text-slate-200 truncate max-w-[110px]">{opponent.name}</span>
                {opponent.isActive && !isGameEnding && (
                  <span className="text-[9px] bg-amber-400/20 text-amber-300 font-bold px-1.5 py-0.5 rounded-full border border-amber-400/30">
                    Turn
                  </span>
                )}
              </div>

              {/* Opponent Hand Grid */}
              <div className="min-h-[76px] md:min-h-[84px] py-1 flex items-center justify-center">
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
      <div className="relative z-10 flex flex-col items-center justify-center my-0.5">
        <AnimatePresence mode="wait">
          {isMyTurn && !isSpecialActive && (
            <motion.div
              key="my-turn"
              className="px-5 py-1 rounded-full bg-gradient-to-r from-amber-500/30 to-amber-600/30 border border-amber-400/50 text-amber-300 font-black text-xs tracking-wider shadow-md"
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
              className="px-4 py-0.5 rounded-full bg-white/5 text-slate-400 text-xs border border-white/5"
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
            className="mt-1.5 px-4 py-1.5 rounded-xl bg-violet-500/20 border border-violet-400/40 text-violet-300 text-xs font-bold text-center shadow-lg"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
          >
            👀 Initial Peek Phase — Tap up to {gameState?.settings.initialViewable} cards to view!
          </motion.div>
        )}

        {/* PANDU Permanent Flickering Last Round Signal */}
        {panduState && (
          <motion.div
            className="mt-1.5 px-5 py-1.5 rounded-2xl bg-rose-600/30 border-2 border-rose-500 text-white font-black text-xs tracking-widest shadow-[0_0_25px_rgba(244,63,94,0.6)] flex items-center gap-2"
            animate={{ opacity: [1, 0.35, 1], scale: [1, 1.03, 1] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <span className="text-amber-400">⚠️</span>
            <span className="bg-gradient-to-r from-amber-300 via-rose-300 to-amber-300 bg-clip-text text-transparent">
              LAST ROUND
            </span>
            <span className="text-amber-400">⚠️</span>
            <span className="text-[10px] text-rose-200 font-bold ml-1 bg-rose-950/80 px-2 py-0.5 rounded-full border border-rose-400/30">
              Called by {panduState.callerName}
            </span>
          </motion.div>
        )}
      </div>

      {/* ── Center Table Area (Decks & Action Zone) ── */}
      <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col items-center justify-center relative z-10 px-4 py-2">
        {/* Draw & Discard Piles */}
        <div className="flex items-center justify-center gap-8 md:gap-14 mb-2">
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
                className="mt-2 px-4 py-1 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black tracking-wider shadow-lg transition-all cursor-pointer"
              >
                🎴 DRAW
              </button>
            )}
          </div>

          {/* Discard Pile */}
          <div ref={discardPileRef} className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 mb-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Discard Pile</p>
              {hasDiscardCard && (
                <span className="text-[9px] bg-rose-500/20 text-rose-300 font-black px-1.5 py-0.2 rounded border border-rose-500/30">
                  ⚡ Fast Discard Target
                </span>
              )}
            </div>
            <div className="relative w-[72px] h-[104px] flex items-center justify-center">
              {gameState?.visibleDiscards && gameState.visibleDiscards.length > 0 ? (
                <>
                  {gameState.visibleDiscards.length > 1 && (
                    <div className="absolute -top-2.5 -left-2.5 z-0 pointer-events-none transform -rotate-6 shadow-md opacity-90">
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
                <div className="w-[70px] h-[100px] rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center text-white/20 text-xs font-bold">
                  Empty
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Swap Discard 3-Second Preview ── */}
        <AnimatePresence>
          {swapDiscardPreview && (
            <motion.div
              className="glass-strong rounded-2xl p-4 flex flex-col items-center gap-2 border-2 border-amber-400 shadow-2xl my-1 max-w-sm w-full"
              initial={{ opacity: 0, scale: 0.8, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
            >
              <span className="text-xs font-black text-amber-300 uppercase tracking-widest animate-pulse">
                🔄 Replaced Card Discarding (3s)
              </span>
              <Card card={swapDiscardPreview} size="md" highlighted />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Wrong X-Reaction 3-Second Reveal ── */}
        <AnimatePresence>
          {xReactionWrong && (
            <motion.div
              className="glass-strong rounded-2xl p-4 flex flex-col items-center gap-2 border-2 border-rose-500 shadow-2xl my-1 max-w-sm w-full"
              initial={{ opacity: 0, scale: 0.8, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
            >
              <span className="text-xs font-black text-rose-400 uppercase tracking-widest animate-pulse">
                ❌ Wrong Card Revealed
              </span>
              <p className="text-xs font-bold text-slate-200 text-center">
                {xReactionWrong.playerName} played mismatched card!
              </p>
              <Card card={xReactionWrong.card} size="md" highlighted />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Interactive Drawn Card & Swap Action Center ── */}
        <AnimatePresence mode="wait">
          {drawnCard && isMyTurn && !swapDiscardPreview && (
            <motion.div
              ref={actionCenterRef}
              className="glass-strong rounded-3xl p-5 flex flex-col items-center gap-3 border-2 border-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.4)] mt-1 max-w-md w-full bg-[#1e1f20]/95"
              initial={{ opacity: 0, scale: 0.85, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 15 }}
            >
              <div className="flex items-center justify-center gap-6 w-full">
                {/* Drawn Card */}
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black text-amber-300 uppercase tracking-widest mb-1">
                    Drawn Card
                  </span>
                  <Card card={drawnCard} size="lg" highlighted />
                </div>

                {/* Arrow indicator if hand card is selected for swap */}
                {selectedSwapCard && (
                  <div className="flex flex-col items-center text-amber-400 font-black text-xl animate-pulse">
                    ⇄
                  </div>
                )}

                {/* Selected Hand Card to Discard */}
                {selectedSwapCard && (
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black text-rose-300 uppercase tracking-widest mb-1">
                      To Discard
                    </span>
                    <Card card={selectedSwapCard} size="lg" selected />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 w-full justify-center mt-1">
                {selectedSwapCard ? (
                  <button
                    onClick={handleConfirmSwap}
                    className="flex-1 py-3 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 text-xs md:text-sm font-black tracking-wider shadow-xl shadow-emerald-500/40 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    🔄 CONFIRM SWAP & DISCARD
                  </button>
                ) : (
                  <button
                    onClick={handleDiscardDrawn}
                    className="flex-1 py-3 px-5 rounded-2xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white text-xs md:text-sm font-black tracking-wider shadow-xl shadow-rose-500/40 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    🗑️ DISCARD DRAWN CARD
                  </button>
                )}
              </div>

              <p className="text-xs text-amber-200 font-bold text-center">
                {selectedSwapCard
                  ? 'Click CONFIRM to place Drawn Card in hand and preview replaced card!'
                  : '👉 Tap any card in your hand below to swap with drawn card!'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Floating Penalty Card (No Modal Popup — Just floats right above hand) ── */}
        <AnimatePresence>
          {penaltyPrompt && (
            <motion.div
              ref={floatingPenaltyRef}
              className="glass-strong rounded-2xl p-3 flex flex-col items-center gap-2 border-2 border-rose-500 shadow-[0_0_35px_rgba(244,63,94,0.5)] my-1 max-w-xs w-full bg-[#1e1f20]/95"
              initial={{ opacity: 0, scale: 0.8, y: -15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 15 }}
            >
              <span className="text-[11px] font-black text-rose-400 uppercase tracking-wider animate-pulse">
                ⚠️ Penalty Card Dealt
              </span>
              <div className="transform animate-bounce shadow-xl">
                <Card card={{ id: penaltyPrompt.cardId || 'penalty', faceUp: false }} size="md" highlighted />
              </div>
              <p className="text-[11px] text-amber-200 font-bold text-center">
                👇 Click any glowing slot below to place penalty card
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Special Action Prompts & Queen Exchange Confirmation ── */}
        <AnimatePresence>
          {specialAction && (
            <motion.div
              className="glass-strong rounded-2xl p-4 text-center max-w-md w-full my-1 border-2 border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.3)] bg-[#1e1f20]/95"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <p className="text-amber-300 font-black text-sm md:text-base mb-1.5">
                ⚡ SPECIAL POWER TRIGGERED
              </p>

              {/* 7/8 Self Peek Prompt */}
              {isSelfPeekActive && (
                <p className="text-xs md:text-sm text-slate-100 font-bold">
                  👀 Tap one of your own hand cards below to peek at it!
                </p>
              )}

              {/* 9/10 Other Peek Prompt */}
              {isOtherPeekActive && (
                <p className="text-xs md:text-sm text-slate-100 font-bold">
                  👀 Tap ANY opponent's card above to view it!
                </p>
              )}

              {/* Queen Exchange Step 1: Select Own */}
              {isExchangeActive && !selectedOwnExchangeCardId && specialAction.phase !== SpecialActionPhase.COMPLETE && (
                <p className="text-xs md:text-sm text-amber-300 font-black animate-pulse">
                  👑 Step 1: Tap one of YOUR cards below to float it.
                </p>
              )}

              {/* Queen Exchange Step 2: Select Other */}
              {isExchangeActive && selectedOwnExchangeCardId && !selectedOtherExchangeCardId && specialAction.phase !== SpecialActionPhase.COMPLETE && (
                <p className="text-xs md:text-sm text-emerald-300 font-black animate-pulse">
                  👑 Step 2: Now tap an OPPONENT'S card above to select it!
                </p>
              )}

              {/* Queen Exchange Step 3: Small Confirmation Box */}
              {isExchangeActive && selectedOwnExchangeCardId && selectedOtherExchangeCardId && specialAction.phase !== SpecialActionPhase.COMPLETE && (
                <div className="flex flex-col items-center gap-2 mt-1">
                  <p className="text-xs md:text-sm text-amber-200 font-black">
                    👑 Confirm exchange between the two floating cards?
                  </p>
                  <div className="flex gap-3 w-full justify-center mt-1">
                    <button
                      onClick={handleConfirmQueenExchange}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg transition-all cursor-pointer"
                    >
                      ✓ CONFIRM EXCHANGE
                    </button>
                    <button
                      onClick={handleCancelQueenSelection}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-black text-xs shadow-lg transition-all cursor-pointer"
                    >
                      ✕ NO (CANCEL)
                    </button>
                  </div>
                </div>
              )}

              {isExchangeActive && specialAction.phase === SpecialActionPhase.COMPLETE && (
                <p className="text-xs md:text-sm text-emerald-300 font-extrabold">
                  👑 Exchange complete! Click CONTINUE to end turn.
                </p>
              )}

              {/* Action Buttons (Skip / Continue) */}
              <div className="flex gap-2.5 justify-center mt-3 flex-wrap">
                {specialAction.phase === SpecialActionPhase.COMPLETE ? (
                  <button
                    className="btn-primary text-xs md:text-sm py-2.5 px-6 font-black tracking-wider cursor-pointer shadow-xl rounded-xl"
                    onClick={handleAcknowledgeSpecial}
                  >
                    ✓ CONTINUE
                  </button>
                ) : (!selectedOwnExchangeCardId || !selectedOtherExchangeCardId) && (
                  <button
                    className="py-2.5 px-5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-slate-200 hover:text-white text-xs font-bold transition-all cursor-pointer"
                    onClick={handleSkipSpecial}
                  >
                    ⏭️ SKIP POWER & END TURN
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Player's Hand (Max 6 in Line 1, 7th alone in Line 2) ── */}
      <div ref={myHandRef} className="w-full max-w-5xl mx-auto px-4 pb-12 md:pb-14 pt-1.5 relative z-10">
        <div className="flex items-center justify-center gap-2 mb-1.5 flex-wrap">
          <p className="text-center text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            {gameState?.settings.mode === GameMode.TEAM ? '🤝 Team Hand' : 'Your Hand'} ({gameState?.myHand.filter(Boolean).length || 0} Cards)
          </p>
          {hasDiscardCard && !showCardDecision && !isSpecialActive && !isInitialView && !penaltyPrompt && !isGameEnding && (
            <span className="text-[9px] md:text-[10px] text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              ⚡ Tap card to Fast Discard
            </span>
          )}
        </div>

        {gameState?.myHand && gameState.myHand.length > 0 ? (
          renderHandGrid(gameState.myHand)
        ) : (
          <p className="text-slate-500 text-xs py-4 text-center italic">No cards remaining</p>
        )}
      </div>
    </div>
  );
}

// ── Clean Final Standings Screen (Name, Rank with 👑 Crown for #1, and Score) ──

function ScoreScreen({ scores, roomId }: { scores: any[]; roomId: string }) {
  const router = useRouter();
  const sorted = [...scores].sort((a, b) => a.rank - b.rank);

  return (
    <div className="min-h-dvh flex flex-col justify-between items-center p-4 sm:p-6 md:p-8 bg-[#0c0e17] text-slate-100 relative overflow-hidden select-none">
      {/* Ambient background glows */}
      <div className="absolute inset-0 bg-radial from-[#151726]/60 via-[#0c0e17]/85 to-[#07080f] opacity-95 pointer-events-none z-0" />
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[550px] h-[350px] rounded-full bg-amber-500/10 blur-[150px] pointer-events-none z-0" />

      <div className="relative z-10 w-full max-w-xl mx-auto flex flex-col flex-1 pb-24 justify-center">
        {/* Header */}
        <header className="text-center my-4 md:my-6">
          <span className="text-5xl block mb-2 animate-bounce">👑</span>
          <h1 className="font-display text-3xl sm:text-4xl font-black bg-gradient-to-r from-amber-300 via-yellow-100 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_2px_15px_rgba(245,158,11,0.5)]">
            FINAL STANDINGS
          </h1>
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mt-1">
            Official Match Rankings & Scores
          </p>
        </header>

        {/* ── Standings List (Name, Rank with 👑 Crown for 1st, and Score) ── */}
        <div className="flex flex-col gap-3.5 w-full my-4">
          {sorted.map((s, i) => {
            const isWinner = i === 0;

            return (
              <motion.div
                key={s.playerId || i}
                className={`flex items-center justify-between p-4 sm:p-5 rounded-3xl border transition-all ${
                  isWinner
                    ? 'border-2 border-amber-400 bg-gradient-to-r from-amber-500/20 via-[#1c1811]/95 to-amber-500/20 shadow-[0_0_35px_rgba(245,158,11,0.4)]'
                    : i === 1
                    ? 'border-2 border-slate-300/60 bg-[#141724]/90 shadow-md'
                    : i === 2
                    ? 'border-2 border-amber-700/60 bg-[#141724]/90'
                    : 'border border-white/10 bg-[#101322]/85'
                }`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                {/* Left: Rank & Avatar & Name */}
                <div className="flex items-center gap-3.5 sm:gap-4">
                  {isWinner ? (
                    <div className="flex flex-col items-center justify-center min-w-[40px]">
                      <span className="text-2xl animate-pulse">👑</span>
                      <span className="text-[10px] font-black text-amber-300 uppercase tracking-wider">#1</span>
                    </div>
                  ) : (
                    <span className="text-base font-black font-mono text-slate-400 min-w-[40px] text-center">
                      #{s.rank || i + 1}
                    </span>
                  )}

                  <Avatar avatarId={s.avatarId} size={44} />

                  <div>
                    <h3 className={`font-black text-base sm:text-lg ${isWinner ? 'text-amber-300' : 'text-white'}`}>
                      {s.playerName}
                    </h3>
                    {s.teamName && (
                      <span className="text-[11px] font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full mt-0.5 inline-block">
                        {s.teamName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Score */}
                <div className="flex items-center gap-2">
                  <span className={`text-base sm:text-lg font-black font-mono px-4 py-1.5 rounded-2xl border ${
                    isWinner
                      ? 'bg-amber-400/25 text-amber-300 border-amber-400/50 shadow-inner'
                      : 'bg-white/5 text-slate-200 border-white/10'
                  }`}>
                    {s.score} pts
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── Fixed Bottom Return to Lobby Action ── */}
      <footer className="fixed bottom-6 left-0 right-0 px-4 z-30 pointer-events-auto">
        <div className="max-w-md mx-auto w-full bg-[#101322]/95 backdrop-blur-2xl p-2.5 rounded-3xl border-2 border-purple-500/30 shadow-[0_10px_40px_rgba(0,0,0,0.8)]">
          <button
            onClick={() => {
              soundEngine.playCardFlip();
              router.push(`/room/${roomId}`);
            }}
            className="btn-primary w-full py-4 rounded-2xl text-sm sm:text-base font-black tracking-wider uppercase cursor-pointer shadow-xl"
          >
            🔄 RETURN TO LOBBY
          </button>
        </div>
      </footer>
    </div>
  );
}
