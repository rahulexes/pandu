// ============================================================
// PANDU — Luxury Casino Grade Vector Deck Generator
// ============================================================
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const WIDTH = 512;
const HEIGHT = 740;

const SUIT_COLORS = {
  hearts: '#d9272e',
  diamonds: '#d9272e',
  clubs: '#18181b',
  spades: '#18181b',
};

// Precise SVG suit icons
function getSuitSvg(suit, size, color) {
  if (suit === 'hearts') {
    return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="${color}">
      <path d="M 50,92 C 46,88 10,55 10,32 C 10,16 25,8 39,8 C 45.5,8 49.5,12 50,16 C 50.5,12 54.5,8 61,8 C 75,8 90,16 90,32 C 90,55 54,88 50,92 Z" />
    </svg>`;
  }
  if (suit === 'diamonds') {
    return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="${color}">
      <path d="M 50,6 L 90,50 L 50,94 L 10,50 Z" />
    </svg>`;
  }
  if (suit === 'clubs') {
    return `<svg width="${size}" height="${size}" viewBox="0 0 100 108" fill="${color}">
      <path d="M 50,10 C 39,10 32,18 32,28 C 32,35 36,41 42,44 C 33,41 19,47 16,59 C 12,71 22,84 36,82 C 41,81 45,78 47,74 C 45,84 39,96 30,102 L 70,102 C 61,96 55,84 53,74 C 55,78 59,81 64,82 C 78,84 88,71 84,59 C 81,47 67,41 58,44 C 64,41 68,35 68,28 C 68,18 61,10 50,10 Z" />
    </svg>`;
  }
  if (suit === 'spades') {
    return `<svg width="${size}" height="${size}" viewBox="0 0 100 108" fill="${color}">
      <path d="M 50,8 C 45,26 14,45 14,66 C 14,82 28,91 43,83 C 44.5,82 45.5,81 47,79 C 45,88 39,98 30,103 L 70,103 C 61,98 55,88 53,79 C 54.5,81 55.5,82 57,83 C 72,91 86,82 86,66 C 86,45 55,26 50,8 Z" />
    </svg>`;
  }
  return '';
}

// Generate pip SVG placement
function getPipSvg(suit, x, y, size, color, inverted = false) {
  const transform = inverted
    ? `translate(${x + size / 2}, ${y + size / 2}) rotate(180)`
    : `translate(${x - size / 2}, ${y - size / 2})`;
  return `<g transform="${transform}">
    ${getSuitSvg(suit, size, color)}
  </g>`;
}

