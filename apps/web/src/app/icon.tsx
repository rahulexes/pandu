import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #070e17 0%, #0d1e38 50%, #0a1424 100%)',
          borderRadius: '110px',
          border: '14px solid #f59e0b',
          position: 'relative',
        }}
      >
        <div style={{ fontSize: 130, marginBottom: -10 }}>👑</div>
        <div
          style={{
            fontSize: 96,
            fontWeight: 900,
            letterSpacing: '6px',
            color: '#f59e0b',
            fontFamily: 'sans-serif',
          }}
        >
          PANDU
        </div>
        <div
          style={{
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: '4px',
            color: '#94a3b8',
            fontFamily: 'sans-serif',
            marginTop: 4,
          }}
        >
          CARD GAME
        </div>
      </div>
    ),
    { ...size }
  );
}
