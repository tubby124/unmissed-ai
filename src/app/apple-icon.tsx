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
          background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
          fontSize: '100px',
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
