import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PANDU — Ultimate Multiplayer Card Game',
    short_name: 'PANDU',
    description: 'Play PANDU online with friends! Real-time multiplayer card game with memory, powers, and bluffing.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#070e17',
    theme_color: '#f59e0b',
    categories: ['games', 'entertainment'],
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
