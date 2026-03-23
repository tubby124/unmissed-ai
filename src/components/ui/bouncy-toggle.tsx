"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface PremiumToggleProps {
  checked?: boolean
  defaultChecked?: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  size?: "default" | "sm"
  label?: string
  className?: string
}

export function PremiumToggle({
  checked,
  defaultChecked = false,
  onChange,
  disabled = false,
  size = "sm",
  label,
  className,
}: PremiumToggleProps) {
  const [internalChecked, setInternalChecked] = useState(defaultChecked)
  const [isPressed, setIsPressed] = useState(false)

  const isControlled = checked !== undefined
  const isChecked = isControlled ? checked : internalChecked

  const handleToggle = () => {
    if (disabled) return
    const newValue = !isChecked
    if (!isControlled) setInternalChecked(newValue)
    onChange?.(newValue)
  }

  const isSmall = size === "sm"

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {label && (
        <span
          className={cn(
            "text-sm font-medium transition-colors duration-300",
            isChecked ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {label}
        </span>
      )}
      <button
        role="switch"
        type="button"
        aria-checked={isChecked}
        disabled={disabled}
        onClick={handleToggle}
        onMouseDown={() => !disabled && setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => setIsPressed(false)}
        className={cn(
          "group relative rounded-full p-[3px] transition-all duration-500 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isSmall ? "h-6 w-11" : "h-8 w-14",
          isChecked ? "bg-foreground" : "bg-muted-foreground/20",
          disabled && "opacity-40 cursor-not-allowed",
        )}
      >
        {/* Glow effect */}
        <div
          className={cn(
            "absolute inset-0 rounded-full transition-opacity duration-500",
            isChecked && !disabled ? "opacity-100 shadow-[0_0_12px_rgba(0,0,0,0.1)]" : "opacity-0",
          )}
        />

        {/* Track inner gradient */}
        <div
          className={cn(
            "absolute inset-[2px] rounded-full transition-all duration-500",
            isChecked ? "bg-gradient-to-b from-foreground to-foreground/90" : "bg-transparent",
          )}
        />

        {/* Thumb */}
        <div
          className={cn(
            "relative rounded-full shadow-lg transition-all duration-500 ease-[cubic-bezier(0.68,-0.55,0.265,1.55)]",
            "bg-background",
            isSmall ? "h-[18px] w-[18px]" : "h-6 w-6",
            isSmall
              ? isChecked ? "translate-x-5" : "translate-x-0"
              : isChecked ? "translate-x-6" : "translate-x-0",
            isPressed && !disabled && "scale-90 duration-150",
          )}
        >
          {/* Thumb inner shine */}
          <div className="absolute inset-[2px] rounded-full bg-gradient-to-b from-background via-background to-muted/30" />

          {/* Thumb highlight */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-background/80 via-transparent to-transparent" />

          {/* Status indicator dot */}
          <div
            className={cn(
              "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-500",
              isSmall
                ? isChecked
                  ? "h-1.5 w-1.5 bg-foreground opacity-100"
                  : "h-1 w-1 bg-muted-foreground/40 opacity-100"
                : isChecked
                  ? "h-2 w-2 bg-foreground opacity-100"
                  : "h-1.5 w-1.5 bg-muted-foreground/40 opacity-100",
            )}
          />

          {/* Ripple effect on toggle */}
          <div
            className={cn(
              "absolute inset-0 rounded-full transition-all duration-700",
              isChecked ? "animate-ping bg-foreground/20 scale-150 opacity-0" : "scale-100 opacity-0",
            )}
            key={isChecked ? "on" : "off"}
          />
        </div>
      </button>
    </div>
  )
}
