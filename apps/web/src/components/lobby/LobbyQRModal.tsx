// ============================================================
// PANDU — Dynamic Lobby Room QR Code Share Modal
// ============================================================

'use client';

import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { motion } from 'motion/react';
import { soundEngine } from '@/lib/audio';

interface LobbyQRModalProps {
  roomCode: string;
  onClose: () => void;
}

export function LobbyQRModal({ roomCode, onClose }: LobbyQRModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [roomUrl, setRoomUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/room/${roomCode}`;
      setRoomUrl(url);
    }
  }, [roomCode]);

  useEffect(() => {
    if (!roomUrl) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    QRCode.toCanvas(
      canvas,
      roomUrl,
      {
        width: 260,
        margin: 2,
        color: {
          dark: '#1e1f2b',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      },
      (error) => {
        if (error) {
          console.error('[LOBBY QR ERR]', error);
          return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const cardW = 56;
        const cardH = 76;

        // Card Outer White Border
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(centerX - cardW / 2 - 4, centerY - cardH / 2 - 4, cardW + 8, cardH + 8, 10);
        ctx.fill();

        // Card Body with gradient
        const gradient = ctx.createLinearGradient(centerX - cardW / 2, centerY - cardH / 2, centerX + cardW / 2, centerY + cardH / 2);
        gradient.addColorStop(0, '#c084fc');
        gradient.addColorStop(0.5, '#7c3aed');
        gradient.addColorStop(1, '#ec4899');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(centerX - cardW / 2, centerY - cardH / 2, cardW, cardH, 8);
        ctx.fill();

        // Card Inner Dark Body
        ctx.fillStyle = '#131314';
        ctx.beginPath();
        ctx.roundRect(centerX - cardW / 2 + 2, centerY - cardH / 2 + 2, cardW - 4, cardH - 4, 6);
        ctx.fill();

        // Crown Icon
        ctx.font = '22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👑', centerX, centerY - 10);

        // PANDU Text
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText('PANDU', centerX, centerY + 14);
      }
    );
  }, [roomUrl]);

  const handleCopyLink = () => {
    soundEngine.playCardFlip();
    navigator.clipboard.writeText(roomUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    soundEngine.playCardFlip();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `pandu-room-${roomCode}-qr.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <motion.div
      className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 select-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="glass-strong rounded-3xl p-6 max-w-xs w-full border border-purple-500/30 shadow-2xl text-center space-y-4"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="text-left">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Scan to Join Room
            </span>
            <span className="text-xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-[#d8b4fe] via-[#f3e8ff] to-[#c084fc] tracking-widest">
              {roomCode}
            </span>
          </div>
          <button
            className="text-slate-400 hover:text-white text-lg p-1 cursor-pointer"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* QR Code Canvas */}
        <div className="flex justify-center">
          <motion.div
            className="relative p-2.5 rounded-2xl bg-white shadow-xl shadow-purple-500/20 border-2 border-purple-400/50"
            whileHover={{ scale: 1.02 }}
          >
            <canvas ref={canvasRef} className="rounded-xl" />
          </motion.div>
        </div>

        <p className="text-xs text-slate-300 font-medium">
          Scan with any mobile camera to instantly connect to room <strong className="text-purple-300">{roomCode}</strong>!
        </p>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            className={`flex-1 py-3 px-3 rounded-full text-xs font-black tracking-wide uppercase transition-all cursor-pointer shadow-md ${
              copied
                ? 'bg-[#1aa260] text-white'
                : 'bg-gradient-to-r from-[#7c3aed] to-[#c084fc] text-white hover:brightness-110'
            }`}
            onClick={handleCopyLink}
          >
            {copied ? '✓ Copied!' : '📋 Copy Link'}
          </button>

          <button
            className="py-3 px-4 rounded-full text-xs font-bold bg-[#1e1f20] hover:bg-[#282a2c] text-slate-200 border border-white/15 transition-all cursor-pointer"
            onClick={handleDownloadQR}
            title="Download QR Code"
          >
            📥
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default LobbyQRModal;
