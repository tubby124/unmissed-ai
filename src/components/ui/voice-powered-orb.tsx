"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface VoicePoweredOrbProps {
  className?: string
  /** Hue shift in degrees (0-360). Default 0 = purple/cyan. */
  hue?: number
  /** 0-1 energy from external source (e.g., Ultravox call). Skips mic init. */
  externalEnergy?: number
  /** Use device mic for audio analysis. Ignored when externalEnergy is set. */
  enableVoiceControl?: boolean
  voiceSensitivity?: number
  maxRotationSpeed?: number
  maxHoverIntensity?: number
  onVoiceDetected?: (detected: boolean) => void
}

const VERT = /* glsl */ `
  precision highp float;
  attribute vec2 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

const FRAG = /* glsl */ `
  precision highp float;

  uniform float iTime;
  uniform vec3 iResolution;
  uniform float hue;
  uniform float hover;
  uniform float rot;
  uniform float hoverIntensity;
  varying vec2 vUv;

  vec3 rgb2yiq(vec3 c) {
    return vec3(
      dot(c, vec3(0.299, 0.587, 0.114)),
      dot(c, vec3(0.596, -0.274, -0.322)),
      dot(c, vec3(0.211, -0.523, 0.312))
    );
  }

  vec3 yiq2rgb(vec3 c) {
    return vec3(
      c.x + 0.956 * c.y + 0.621 * c.z,
      c.x - 0.272 * c.y - 0.647 * c.z,
      c.x - 1.106 * c.y + 1.703 * c.z
    );
  }

  vec3 adjustHue(vec3 color, float hueDeg) {
    float hueRad = hueDeg * 3.14159265 / 180.0;
    vec3 yiq = rgb2yiq(color);
    float cosA = cos(hueRad);
    float sinA = sin(hueRad);
    yiq.yz = vec2(yiq.y * cosA - yiq.z * sinA, yiq.y * sinA + yiq.z * cosA);
    return yiq2rgb(yiq);
  }

  vec3 hash33(vec3 p3) {
    p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
    p3 += dot(p3, p3.yxz + 19.19);
    return -1.0 + 2.0 * fract(vec3(p3.x + p3.y, p3.x + p3.z, p3.y + p3.z) * p3.zyx);
  }

  float snoise3(vec3 p) {
    const float K1 = 0.333333333;
    const float K2 = 0.166666667;
    vec3 i = floor(p + (p.x + p.y + p.z) * K1);
    vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
    vec3 e = step(vec3(0.0), d0 - d0.yzx);
    vec3 i1 = e * (1.0 - e.zxy);
    vec3 i2 = 1.0 - e.zxy * (1.0 - e);
    vec3 d1 = d0 - (i1 - K2);
    vec3 d2 = d0 - (i2 - K1);
    vec3 d3 = d0 - 0.5;
    vec4 h = max(0.6 - vec4(dot(d0,d0), dot(d1,d1), dot(d2,d2), dot(d3,d3)), 0.0);
    vec4 n = h * h * h * h * vec4(
      dot(d0, hash33(i)),
      dot(d1, hash33(i + i1)),
      dot(d2, hash33(i + i2)),
      dot(d3, hash33(i + 1.0))
    );
    return dot(vec4(31.316), n);
  }

  vec4 extractAlpha(vec3 colorIn) {
    float a = max(max(colorIn.r, colorIn.g), colorIn.b);
    return vec4(colorIn.rgb / (a + 1e-5), a);
  }

  const vec3 baseColor1 = vec3(0.611765, 0.262745, 0.996078);
  const vec3 baseColor2 = vec3(0.298039, 0.760784, 0.913725);
  const vec3 baseColor3 = vec3(0.062745, 0.078431, 0.600000);
  const float innerRadius = 0.6;
  const float noiseScale = 0.65;

  float light1(float intensity, float attenuation, float dist) {
    return intensity / (1.0 + dist * attenuation);
  }

  float light2(float intensity, float attenuation, float dist) {
    return intensity / (1.0 + dist * dist * attenuation);
  }

  vec4 draw(vec2 uv) {
    vec3 color1 = adjustHue(baseColor1, hue);
    vec3 color2 = adjustHue(baseColor2, hue);
    vec3 color3 = adjustHue(baseColor3, hue);

    float len = length(uv);
    float invLen = len > 0.0 ? 1.0 / len : 0.0;
    float n0 = snoise3(vec3(uv * noiseScale, iTime * 0.5)) * 0.5 + 0.5;
    float r0 = mix(mix(innerRadius, 1.0, 0.4), mix(innerRadius, 1.0, 0.6), n0);
    float d0 = distance(uv, (r0 * invLen) * uv);
    float v0 = light1(1.0, 10.0, d0);
    v0 *= smoothstep(r0 * 1.05, r0, len);
    float cl = cos(atan(uv.y, uv.x) + iTime * 2.0) * 0.5 + 0.5;

    float a = iTime * -1.0;
    vec2 pos = vec2(cos(a), sin(a)) * r0;
    float d = distance(uv, pos);
    float v1 = light2(1.5, 5.0, d);
    v1 *= light1(1.0, 50.0, d0);

    float v2 = smoothstep(1.0, mix(innerRadius, 1.0, n0 * 0.5), len);
    float v3 = smoothstep(innerRadius, mix(innerRadius, 1.0, 0.5), len);

    vec3 col = mix(color1, color2, cl);
    col = mix(color3, col, v0);
    col = (col + v1) * v2 * v3;
    return extractAlpha(clamp(col, 0.0, 1.0));
  }

  vec4 mainImage(vec2 fragCoord) {
    vec2 center = iResolution.xy * 0.5;
    float size = min(iResolution.x, iResolution.y);
    vec2 uv = (fragCoord - center) / size * 2.0;

    float s = sin(rot);
    float c = cos(rot);
    uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);

    uv.x += hover * hoverIntensity * 0.1 * sin(uv.y * 10.0 + iTime);
    uv.y += hover * hoverIntensity * 0.1 * sin(uv.x * 10.0 + iTime);

    return draw(uv);
  }

  void main() {
    vec4 col = mainImage(vUv * iResolution.xy);
    gl_FragColor = vec4(col.rgb * col.a, col.a);
  }
