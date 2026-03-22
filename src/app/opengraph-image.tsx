import { ImageResponse } from 'next/og'
import { BRAND_NAME } from '@/lib/brand'

export const runtime = 'edge'
export const alt = `${BRAND_NAME} — AI Receptionist for Service Businesses`
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

        {/* Logo mark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '80px',
            height: '80px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            marginBottom: '32px',
            fontSize: '40px',
            fontWeight: 700,
            color: '#FFFFFF',
          }}
        >
          U
        </div>

        {/* Brand name */}
        <div
          style={{
            fontSize: '56px',
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: '-2px',
            marginBottom: '16px',
            display: 'flex',
          }}
        >
          {BRAND_NAME}
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '24px',
            color: 'rgba(255,255,255,0.7)',
            marginBottom: '40px',
            display: 'flex',
          }}
        >
          AI Receptionist for Service Businesses
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
              8,445+
            </div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', display: 'flex' }}>
              Calls Handled
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
              24/7
            </div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', display: 'flex' }}>
              Always On
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
              $147
            </div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', display: 'flex' }}>
              /month
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
