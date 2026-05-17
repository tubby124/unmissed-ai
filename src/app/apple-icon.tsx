import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '40px',
          background: 'radial-gradient(circle at 30% 30%, #A78BFA, #6366F1 50%, #4338CA)',
          fontSize: '100px',
          fontWeight: 800,
          color: '#FFFFFF',
          fontFamily: 'system-ui, sans-serif',
          boxShadow: 'inset 0 0 30px rgba(255,255,255,0.25)',
        }}
      >
        E
      </div>
    ),
    { ...size }
  )
}
