'use client'

import { useEffect, useRef } from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { STORAGE_KEYS } from '@/lib/storage-keys'

const TOUR_KEY = STORAGE_KEYS.TOUR_COMPLETED

/**
 * GuidedTour — 4-step driver.js tour for first-time dashboard users.
 * Renders on the client home page (/dashboard) for non-admin users only.
 * Checks localStorage for completion flag. Runs once, then never again.
 *
 * Tour steps target elements with data-tour attributes:
 *   1. data-tour="agent-hero"   — hero card on ClientHome
 *   2. data-tour="nav-settings" — Settings link in sidebar
 *   3. data-tour="nav-agent"    — Agent setup link in sidebar
 *   4. data-tour="nav-calls"    — Overview (calls) link in sidebar
 */
export default function GuidedTour() {
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    // Already completed
    if (localStorage.getItem(TOUR_KEY)) return

    // Tour targets sidebar nav links which are hidden below lg (1024px)
    if (window.innerWidth < 1024) return

    // Wait for elements to render
    const timer = setTimeout(() => {
      const heroEl = document.querySelector('[data-tour="agent-hero"]')
      if (!heroEl) return // not on home page or still loading

      const d = driver({
        showProgress: true,
        animate: true,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        stagePadding: 8,
        stageRadius: 12,
        popoverClass: 'unmissed-tour-popover',
        nextBtnText: 'Next',
        prevBtnText: 'Back',
        doneBtnText: 'Got it',
        steps: [
          {
            element: '[data-tour="agent-hero"]',
            popover: {
              title: 'Your AI Agent',
              description: 'This is your AI agent. It answers calls for your business 24/7 — even when you can\'t.',
              side: 'bottom',
              align: 'center',
            },
          },
          {
            element: '[data-tour="nav-settings"]',
            popover: {
              title: 'Customize Your Agent',
              description: 'Teach your agent about your business, set hours, add FAQs, and pick a voice.',
              side: 'right',
              align: 'start',
            },
          },
          {
            element: '[data-tour="nav-agent"]',
            popover: {
              title: 'Test Your Agent',
              description: 'Talk to your agent in the browser to hear how it sounds. Fine-tune until it\'s perfect.',
              side: 'right',
              align: 'start',
            },
          },
          {
            element: '[data-tour="nav-calls"]',
            popover: {
              title: 'Call History',
              description: 'Every call, transcript, and lead appears here. See how your agent is performing.',
              side: 'right',
              align: 'start',
            },
          },
        ],
        onDestroyStarted: () => {
          localStorage.setItem(TOUR_KEY, '1')
          d.destroy()
        },
      })

      d.drive()
    }, 800)

    return () => clearTimeout(timer)
  }, [])

  return (
    <style>{`
      .unmissed-tour-popover {
        --djs-theme-bg: var(--color-surface, #1a1a2e) !important;
        --djs-theme-fg: var(--color-text-1, #e4e4e7) !important;
        --djs-theme-border: var(--color-border, rgba(255,255,255,0.08)) !important;
        --djs-theme-highlight: #3b82f6 !important;
        font-family: inherit !important;
      }
      .unmissed-tour-popover .driver-popover {
        background: var(--color-surface, #1a1a2e) !important;
        border: 1px solid var(--color-border, rgba(255,255,255,0.08)) !important;
        border-radius: 16px !important;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5) !important;
        color: var(--color-text-1, #e4e4e7) !important;
      }
      .unmissed-tour-popover .driver-popover-title {
        font-size: 14px !important;
        font-weight: 600 !important;
        color: var(--color-text-1, #e4e4e7) !important;
      }
      .unmissed-tour-popover .driver-popover-description {
        font-size: 12px !important;
        color: var(--color-text-2, #a1a1aa) !important;
        line-height: 1.5 !important;
      }
      .unmissed-tour-popover .driver-popover-progress-text {
        font-size: 10px !important;
        color: var(--color-text-3, #71717a) !important;
      }
      .unmissed-tour-popover .driver-popover-navigation-btns button {
        font-size: 12px !important;
        font-weight: 500 !important;
        border-radius: 8px !important;
        padding: 6px 14px !important;
      }
      .unmissed-tour-popover .driver-popover-next-btn,
      .unmissed-tour-popover .driver-popover-close-btn {
        background: #3b82f6 !important;
        color: white !important;
        border: none !important;
      }
      .unmissed-tour-popover .driver-popover-prev-btn {
        background: transparent !important;
        color: var(--color-text-2, #a1a1aa) !important;
        border: 1px solid var(--color-border, rgba(255,255,255,0.08)) !important;
      }
    `}</style>
  )
}
