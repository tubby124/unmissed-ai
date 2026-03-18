import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
          fontSize: '18px',
          fontWeight: 800,
          color: '#FFFFFF',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        U
      </div>
    ),
    { ...size }
  )
}
