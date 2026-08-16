// ============================================================
// PANDU — Website QR Code with Central Pandu Card Badge
// ============================================================

'use client';

import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { motion } from 'motion/react';
import { soundEngine } from '@/lib/audio';

export function QRCodeShare() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [siteUrl, setSiteUrl] = useState('https://pandu-gray.vercel.app');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = window.location.origin || 'https://pandu-gray.vercel.app';
      setSiteUrl(url);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Generate high-resolution QR code
    QRCode.toCanvas(
      canvas,
      siteUrl,
      {
        width: 260,
        margin: 2,
        color: {
          dark: '#1e1f2b',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H', // High error correction so center card badge doesn't break scanner
      },
      (error) => {
        if (error) {
          console.error('[QR GEN ERR]', error);
          return;
        }

        // Draw central Pandu Card Badge over QR code
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const cardW = 54;
        const cardH = 74;

        // Card Outer White Border Margin
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(centerX - cardW / 2 - 4, centerY - cardH / 2 - 4, cardW + 8, cardH + 8, 10);
        ctx.fill();

        // Card Body with Gemini gradient border
        const gradient = ctx.createLinearGradient(centerX - cardW / 2, centerY - cardH / 2, centerX + cardW / 2, centerY + cardH / 2);
        gradient.addColorStop(0, '#4285f4');
        gradient.addColorStop(0.5, '#9b72cb');
        gradient.addColorStop(1, '#d96570');
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
  }, [siteUrl]);

  const handleCopyLink = () => {
    soundEngine.playCardFlip();
    navigator.clipboard.writeText(siteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    soundEngine.playCardFlip();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'pandu-game-qr.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="flex flex-col items-center gap-3.5 p-4 rounded-2xl bg-[#131314] border border-white/10 text-center">
      <div className="flex items-center gap-1.5 text-xs font-bold text-[#c4c7c5]">
        <span className="text-[#9b72cb]">✦</span>
        <span>Scan QR to Play Anywhere</span>
        <span className="text-[#9b72cb]">✦</span>
      </div>

      {/* QR Canvas Container with Glow */}
      <motion.div
        className="relative p-2.5 rounded-2xl bg-white shadow-xl shadow-purple-500/20 border-2 border-violet-400/40 flex items-center justify-center"
        whileHover={{ scale: 1.03 }}
        transition={{ type: 'spring', stiffness: 300 }}
      >
        <canvas ref={canvasRef} className="rounded-xl" />
      </motion.div>

      <p className="text-[11px] text-[#8e918f] max-w-[240px]">
        Friends can scan this QR with their phone camera to instantly jump into the game!
      </p>

      {/* Action Buttons */}
      <div className="flex gap-2 w-full justify-center">
        <button
          className={`flex-1 py-2.5 px-3 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md ${
            copied
              ? 'bg-[#1aa260] text-white'
              : 'bg-[#1e1f20] hover:bg-[#282a2c] text-[#e3e3e3] border border-white/10'
          }`}
          onClick={handleCopyLink}
        >
          {copied ? '✓ Copied!' : '📋 Copy Link'}
        </button>

        <button
          className="flex-1 py-2.5 px-3 rounded-full text-xs font-bold bg-[#1e1f20] hover:bg-[#282a2c] text-[#e3e3e3] border border-white/10 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
          onClick={handleDownloadQR}
        >
          📥 Download QR
        </button>
      </div>
    </div>
  );
}

export default QRCodeShare;
