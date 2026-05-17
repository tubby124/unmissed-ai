import { ImageResponse } from 'next/og'
import { BRAND_NAME } from '@/lib/brand'

export const runtime = 'edge'
export const alt = `${BRAND_NAME} — AI Receptionist for Dental Practices`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
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
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Accent glow */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Logo orb mark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '96px',
            height: '96px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, #A78BFA, #6366F1 55%, #312E81)',
            marginBottom: '32px',
            boxShadow: '0 0 40px rgba(139, 92, 246, 0.5), inset 0 0 30px rgba(255,255,255,0.15)',
          }}
        />

        {/* Title */}
        <div
          style={{
            fontSize: '56px',
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: '-2px',
            marginBottom: '16px',
            display: 'flex',
            textAlign: 'center',
            padding: '0 60px',
          }}
        >
          AI Receptionist for Dental Practices
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '24px',
            color: 'rgba(255,255,255,0.7)',
            marginBottom: '40px',
            display: 'flex',
            textAlign: 'center',
            padding: '0 80px',
          }}
        >
          Book appointments when your front desk is at lunch
        </div>

        {/* Stats bar */}
        <div
          style={{
            display: 'flex',
            gap: '48px',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#10B981', display: 'flex' }}>
              1
            </div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', display: 'flex' }}>
              Missed Booking
            </div>
          </div>
          <div
            style={{
              width: '1px',
              height: '40px',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
            }}
          />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#10B981', display: 'flex' }}>
              $300
            </div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', display: 'flex' }}>
              Lifetime Value
            </div>
          </div>
          <div
            style={{
              width: '1px',
              height: '40px',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
            }}
          />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#10B981', display: 'flex' }}>
              Lost
            </div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', display: 'flex' }}>
              To Voicemail
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
