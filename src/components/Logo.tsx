'use client'

import Image from 'next/image'
import Link from 'next/link'

interface LogoProps {
  href?: string | null
  height?: number
  className?: string
  priority?: boolean
}

export default function Logo({ href = '/', height = 32, className = '', priority = false }: LogoProps) {
  const lightWidth = Math.round(height * 3.0)
  const darkWidth = Math.round(height * 2.33)

  const img = (
    <>
      <Image
        src="/brand/logo-light.png"
        alt="End Voicemail"
        width={lightWidth}
        height={height}
        priority={priority}
        className={`block dark:hidden h-auto w-auto ${className}`}
        style={{ height: `${height}px`, width: 'auto' }}
      />
      <Image
        src="/brand/logo-dark.png"
        alt="End Voicemail"
        width={darkWidth}
        height={height}
        priority={priority}
        className={`hidden dark:block h-auto w-auto ${className}`}
        style={{ height: `${height}px`, width: 'auto' }}
      />
    </>
  )

  if (!href) return <span className="inline-flex items-center">{img}</span>
  return (
    <Link href={href} aria-label="End Voicemail home" className="inline-flex items-center">
      {img}
    </Link>
  )
}