`

export function VoicePoweredOrb({
  className,
  hue = 0,
  externalEnergy,
  enableVoiceControl = false,
  voiceSensitivity = 1.5,
  maxRotationSpeed = 1.2,
  maxHoverIntensity = 0.8,
  onVoiceDetected,
}: VoicePoweredOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [reducedMotion, setReducedMotion] = useState(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const micRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const externalEnergyRef = useRef(externalEnergy ?? 0)

  // Respect prefers-reduced-motion (HIGH priority UX rule)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  // Keep external energy ref in sync
  useEffect(() => {
    externalEnergyRef.current = externalEnergy ?? 0
  }, [externalEnergy])

  const useExternalEnergy = externalEnergy !== undefined

  // Audio analysis (only when using own mic)
  const analyzeAudio = (): number => {
    if (!analyserRef.current || !dataArrayRef.current) return 0
    analyserRef.current.getByteFrequencyData(dataArrayRef.current)
    let sum = 0
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      const v = dataArrayRef.current[i] / 255
      sum += v * v
    }
    return Math.min(Math.sqrt(sum / dataArrayRef.current.length) * voiceSensitivity * 3, 1)
  }

  const stopMic = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    micRef.current?.disconnect()
    micRef.current = null
    analyserRef.current?.disconnect()
    analyserRef.current = null
    if (audioCtxRef.current?.state !== "closed") {
      audioCtxRef.current?.close().catch(() => {})
    }
    audioCtxRef.current = null
    dataArrayRef.current = null
  }

  const initMic = async (): Promise<boolean> => {
    try {
      stopMic()
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
      streamRef.current = stream
      const ctx = new AudioContext()
      if (ctx.state === "suspended") await ctx.resume()
      audioCtxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.3
      analyser.minDecibels = -90
      analyser.maxDecibels = -10
      analyserRef.current = analyser
      micRef.current = ctx.createMediaStreamSource(stream)
      micRef.current.connect(analyser)
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount)
      return true
    } catch {
      return false
    }
  }

  // Main WebGL effect — skip entirely when reduced motion is preferred
  useEffect(() => {
    if (reducedMotion) return
    const container = containerRef.current
    if (!container) return

    // Dynamic import to avoid SSR issues
    let cancelled = false
    let rafId: number
    // Track GL context separately for cleanup race safety
    let glContext: WebGLRenderingContext | WebGL2RenderingContext | null = null

    async function init() {
      const { Renderer, Program, Mesh, Triangle, Vec3 } = await import("ogl")
      if (cancelled || !container) return

      const renderer = new Renderer({
        alpha: true,
        premultipliedAlpha: false,
        antialias: true,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
      })
      const gl = renderer.gl
      glContext = gl
      gl.clearColor(0, 0, 0, 0)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

      while (container.firstChild) container.removeChild(container.firstChild)
      container.appendChild(gl.canvas)

      const geometry = new Triangle(gl)
      const program = new Program(gl, {
        vertex: VERT,
        fragment: FRAG,
        uniforms: {
          iTime: { value: 0 },
          iResolution: { value: new Vec3(gl.canvas.width, gl.canvas.height, 1) },
          hue: { value: hue },
          hover: { value: 0 },
          rot: { value: 0 },
          hoverIntensity: { value: 0 },
        },
      })
      const mesh = new Mesh(gl, { geometry, program })

      const resize = () => {
        if (!container) return
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const w = container.clientWidth
        const h = container.clientHeight
        if (w === 0 || h === 0) return
        renderer.setSize(w * dpr, h * dpr)
        gl.canvas.style.width = w + "px"
        gl.canvas.style.height = h + "px"
        program.uniforms.iResolution.value.set(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height)
      }
      window.addEventListener("resize", resize)
      resize()

      let currentRot = 0
      let lastTime = 0
      let micReady = false
      const baseSpeed = 0.3

      // Init mic only if NOT using external energy AND voice control enabled
      if (!useExternalEnergy && enableVoiceControl) {
        initMic().then(ok => { micReady = ok })
      }

      const update = (t: number) => {
        if (cancelled) return
        rafId = requestAnimationFrame(update)
        const dt = (t - lastTime) * 0.001
        lastTime = t

        program.uniforms.iTime.value = t * 0.001
        program.uniforms.hue.value = hue

        let level: number
        if (useExternalEnergy) {
          level = externalEnergyRef.current
        } else if (enableVoiceControl && micReady) {
          level = analyzeAudio()
          onVoiceDetected?.(level > 0.1)
        } else {
          level = 0
          onVoiceDetected?.(false)
        }

        const speed = baseSpeed + level * maxRotationSpeed * 2
        if (level > 0.05) currentRot += dt * speed

        program.uniforms.hover.value = Math.min(level * 2, 1)
        program.uniforms.hoverIntensity.value = Math.min(level * maxHoverIntensity * 0.8, maxHoverIntensity)
        program.uniforms.rot.value = currentRot

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
        renderer.render({ scene: mesh })
      }

      rafId = requestAnimationFrame(update)

      return () => {
        cancelled = true
        cancelAnimationFrame(rafId)
        window.removeEventListener("resize", resize)
        try {
          if (container.contains(gl.canvas)) container.removeChild(gl.canvas)
        } catch {}
        stopMic()
        gl.getExtension("WEBGL_lose_context")?.loseContext()
      }
    }

    let cleanup: (() => void) | undefined
    init().then(fn => { cleanup = fn })

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      if (cleanup) {
        cleanup()
      } else if (glContext) {
        // Race condition: init created GL context but hasn't returned cleanup yet
        glContext.getExtension("WEBGL_lose_context")?.loseContext()
        stopMic()
      }
    }
  }, [hue, enableVoiceControl, useExternalEnergy, reducedMotion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reduced motion fallback: static gradient orb (no WebGL, no animation)
  if (reducedMotion) {
    return (
      <div className={cn("w-full h-full relative rounded-full", className)} style={{
        background: "radial-gradient(circle at 35% 35%, rgba(99,102,241,0.7), rgba(48,194,228,0.4), rgba(15,23,42,0.9))",
      }} />
    )
  }

  return <div ref={containerRef} className={cn("w-full h-full relative", className)} />
}
