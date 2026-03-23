'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// Polyfill for browser environment (crypto.randomUUID not available in older browsers)
function newUUID(): string {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

interface Prediction {
  place_id: string
  description: string
  main_text: string
  secondary_text: string
}

interface PlaceResult {
  name: string | null
  address: string | null
  phone: string | null
  website: string | null
  hours: string[] | null
  rating: number | null
  reviewCount: number | null
  photoUrl: string | null
  status: string | null
  types: string[]
}

interface Props {
  onSelect: (result: PlaceResult & { placeId: string }) => void
  initialValue?: string
}

export default function PlacesAutocomplete({ onSelect, initialValue = '' }: Props) {
  const [input, setInput] = useState(initialValue)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [sessiontoken, setSessiontoken] = useState(newUUID)
  const [selectedDescription, setSelectedDescription] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchPredictions = useCallback(async (value: string) => {
    if (!value || value.length < 2) {
      setPredictions([])
      setIsOpen(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `/api/onboard/places-autocomplete?input=${encodeURIComponent(value)}&sessiontoken=${sessiontoken}`
      )
      if (res.ok) {
        const data = await res.json()
        if (data.available && data.predictions?.length > 0) {
          setPredictions(data.predictions)
          setIsOpen(true)
        } else {
          setPredictions([])
          setIsOpen(false)
        }
      }
    } catch {
      // Silent — autocomplete is best-effort
    } finally {
      setLoading(false)
    }
  }, [sessiontoken])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInput(value)
    setSelectedDescription('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchPredictions(value), 300)
  }

  const handleSelect = async (prediction: Prediction) => {
    setInput(prediction.main_text)
    setSelectedDescription(prediction.description)
    setIsOpen(false)
    setPredictions([])
    setLoadingDetails(true)

    try {
      const nextToken = newUUID()
      const res = await fetch(
        `/api/onboard/places-details?place_id=${prediction.place_id}&sessiontoken=${sessiontoken}`
      )
      setSessiontoken(nextToken) // Reset session token after details call (Google billing)
      if (res.ok) {
        const data = await res.json()
        if (data.available && data.result) {
          onSelect({ ...data.result, placeId: prediction.place_id })
        }
      }
    } catch {
      // Silent
    } finally {
      setLoadingDetails(false)
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        {/* Search icon */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </div>

        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          onFocus={() => predictions.length > 0 && setIsOpen(true)}
          placeholder="Search for your business..."
          className="w-full pl-9 pr-9 py-3 text-sm border-2 border-indigo-100 dark:border-indigo-900 rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-400 transition-all"
          autoComplete="off"
        />

        {/* Loading spinner / clear */}
        {(loading || loadingDetails) && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="animate-spin h-4 w-4 text-indigo-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && predictions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-input rounded-lg shadow-lg overflow-hidden z-50">
          {predictions.map((p) => (
            <button
              key={p.place_id}
              type="button"
              onMouseDown={(e) => e.preventDefault()} // prevent input blur before click
              onClick={() => handleSelect(p)}
              className="w-full flex flex-col items-start px-3 py-2.5 text-left hover:bg-muted/50 transition-colors border-b border-border last:border-0"
            >
              <span className="text-sm font-medium text-foreground">{p.main_text}</span>
              {p.secondary_text && (
                <span className="text-xs text-muted-foreground truncate w-full mt-0.5">{p.secondary_text}</span>
              )}
            </button>
          ))}
          <div className="px-3 py-1.5 flex items-center gap-1 bg-muted/50 border-t border-border">
            <svg width="12" height="12" viewBox="0 0 488 512" fill="#4285F4"><path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C315.8 103.7 285.2 88 248 88c-94.3 0-170.4 76.5-170.4 168s76.1 168 170.4 168c105.4 0 144.5-75.5 150.4-114.5H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.6z"/></svg>
            <span className="text-[10px] text-muted-foreground">Powered by Google</span>
          </div>
        </div>
      )}
    </div>
  )
}
