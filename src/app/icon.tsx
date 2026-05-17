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
          background: 'radial-gradient(circle at 30% 30%, #A78BFA, #6366F1 50%, #4338CA)',
          fontSize: '18px',
          fontWeight: 800,
          color: '#FFFFFF',
          fontFamily: 'system-ui, sans-serif',
          boxShadow: 'inset 0 0 6px rgba(255,255,255,0.3)',
        }}
      >
        E
      </div>
    ),
    { ...size }
  )
}
