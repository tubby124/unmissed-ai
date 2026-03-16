'use client'

import { Sun, Moon } from 'lucide-react'
import { useTheme } from './ThemeProvider'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      className="p-2 rounded-lg transition-colors"
      style={{
        color: 'var(--color-text-2)',
        backgroundColor: 'transparent',
      }}
      onMouseEnter={(e) => {
        ;(e.target as HTMLElement).style.backgroundColor = 'var(--color-border)'
      }}
      onMouseLeave={(e) => {
        ;(e.target as HTMLElement).style.backgroundColor = 'transparent'
      }}
    >
      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  )
}