// Generate Luxury Symmetrical Court Illustrations (Traditional French Heritage Style)
function getCourtIllustrationSvg(rank, suit, color) {
  const isRed = suit === 'hearts' || suit === 'diamonds';
  const robePrimary = isRed ? '#d9272e' : '#1d4ed8';
  const robeSecondary = isRed ? '#1e40af' : '#475569';
  const gold = '#d97706';
  const goldLight = '#fbbf24';
  const skin = '#fed7aa';
  const hair = isRed ? '#92400e' : '#0f172a';

  let figure = '';

  if (rank === 'K') {
    // Majestic King of Court
    figure = `
      <g>
        <g id="king-half">
          <!-- Background tapestry -->
          <rect x="0" y="0" width="316" height="230" fill="#fafafa" />
          
          <!-- Outer Royal Mantle -->
          <path d="M 18,230 C 18,150 60,110 120,105 L 196,105 C 256,110 298,150 298,230 Z" fill="${robePrimary}" />
          <!-- Mantle ermine collar -->
          <path d="M 70,108 C 110,130 206,130 246,108 L 225,230 L 91,230 Z" fill="${robeSecondary}" />
          <path d="M 115,115 L 158,230 L 201,115 Z" fill="#ffffff" />
          <path d="M 148,115 L 158,230 L 168,115 Z" fill="${gold}" />

          <!-- Ermine dots -->
          <circle cx="130" cy="160" r="3" fill="#0f172a" />
          <circle cx="186" cy="160" r="3" fill="#0f172a" />
          <circle cx="140" cy="195" r="3" fill="#0f172a" />
          <circle cx="176" cy="195" r="3" fill="#0f172a" />

          <!-- Flowing Royal Hair & Beard -->
          <path d="M 112,85 C 108,135 125,155 158,155 C 191,155 208,135 204,85 Z" fill="${hair}" />

          <!-- King Face -->
          <ellipse cx="158" cy="90" rx="30" ry="32" fill="${skin}" />
          <!-- Mustache -->
          <path d="M 138,105 Q 158,115 178,105 Q 186,116 174,118 Q 158,112 142,118 Q 130,116 138,105 Z" fill="${hair}" />
          <!-- Eyes & Eyebrows -->
          <circle cx="146" cy="88" r="2.8" fill="#0f172a" />
          <circle cx="170" cy="88" r="2.8" fill="#0f172a" />
          <path d="M 140,82 Q 146,78 152,82" stroke="${hair}" stroke-width="2.5" fill="none" stroke-linecap="round" />
          <path d="M 164,82 Q 170,78 176,82" stroke="${hair}" stroke-width="2.5" fill="none" stroke-linecap="round" />

          <!-- Ornate Crown -->
          <path d="M 124,68 L 130,42 L 144,54 L 158,35 L 172,54 L 186,42 L 192,68 Z" fill="${gold}" stroke="#92400e" stroke-width="2" />
          <circle cx="158" cy="35" r="4.5" fill="${goldLight}" />
          <circle cx="130" cy="42" r="3.5" fill="${isRed ? '#dc2626' : '#2563eb'}" />
          <circle cx="186" cy="42" r="3.5" fill="${isRed ? '#dc2626' : '#2563eb'}" />
          <rect x="124" y="65" width="68" height="6" fill="${goldLight}" rx="1" />

          <!-- Sword of Justice -->
          <rect x="42" y="90" width="10" height="135" fill="#94a3b8" rx="2" stroke="#64748b" stroke-width="1.5" />
          <polygon points="40,90 54,90 47,72" fill="#cbd5e1" stroke="#64748b" stroke-width="1.5" />
          <rect x="30" y="125" width="34" height="8" fill="${gold}" rx="2" stroke="#92400e" stroke-width="1" />
          <circle cx="47" cy="225" r="6" fill="${gold}" />

          <!-- Suit Crest Badge on Chest -->
          <g transform="translate(230, 130)">
            <circle cx="20" cy="20" r="24" fill="#ffffff" stroke="${gold}" stroke-width="2" />
            <g transform="translate(4, 4)">
              ${getSuitSvg(suit, 32, color)}
            </g>
          </g>
        </g>

        <!-- Ornate Center Gold Divider -->
        <line x1="0" y1="230" x2="316" y2="230" stroke="${gold}" stroke-width="3" />
        <circle cx="158" cy="230" r="8" fill="${goldLight}" stroke="${gold}" stroke-width="2" />

        <!-- Symmetrical Rotated Inverted Bottom Half -->
        <use href="#king-half" transform="rotate(180 158 230)" />
      </g>
    `;
  } else if (rank === 'Q') {
    // Elegant Queen of Court
    figure = `
      <g>
        <g id="queen-half">
          <rect x="0" y="0" width="316" height="230" fill="#fafafa" />

          <!-- Queen Gown / Mantle -->
          <path d="M 22,230 C 22,150 65,115 120,110 L 196,110 C 251,115 294,150 294,230 Z" fill="${robeSecondary}" />
          <!-- Corset & Bodice -->
          <path d="M 85,115 Q 158,160 231,115 L 205,230 L 111,230 Z" fill="${robePrimary}" />
          <path d="M 142,118 L 158,230 L 174,118 Z" fill="${gold}" />

          <!-- Flowing Royal Locks -->
          <path d="M 115,85 C 100,125 105,175 115,195 C 122,175 120,135 125,100 Z" fill="${hair}" />
          <path d="M 201,85 C 216,125 211,175 201,195 C 194,175 196,135 191,100 Z" fill="${hair}" />

          <!-- Queen Face -->
          <ellipse cx="158" cy="92" rx="27" ry="29" fill="${skin}" />
          <!-- Eyes & Red Lips -->
          <circle cx="147" cy="90" r="2.5" fill="#0f172a" />
          <circle cx="169" cy="90" r="2.5" fill="#0f172a" />
          <path d="M 142,84 Q 147,80 152,84" stroke="${hair}" stroke-width="2" fill="none" />
          <path d="M 164,84 Q 169,80 174,84" stroke="${hair}" stroke-width="2" fill="none" />
          <path d="M 152,104 Q 158,108 164,104" stroke="#dc2626" stroke-width="3" fill="none" stroke-linecap="round" />

          <!-- Queen Tiara / Crown -->
          <path d="M 132,68 L 138,48 L 148,58 L 158,42 L 168,58 L 178,48 L 184,68 Z" fill="${gold}" stroke="#92400e" stroke-width="1.5" />
          <circle cx="158" cy="42" r="3.5" fill="${goldLight}" />
          <circle cx="138" cy="48" r="2.5" fill="#dc2626" />
          <circle cx="178" cy="48" r="2.5" fill="#dc2626" />
          <rect x="132" y="66" width="52" height="4" fill="${goldLight}" rx="1" />

          <!-- Queen Holding a Rose -->
          <path d="M 52,225 Q 56,170 65,145" stroke="#16a34a" stroke-width="4" fill="none" stroke-linecap="round" />
          <circle cx="68" cy="140" r="12" fill="#dc2626" />
          <circle cx="68" cy="140" r="7" fill="#ef4444" />
          <circle cx="68" cy="140" r="3" fill="#fca5a5" />
          <path d="M 58,165 Q 46,160 50,154" stroke="#16a34a" stroke-width="3.5" fill="none" />

          <!-- Suit Crest Badge -->
          <g transform="translate(230, 130)">
            <circle cx="20" cy="20" r="24" fill="#ffffff" stroke="${gold}" stroke-width="2" />
            <g transform="translate(4, 4)">
              ${getSuitSvg(suit, 32, color)}
            </g>
          </g>
        </g>

        <line x1="0" y1="230" x2="316" y2="230" stroke="${gold}" stroke-width="3" />
        <circle cx="158" cy="230" r="8" fill="${goldLight}" stroke="${gold}" stroke-width="2" />

        <use href="#queen-half" transform="rotate(180 158 230)" />
      </g>
    `;
  } else if (rank === 'J') {
    // Valiant Jack / Knight
    figure = `
      <g>
        <g id="jack-half">
          <rect x="0" y="0" width="316" height="230" fill="#fafafa" />

          <!-- Knight Armor & Tunic -->
          <path d="M 22,230 C 22,150 65,115 120,110 L 196,110 C 251,115 294,150 294,230 Z" fill="${robePrimary}" />
          <!-- Diagonal Knight Sash -->
          <polygon points="75,115 110,112 245,230 210,230" fill="${robeSecondary}" />
          <polygon points="90,114 100,113 235,230 225,230" fill="${gold}" />

          <!-- Renaissance Hair -->
          <path d="M 115,85 C 110,125 120,145 130,150" stroke="${hair}" stroke-width="8" stroke-linecap="round" fill="none" />
          <path d="M 201,85 C 206,125 196,145 186,150" stroke="${hair}" stroke-width="8" stroke-linecap="round" fill="none" />

          <!-- Face -->
          <ellipse cx="158" cy="92" rx="28" ry="30" fill="${skin}" />
          <!-- Eyes & Clean Mustache -->
          <circle cx="147" cy="90" r="2.5" fill="#0f172a" />
          <circle cx="169" cy="90" r="2.5" fill="#0f172a" />
          <path d="M 142,84 Q 147,80 152,84" stroke="${hair}" stroke-width="2" fill="none" />
          <path d="M 164,84 Q 169,80 174,84" stroke="${hair}" stroke-width="2" fill="none" />
          <path d="M 148,103 Q 158,108 168,103" stroke="${hair}" stroke-width="2.5" fill="none" stroke-linecap="round" />

          <!-- Renaissance Feathered Beret Cap -->
          <path d="M 125,72 C 125,48 191,48 191,72 Z" fill="${robeSecondary}" stroke="${gold}" stroke-width="2" />
          <!-- Plume / Feather -->
          <path d="M 180,60 Q 220,30 235,15 Q 210,42 170,55" fill="${goldLight}" stroke="${gold}" stroke-width="1.5" />

          <!-- Knight Halberd / Axe -->
          <rect x="42" y="55" width="8" height="175" fill="#64748b" rx="1" />
          <path d="M 42,70 C 20,70 15,85 10,105 C 28,100 42,90 42,90 Z" fill="#94a3b8" stroke="#475569" stroke-width="1.5" />
          <polygon points="42,55 50,55 46,30" fill="#cbd5e1" stroke="#475569" stroke-width="1.5" />

          <!-- Knight Shield with Suit -->
          <g transform="translate(225, 120)">
            <path d="M 0,0 L 50,0 C 50,35 35,55 25,65 C 15,55 0,35 0,0 Z" fill="#1e293b" stroke="${gold}" stroke-width="2.5" />
            <g transform="translate(9, 10)">
              ${getSuitSvg(suit, 32, '#ffffff')}
            </g>
          </g>
        </g>

        <line x1="0" y1="230" x2="316" y2="230" stroke="${gold}" stroke-width="3" />
        <circle cx="158" cy="230" r="8" fill="${goldLight}" stroke="${gold}" stroke-width="2" />

        <use href="#jack-half" transform="rotate(180 158 230)" />
      </g>
    `;
  }

  return `
    <g transform="translate(98, 140)">
      <!-- Frame Border for Court Card -->
      <rect x="0" y="0" width="316" height="460" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="2.5" />
      <rect x="4" y="4" width="308" height="452" rx="6" fill="none" stroke="${gold}" stroke-width="1.5" stroke-opacity="0.6" />
      ${figure}
    </g>
  `;
}

