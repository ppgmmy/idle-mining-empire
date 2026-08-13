import { useEffect, useRef } from 'react'

type Props = {
  pulse: number
  miners: number
  drillLevel: number
  stage: number
  stageHpRatio: number
  stageName: string
  bossHpRatio: number | null
}

type Spark = { x: number; y: number; vx: number; vy: number; life: number; warm: boolean }
type Ember = { x: number; y: number; r: number; vy: number; a: number; life: number }

/** 礦洞街道觀測：主角掘實體礦（HP），通關後行去下一關 */
export function MineCanvas({
  pulse,
  miners,
  drillLevel,
  stage,
  stageHpRatio,
  stageName,
  bossHpRatio,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pulseRef = useRef(pulse)
  const lastPulseRef = useRef(pulse)
  const sparksRef = useRef<Spark[]>([])
  const bossRef = useRef(bossHpRatio)
  const stageRef = useRef(stage)
  const hpRef = useRef(stageHpRatio)
  const nameRef = useRef(stageName)
  const walkRef = useRef(0) // 0=digging, >0 walk progress 0→1 after clear
  const lastStageRef = useRef(stage)

  pulseRef.current = pulse
  bossRef.current = bossHpRatio
  stageRef.current = stage
  hpRef.current = stageHpRatio
  nameRef.current = stageName

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let t = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const wallNoise = Array.from({ length: 40 }, (_, i) => ({
      x: ((i * 97) % 100) / 100,
      y: ((i * 53) % 100) / 100,
      s: 8 + (i % 7) * 4,
      a: 0.04 + (i % 5) * 0.02,
    }))

    const embers: Ember[] = Array.from({ length: 20 }, (_, i) => ({
      x: (i * 37) % 400,
      y: (i * 61) % 300,
      r: 0.6 + (i % 4) * 0.4,
      vy: -0.12 - (i % 5) * 0.05,
      a: 0.15 + (i % 4) * 0.06,
      life: Math.random(),
    }))

    const lanterns = [0.16, 0.34, 0.52, 0.7]

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.floor(rect.width * dpr)
      canvas.height = Math.floor(rect.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const burst = (cx: number, cy: number, count = 22) => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2
        const sp = 1.1 + Math.random() * 3.6
        sparksRef.current.push({
          x: cx + (Math.random() - 0.5) * 18,
          y: cy + (Math.random() - 0.5) * 12,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 1.1,
          life: 0.5 + Math.random() * 0.45,
          warm: Math.random() > 0.35,
        })
      }
      if (sparksRef.current.length > 100) {
        sparksRef.current.splice(0, sparksRef.current.length - 100)
      }
    }

    const drawTimber = (x: number, y0: number, y1: number) => {
      ctx.fillStyle = '#5c3d24'
      ctx.fillRect(x - 5, y0, 10, y1 - y0)
      ctx.fillStyle = '#7a5534'
      ctx.fillRect(x - 3, y0, 4, y1 - y0)
      ctx.fillStyle = '#4a301c'
      ctx.fillRect(x - 18, y0 + 8, 36, 7)
    }

    const drawStall = (x: number, groundY: number, scale: number, warm: boolean) => {
      ctx.save()
      ctx.translate(x, groundY)
      ctx.scale(scale, scale)
      ctx.fillStyle = warm ? '#3a2a1c' : '#2e241c'
      ctx.fillRect(-20, -44, 40, 44)
      ctx.fillStyle = warm ? '#c45c2a' : '#6b4a2e'
      ctx.beginPath()
      ctx.moveTo(-24, -44)
      ctx.lineTo(24, -44)
      ctx.lineTo(20, -32)
      ctx.lineTo(-20, -32)
      ctx.closePath()
      ctx.fill()
      const door = ctx.createLinearGradient(0, -24, 0, 0)
      door.addColorStop(0, warm ? 'rgba(255,180,80,0.5)' : 'rgba(180,200,220,0.22)')
      door.addColorStop(1, 'rgba(0,0,0,0.45)')
      ctx.fillStyle = door
      ctx.fillRect(-9, -24, 18, 24)
      ctx.restore()
    }

    const drawRock = (
      x: number,
      y: number,
      hp: number,
      fighting: boolean,
      bossHp: number | null,
    ) => {
      const crack = fighting ? 1 - (bossHp ?? 1) : 1 - Math.max(0, Math.min(1, hp))
      const scale = (0.72 + drillLevel * 0.01) * (1 - crack * 0.28)
      const breath = 1 + Math.sin(t * 2) * 0.015

      ctx.save()
      ctx.translate(x, y)
      ctx.scale(scale * breath, scale * breath)

      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.beginPath()
      ctx.ellipse(0, 38, 48 - crack * 10, 10, 0, 0, Math.PI * 2)
      ctx.fill()

      if (fighting) {
        ctx.rotate(Math.sin(t * 1.6) * 0.06)
        const g = ctx.createRadialGradient(0, -6, 4, 0, 10, 58)
        g.addColorStop(0, '#ffe0c8')
        g.addColorStop(0.35, '#ff6a45')
        g.addColorStop(1, '#3a120c')
        ctx.beginPath()
        ctx.moveTo(0, -52)
        ctx.lineTo(28, -14)
        ctx.lineTo(40, 18)
        ctx.lineTo(16, 40)
        ctx.lineTo(-18, 42)
        ctx.lineTo(-42, 14)
        ctx.lineTo(-26, -16)
        ctx.closePath()
        ctx.fillStyle = g
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,200,160,0.55)'
        ctx.stroke()
        const eye = 0.65 + Math.sin(t * 6) * 0.35
        ctx.fillStyle = `rgba(255,220,100,${eye})`
        ctx.beginPath()
        ctx.arc(-12, -4, 4, 0, Math.PI * 2)
        ctx.arc(12, -4, 4, 0, Math.PI * 2)
        ctx.fill()
      } else {
        // physical ore boulder
        const body = ctx.createLinearGradient(-30, -40, 30, 40)
        body.addColorStop(0, '#6b5340')
        body.addColorStop(0.35, '#4a3828')
        body.addColorStop(0.7, '#2e2218')
        body.addColorStop(1, '#1a140e')
        ctx.beginPath()
        ctx.moveTo(-36, 8)
        ctx.lineTo(-28, -22)
        ctx.lineTo(-8, -40)
        ctx.lineTo(18, -36)
        ctx.lineTo(38, -8)
        ctx.lineTo(32, 28)
        ctx.lineTo(4, 40)
        ctx.lineTo(-24, 34)
        ctx.closePath()
        ctx.fillStyle = body
        ctx.fill()
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'
        ctx.stroke()

        // amber veins (fade as HP drops)
        const veinA = 0.35 + hp * 0.45
        const vein = ctx.createLinearGradient(-10, -30, 20, 30)
        vein.addColorStop(0, `rgba(255,230,140,${veinA})`)
        vein.addColorStop(0.5, `rgba(240,170,40,${veinA})`)
        vein.addColorStop(1, `rgba(120,70,20,${veinA * 0.5})`)
        ctx.beginPath()
        ctx.moveTo(-6, -28)
        ctx.lineTo(8, -8)
        ctx.lineTo(2, 18)
        ctx.lineTo(-12, 6)
        ctx.closePath()
        ctx.fillStyle = vein
        ctx.fill()

        // crack lines grow as HP falls
        if (crack > 0.08) {
          ctx.strokeStyle = `rgba(10,6,4,${0.35 + crack * 0.5})`
          ctx.lineWidth = 1.5 + crack * 2
          ctx.beginPath()
          ctx.moveTo(-8, -20)
          ctx.lineTo(2, 0)
          ctx.lineTo(-4, 22)
          if (crack > 0.35) {
            ctx.moveTo(10, -12)
            ctx.lineTo(18, 8)
          }
          if (crack > 0.6) {
            ctx.moveTo(-20, 4)
            ctx.lineTo(-6, 16)
          }
          ctx.stroke()
        }

        // chips floating off when damaged
        if (crack > 0.2) {
          ctx.fillStyle = `rgba(90,70,50,${crack * 0.5})`
          for (let i = 0; i < 3; i++) {
            const ang = t * 1.5 + i * 2.1
            ctx.beginPath()
            ctx.arc(Math.cos(ang) * (20 + crack * 12), -10 + Math.sin(ang) * 8, 2 + i, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }

      // HP bar above rock
      const barW = 70
      const ratio = fighting ? Math.max(0, Math.min(1, bossHp ?? 1)) : Math.max(0, Math.min(1, hp))
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(-barW / 2, -58, barW, 8)
      ctx.fillStyle = fighting
        ? 'linear-gradient' // fallback solid
        : '#f0b429'
      if (fighting) {
        const bg = ctx.createLinearGradient(-barW / 2, 0, barW / 2, 0)
        bg.addColorStop(0, '#ff7a59')
        bg.addColorStop(1, '#f0b429')
        ctx.fillStyle = bg
      } else {
        const bg = ctx.createLinearGradient(-barW / 2, 0, barW / 2, 0)
        bg.addColorStop(0, '#f0b429')
        bg.addColorStop(1, '#57c7b2')
        ctx.fillStyle = bg
      }
      ctx.fillRect(-barW / 2, -58, barW * ratio, 8)
      ctx.strokeStyle = 'rgba(255,220,160,0.45)'
      ctx.strokeRect(-barW / 2, -58, barW, 8)

      ctx.restore()
    }

    const drawMiner = (x: number, y: number, digging: boolean, walkPhase: number) => {
      const bob = digging
        ? Math.sin(t * 3.2) * 1.5
        : Math.sin(walkPhase * Math.PI * 4) * 2
      const my = y + bob

      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.beginPath()
      ctx.ellipse(x, y + 16, 14, 4.5, 0, 0, Math.PI * 2)
      ctx.fill()

      // legs (walk)
      ctx.strokeStyle = '#3a2a1c'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      const stride = digging ? 0 : Math.sin(walkPhase * Math.PI * 4) * 6
      ctx.beginPath()
      ctx.moveTo(x - 3, my + 4)
      ctx.lineTo(x - 5 - stride, my + 14)
      ctx.moveTo(x + 3, my + 4)
      ctx.lineTo(x + 5 + stride, my + 14)
      ctx.stroke()

      const suit = ctx.createLinearGradient(x - 9, my - 26, x + 9, my + 6)
      suit.addColorStop(0, '#d8c4a0')
      suit.addColorStop(0.5, '#8a7355')
      suit.addColorStop(1, '#4a3a28')
      ctx.fillStyle = suit
      ctx.fillRect(x - 8, my - 20, 16, 26)

      ctx.fillStyle = '#f0b429'
      ctx.beginPath()
      ctx.ellipse(x, my - 26, 10, 6, 0, Math.PI, Math.PI * 2)
      ctx.fill()
      ctx.fillRect(x - 10, my - 28, 20, 4)

      ctx.fillStyle = '#c4a882'
      ctx.beginPath()
      ctx.arc(x, my - 22, 5.5, 0, Math.PI * 2)
      ctx.fill()

      // pickaxe
      ctx.save()
      ctx.translate(x + 7, my - 6)
      const swing = digging ? Math.sin(t * 8 + pulseRef.current) * 0.55 : -0.35
      ctx.rotate(-0.55 + swing)
      ctx.strokeStyle = '#5c4030'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(26, -16)
      ctx.stroke()
      ctx.strokeStyle = '#b0b8c0'
      ctx.lineWidth = 3.5
      ctx.beginPath()
      ctx.moveTo(20, -20)
      ctx.lineTo(32, -8)
      ctx.stroke()
      ctx.restore()
    }

    const draw = () => {
      t += 0.016
      const { width: w, height: h } = canvas.getBoundingClientRect()
      ctx.clearRect(0, 0, w, h)

      const fighting = bossRef.current != null
      const streetY = h * 0.74
      const rockX = w * 0.68
      const rockY = h * 0.5

      // stage clear → walk to next
      if (stageRef.current !== lastStageRef.current) {
        if (stageRef.current > lastStageRef.current && !fighting) {
          walkRef.current = 0.001
          burst(rockX, rockY, 40)
        }
        lastStageRef.current = stageRef.current
      }
      if (walkRef.current > 0 && walkRef.current < 1) {
        walkRef.current = Math.min(1, walkRef.current + 0.018)
        if (walkRef.current >= 1) walkRef.current = 0
      }

      const walking = walkRef.current > 0
      const digX = w * 0.42
      const heroX = walking
        ? digX + (rockX + 40 - digX) * walkRef.current
        : digX + Math.sin(t * 0.8) * 3

      if (pulseRef.current !== lastPulseRef.current) {
        lastPulseRef.current = pulseRef.current
        burst(rockX, rockY, fighting ? 32 : 20)
      }

      // cave backdrop
      const cave = ctx.createLinearGradient(0, 0, 0, h)
      cave.addColorStop(0, '#0c0a08')
      cave.addColorStop(0.4, '#17120c')
      cave.addColorStop(1, '#120e0a')
      ctx.fillStyle = cave
      ctx.fillRect(0, 0, w, h)

      const crackLight = ctx.createRadialGradient(w * 0.5, 0, 2, w * 0.5, h * 0.2, w * 0.5)
      crackLight.addColorStop(0, fighting ? 'rgba(255,90,50,0.16)' : 'rgba(240,170,60,0.14)')
      crackLight.addColorStop(1, 'transparent')
      ctx.fillStyle = crackLight
      ctx.fillRect(0, 0, w, h)

      // tunnel depth
      const tunnel = ctx.createRadialGradient(rockX, rockY, 10, rockX, rockY, w * 0.4)
      tunnel.addColorStop(0, fighting ? '#2a1008' : '#1c160f')
      tunnel.addColorStop(0.55, '#0e0b08')
      tunnel.addColorStop(1, 'transparent')
      ctx.fillStyle = tunnel
      ctx.fillRect(0, 0, w, h)

      for (const n of wallNoise) {
        ctx.fillStyle = `rgba(0,0,0,${n.a})`
        ctx.beginPath()
        ctx.ellipse(n.x * w, n.y * h * 0.65, n.s, n.s * 0.55, 0, 0, Math.PI * 2)
        ctx.fill()
      }

      // left / right rock walls
      for (const side of ['left', 'right'] as const) {
        const baseX = side === 'left' ? 0 : w
        const dir = side === 'left' ? 1 : -1
        const depth = w * 0.26
        ctx.beginPath()
        ctx.moveTo(baseX, 0)
        for (let y = 0; y <= h; y += 16) {
          const jag = Math.sin(y * 0.045 + t * 0.15) * 9 + Math.sin(y * 0.1) * 5
          ctx.lineTo(baseX + dir * (depth + jag), y)
        }
        ctx.lineTo(baseX, h)
        ctx.closePath()
        const g = ctx.createLinearGradient(baseX, 0, baseX + dir * depth, 0)
        g.addColorStop(0, '#1a120c')
        g.addColorStop(1, '#3a2c20')
        ctx.fillStyle = g
        ctx.fill()
      }

      // ceiling
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(w, 0)
      for (let x = w; x >= 0; x -= 18) {
        ctx.lineTo(x, h * 0.1 + Math.sin(x * 0.04) * 12)
      }
      ctx.closePath()
      ctx.fillStyle = '#0a0806'
      ctx.fill()

      for (const p of [0.14, 0.28, 0.44, 0.58]) {
        drawTimber(w * p, h * 0.08, streetY - 6)
      }
      ctx.fillStyle = '#4a301c'
      ctx.fillRect(w * 0.08, h * 0.1, w * 0.55, 8)

      // street
      const road = ctx.createLinearGradient(0, streetY - 24, 0, h)
      road.addColorStop(0, '#2a2218')
      road.addColorStop(0.4, '#3a3024')
      road.addColorStop(1, '#1a1510')
      ctx.fillStyle = road
      ctx.beginPath()
      ctx.moveTo(0, streetY + 10)
      ctx.quadraticCurveTo(w * 0.4, streetY - 16, w, streetY + 4)
      ctx.lineTo(w, h)
      ctx.lineTo(0, h)
      ctx.closePath()
      ctx.fill()

      // planks / rails
      ctx.strokeStyle = 'rgba(90,70,45,0.5)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(w * 0.06, streetY + 16)
      ctx.quadraticCurveTo(w * 0.4, streetY - 4, rockX - 30, streetY + 2)
      ctx.stroke()

      drawStall(w * 0.18, streetY - 2, 0.8, true)
      drawStall(w * 0.32, streetY - 8, 0.7, false)

      // lanterns
      for (const lx of lanterns) {
        const x = w * lx
        const y = h * 0.2 + Math.sin(t * 2 + lx * 8) * 1.2
        const flicker = 0.75 + Math.sin(t * 7 + lx * 18) * 0.15
        ctx.strokeStyle = '#3a2a1c'
        ctx.beginPath()
        ctx.moveTo(x, h * 0.1)
        ctx.lineTo(x, y)
        ctx.stroke()
        const glow = ctx.createRadialGradient(x, y + 6, 1, x, y + 6, 48 * flicker)
        glow.addColorStop(0, `rgba(255,190,90,${0.4 * flicker})`)
        glow.addColorStop(1, 'transparent')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(x, y + 8, 48 * flicker, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = `rgba(255,220,140,${0.85 * flicker})`
        ctx.beginPath()
        ctx.arc(x, y + 2, 3.2, 0, Math.PI * 2)
        ctx.fill()
      }

      for (const e of embers) {
        e.y += e.vy
        e.life += 0.01
        if (e.y < -8) {
          e.y = streetY + 16
          e.x = (e.x + 50) % w
        }
        ctx.fillStyle = `rgba(255,180,80,${e.a * (0.5 + Math.sin(e.life * 3) * 0.5)})`
        ctx.beginPath()
        ctx.arc((e.x + Math.sin(t + e.life) * 6) % w, e.y, e.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // ore / boss — hide briefly mid-walk when transitioning, then show new rock
      const showRock = !walking || walkRef.current < 0.35 || walkRef.current > 0.85
      if (showRock) {
        const hpVis =
          walking && walkRef.current > 0.85 ? 1 : walking && walkRef.current < 0.35 ? 0.05 : hpRef.current
        drawRock(rockX, rockY, hpVis, fighting, bossRef.current)
      }

      // stage label on street
      if (!fighting) {
        ctx.font = '600 11px "Segoe UI", sans-serif'
        ctx.fillStyle = 'rgba(255,230,180,0.75)'
        ctx.fillText(`第 ${stageRef.current} 關 · ${nameRef.current}`, w * 0.08, streetY - 28)
        if (walking) {
          ctx.fillStyle = 'rgba(87,199,178,0.9)'
          ctx.fillText('通關！前往下一關…', heroX - 36, streetY - 40)
        }
      }

      // minecarts
      const cartCount = Math.min(miners, 7)
      for (let i = 0; i < cartCount; i++) {
        const u = (t * 0.07 + i / Math.max(1, cartCount)) % 1
        const x = w * 0.08 + u * (rockX - w * 0.2)
        const y = streetY + 18 - u * 12
        ctx.fillStyle = '#2a3038'
        ctx.fillRect(x - 10, y - 8, 20, 10)
        ctx.fillStyle = '#f0b429'
        ctx.fillRect(x - 6, y - 6, 8, 5)
        ctx.fillStyle = '#1a1c20'
        ctx.beginPath()
        ctx.arc(x - 6, y + 3, 3, 0, Math.PI * 2)
        ctx.arc(x + 6, y + 3, 3, 0, Math.PI * 2)
        ctx.fill()
      }

      drawMiner(heroX, streetY - 6, !walking && !fighting, walkRef.current)

      // sparks
      const sparks = sparksRef.current
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]!
        s.x += s.vx
        s.y += s.vy
        s.vy += 0.1
        s.life -= 0.02
        if (s.life <= 0) {
          sparks.splice(i, 1)
          continue
        }
        ctx.fillStyle = s.warm
          ? `rgba(255,200,80,${s.life})`
          : `rgba(255,140,60,${s.life})`
        ctx.beginPath()
        ctx.arc(s.x, s.y, 2 * s.life + 0.4, 0, Math.PI * 2)
        ctx.fill()
      }

      const vig = ctx.createRadialGradient(w * 0.45, h * 0.4, h * 0.12, w * 0.5, h * 0.5, h * 0.85)
      vig.addColorStop(0, 'transparent')
      vig.addColorStop(1, 'rgba(0,0,0,0.7)')
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, w, h)

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [miners, drillLevel])

  return <canvas ref={canvasRef} className="mine-canvas" aria-label="礦洞街道通關觀測" />
}
