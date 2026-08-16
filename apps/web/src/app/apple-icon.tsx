import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
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
          borderRadius: '40px',
          border: '6px solid #f59e0b',
        }}
      >
        <div style={{ fontSize: 50, marginBottom: -4 }}>👑</div>
        <div
          style={{
            fontSize: 34,
            fontWeight: 900,
            letterSpacing: '2px',
            color: '#f59e0b',
            fontFamily: 'sans-serif',
          }}
        >
          PANDU
        </div>
      </div>
    ),
    { ...size }
  );
}