// Generate Full Card SVG
function generateCardSvg(rank, suit) {
  const isRed = suit === 'hearts' || suit === 'diamonds';
  const color = SUIT_COLORS[suit] || '#18181b';

  if (suit === 'joker' || rank === 'JOKER') {
    return `
      <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="100%" stop-color="#fdf4ff"/>
          </linearGradient>
          <linearGradient id="jokerGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fbbf24"/>
            <stop offset="100%" stop-color="#d97706"/>
          </linearGradient>
          <linearGradient id="jokerPurple" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#a855f7"/>
            <stop offset="100%" stop-color="#6b21a8"/>
          </linearGradient>
        </defs>

        <!-- Card Body -->
        <rect x="2" y="2" width="${WIDTH - 4}" height="${HEIGHT - 4}" rx="28" fill="url(#bg)" stroke="#e2e8f0" stroke-width="2"/>
        <rect x="14" y="14" width="${WIDTH - 28}" height="${HEIGHT - 28}" rx="20" fill="none" stroke="#e9d5ff" stroke-width="1.5" stroke-dasharray="6,4"/>

        <!-- Top Left JOKER text -->
        <g transform="translate(36, 45)">
          <text x="0" y="0" font-family="'Trebuchet MS', 'Arial Black', sans-serif" font-weight="900" font-size="22" fill="#7e22ce" text-anchor="middle">J</text>
          <text x="0" y="22" font-family="'Trebuchet MS', 'Arial Black', sans-serif" font-weight="900" font-size="22" fill="#7e22ce" text-anchor="middle">O</text>
          <text x="0" y="44" font-family="'Trebuchet MS', 'Arial Black', sans-serif" font-weight="900" font-size="22" fill="#7e22ce" text-anchor="middle">K</text>
          <text x="0" y="66" font-family="'Trebuchet MS', 'Arial Black', sans-serif" font-weight="900" font-size="22" fill="#7e22ce" text-anchor="middle">E</text>
          <text x="0" y="88" font-family="'Trebuchet MS', 'Arial Black', sans-serif" font-weight="900" font-size="22" fill="#7e22ce" text-anchor="middle">R</text>
          <text x="0" y="116" font-size="22" fill="#d97706" text-anchor="middle">★</text>
        </g>

        <!-- Bottom Right JOKER text (Rotated 180) -->
        <g transform="rotate(180 ${WIDTH / 2} ${HEIGHT / 2}) translate(36, 45)">
          <text x="0" y="0" font-family="'Trebuchet MS', 'Arial Black', sans-serif" font-weight="900" font-size="22" fill="#7e22ce" text-anchor="middle">J</text>
          <text x="0" y="22" font-family="'Trebuchet MS', 'Arial Black', sans-serif" font-weight="900" font-size="22" fill="#7e22ce" text-anchor="middle">O</text>
          <text x="0" y="44" font-family="'Trebuchet MS', 'Arial Black', sans-serif" font-weight="900" font-size="22" fill="#7e22ce" text-anchor="middle">K</text>
          <text x="0" y="66" font-family="'Trebuchet MS', 'Arial Black', sans-serif" font-weight="900" font-size="22" fill="#7e22ce" text-anchor="middle">E</text>
          <text x="0" y="88" font-family="'Trebuchet MS', 'Arial Black', sans-serif" font-weight="900" font-size="22" fill="#7e22ce" text-anchor="middle">R</text>
          <text x="0" y="116" font-size="22" fill="#d97706" text-anchor="middle">★</text>
        </g>

        <!-- Center Joker Emblem -->
        <g transform="translate(256, 370)">
          <!-- Luxury Medallion -->
          <circle cx="0" cy="0" r="145" fill="#fdf4ff" stroke="#c084fc" stroke-width="3"/>
          <circle cx="0" cy="0" r="130" fill="none" stroke="#fbbf24" stroke-width="2" stroke-dasharray="8,5"/>
          
          <!-- Jester Hat -->
          <path d="M -75,-25 C -105,-85 -55,-115 -42,-105 C -30,-60 -10,-30 0,-30 C 10,-30 30,-60 42,-105 C 55,-115 105,-85 75,-25 Z" fill="url(#jokerPurple)" stroke="#581c87" stroke-width="2" />
          <circle cx="-42" cy="-105" r="9" fill="url(#jokerGold)" stroke="#92400e" stroke-width="1.5" />
          <circle cx="0" cy="-115" r="10" fill="url(#jokerGold)" stroke="#92400e" stroke-width="1.5" />
          <circle cx="42" cy="-105" r="9" fill="url(#jokerGold)" stroke="#92400e" stroke-width="1.5" />

          <!-- Face -->
          <circle cx="0" cy="18" r="46" fill="#fed7aa" stroke="#f59e0b" stroke-width="2"/>
          <!-- Mask -->
          <path d="M -34,8 Q -17,-4 0,8 Q 17,-4 34,8 Q 17,20 0,12 Q -17,20 -34,8 Z" fill="#1e293b"/>
          <circle cx="-16" cy="8" r="3.5" fill="#ffffff"/>
          <circle cx="16" cy="8" r="3.5" fill="#ffffff"/>
          <!-- Grin -->
          <path d="M -26,30 Q 0,56 26,30 Q 0,40 -26,30 Z" fill="#dc2626"/>

          <!-- Collar -->
          <path d="M -65,65 L -42,45 L -20,65 L 0,45 L 20,65 L 42,45 L 65,65 L 0,92 Z" fill="url(#jokerGold)" stroke="#92400e" stroke-width="2"/>
          <circle cx="-42" cy="65" r="5" fill="#9333ea"/>
          <circle cx="0" cy="65" r="5" fill="#9333ea"/>
          <circle cx="42" cy="65" r="5" fill="#9333ea"/>

          <!-- Label -->
          <text x="0" y="175" font-family="'Trebuchet MS', 'Arial Black', sans-serif" font-weight="900" font-size="30" fill="#7e22ce" text-anchor="middle" letter-spacing="4">★ JOKER ★</text>
        </g>
      </svg>
    `;
  }

  // Corner font sizing
  const is10 = rank === '10';
  const rankFontSize = is10 ? 44 : 50;
  const cornerPipSize = is10 ? 28 : 32;
  const rankY = is10 ? 60 : 62;
  const cornerPipY = is10 ? 98 : 102;

  let centerContentSvg = '';

  if (rank === 'A') {
    // Large Majestic Ace Pip with Ornate Royal Ring
    centerContentSvg = `
      <g transform="translate(${WIDTH / 2}, ${HEIGHT / 2})">
        <!-- Concentric Guilloche Ring -->
        <circle cx="0" cy="0" r="130" fill="none" stroke="${color}" stroke-opacity="0.1" stroke-width="2.5"/>
        <circle cx="0" cy="0" r="145" fill="none" stroke="${color}" stroke-opacity="0.06" stroke-width="1.5" stroke-dasharray="6,6"/>
        <g transform="translate(-85, -92)">
          ${getSuitSvg(suit, 170, color)}
        </g>
      </g>
    `;
  } else if (['K', 'Q', 'J'].includes(rank)) {
    // Full Symmetrical French Court Artwork
    centerContentSvg = getCourtIllustrationSvg(rank, suit, color);
  } else {
    // Numbered Cards (2 to 10) Precision Pip Placements
    const pipSize = 68;
    const leftX = 168;
    const midX = 256;
    const rightX = 344;

    const row1 = 148;
    const row2 = 224;
    const row3 = 296;
    const rowMid = 370;
    const row4 = 444;
    const row5 = 516;
    const row6 = 592;

    let pips = [];

    if (rank === '2') {
      pips.push([midX, row1, false], [midX, row6, true]);
    } else if (rank === '3') {
      pips.push([midX, row1, false], [midX, rowMid, false], [midX, row6, true]);
    } else if (rank === '4') {
      pips.push(
        [leftX, row1, false], [rightX, row1, false],
        [leftX, row6, true], [rightX, row6, true]
      );
    } else if (rank === '5') {
      pips.push(
        [leftX, row1, false], [rightX, row1, false],
        [midX, rowMid, false],
        [leftX, row6, true], [rightX, row6, true]
      );
    } else if (rank === '6') {
      pips.push(
        [leftX, row1, false], [rightX, row1, false],
        [leftX, rowMid, false], [rightX, rowMid, false],
        [leftX, row6, true], [rightX, row6, true]
      );
    } else if (rank === '7') {
      pips.push(
        [leftX, row1, false], [rightX, row1, false],
        [midX, row2 + 15, false],
        [leftX, rowMid, false], [rightX, rowMid, false],
        [leftX, row6, true], [rightX, row6, true]
      );
    } else if (rank === '8') {
      pips.push(
        [leftX, row1, false], [rightX, row1, false],
        [midX, row2 + 15, false],
        [leftX, rowMid, false], [rightX, rowMid, false],
        [midX, row5 - 15, true],
        [leftX, row6, true], [rightX, row6, true]
      );
    } else if (rank === '9') {
      pips.push(
        [leftX, row1, false], [rightX, row1, false],
        [leftX, row3 - 10, false], [rightX, row3 - 10, false],
        [midX, rowMid, false],
        [leftX, row4 + 10, true], [rightX, row4 + 10, true],
        [leftX, row6, true], [rightX, row6, true]
      );
    } else if (rank === '10') {
      pips.push(
        [leftX, row1, false], [rightX, row1, false],
        [midX, row2 - 5, false],
        [leftX, row3 + 10, false], [rightX, row3 + 10, false],
        [leftX, row4 - 10, true], [rightX, row4 - 10, true],
        [midX, row5 + 5, true],
        [leftX, row6, true], [rightX, row6, true]
      );
    }

    centerContentSvg = pips.map(([x, y, inv]) => getPipSvg(suit, x, y, pipSize, color, inv)).join('\n');
  }

  return `
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cardSurface" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="70%" stop-color="#ffffff"/>
          <stop offset="100%" stop-color="#f8fafc"/>
        </linearGradient>
      </defs>

      <!-- Smooth Rounded Card Background with Crisp 1.5px Edge -->
      <rect x="2" y="2" width="${WIDTH - 4}" height="${HEIGHT - 4}" rx="28" fill="url(#cardSurface)" stroke="#e2e8f0" stroke-width="2"/>

      <!-- Top-Left Corner Index -->
      <g>
        <text x="44" y="${rankY}" font-family="'Trebuchet MS', 'Arial Rounded MT Bold', -apple-system, sans-serif" font-weight="900" font-size="${rankFontSize}" fill="${color}" text-anchor="middle">${rank}</text>
        <g transform="translate(${44 - cornerPipSize / 2}, ${cornerPipY - cornerPipSize / 2})">
          ${getSuitSvg(suit, cornerPipSize, color)}
        </g>
      </g>

      <!-- Center Content (Pips / Ornate Court / Ace) -->
      ${centerContentSvg}

      <!-- Bottom-Right Corner Index (Rotated 180) -->
      <g transform="rotate(180 ${WIDTH / 2} ${HEIGHT / 2})">
        <text x="44" y="${rankY}" font-family="'Trebuchet MS', 'Arial Rounded MT Bold', -apple-system, sans-serif" font-weight="900" font-size="${rankFontSize}" fill="${color}" text-anchor="middle">${rank}</text>
        <g transform="translate(${44 - cornerPipSize / 2}, ${cornerPipY - cornerPipSize / 2})">
          ${getSuitSvg(suit, cornerPipSize, color)}
        </g>
      </g>
    </svg>
  `;
}

async function buildAll() {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

  const outDir = path.join(__dirname, '../public/cards/fronts');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`Generating card images in ${outDir}...`);

  for (const suit of suits) {
    for (const rank of ranks) {
      const svg = generateCardSvg(rank, suit);
      const svgBuffer = Buffer.from(svg);
      const outPath = path.join(outDir, `${suit}_${rank}.png`);

      await sharp(svgBuffer)
        .png({ quality: 100, compressionLevel: 9 })
        .toFile(outPath);

      console.log(`✓ Generated ${suit}_${rank}.png`);
    }
  }

  // Joker
  const jokerSvg = generateCardSvg('JOKER', 'joker');
  await sharp(Buffer.from(jokerSvg))
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(outDir, 'joker_JOKER.png'));
  console.log('✓ Generated joker_JOKER.png');

  console.log('All 53 playing cards generated successfully!');
}

buildAll().catch(console.error);
