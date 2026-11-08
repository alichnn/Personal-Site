import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  ExtrudeGeometry,
  FrontSide,
  Group,
  Mesh,
  ShaderMaterial,
  Vector3,
  type ColorRepresentation,
} from 'three'
import { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { G } from './state'
import { TOON_BANDS } from './glsl'

// Chunky, toon-shaded 3D lettering (Fredoka SemiBold, extruded), with an inverted-hull outline
// and a per-glyph reveal that scrubs with scroll.

let fontPromise: Promise<Font> | null = null
export function loadFont() {
  fontPromise ??= fetch('/fonts/fredoka.json')
    .then((r) => r.json())
    .then((json) => new Font(json))
  return fontPromise
}

export interface LetteringStyle {
  /** Fill colour. */
  color: ColorRepresentation
  outline: ColorRepresentation
  /** Self-light added on top of the scene lighting (night glow, firelight warmth). */
  emissive?: ColorRepresentation
  emissiveIntensity?: number
  /** 0 = flat colour, 1 = fully lit by the scene's sun/sky/fire. */
  lit?: number
  /** Outline thickness as a fraction of the font size. */
  outlineWidth?: number
  /** Extrusion depth as a fraction of the font size. */
  depth?: number
}

export interface LetteringLayout {
  /** Font size in world units. */
  size: number
  /** Wrap width in world units (no wrapping when omitted). */
  maxWidth?: number
  lineHeight?: number
  align?: 'left' | 'center' | 'right'
  /** Which point of the block sits at the group's origin. */
  anchorX?: 'left' | 'center' | 'right'
  anchorY?: 'top' | 'middle' | 'bottom'
}

const VERT = /* glsl */ `
attribute float aGlyph;
attribute vec3 aCenter;
uniform float uIn;
uniform float uOut;
uniform float uSpread;
uniform float uMotion;
uniform float uSize;
uniform float uThickness;
uniform float uTime;
varying vec3 vN;
varying vec3 vWorld;
varying float vA;
void main() {
  float kIn = clamp(uIn * (1.0 + uSpread) - aGlyph * uSpread, 0.0, 1.0);
  float kOut = clamp(uOut * (1.0 + uSpread) - aGlyph * uSpread, 0.0, 1.0);
  kIn = kIn * kIn * (3.0 - 2.0 * kIn);
  kOut = kOut * kOut * (3.0 - 2.0 * kOut);
  float scale = mix(1.0, mix(0.55, 1.0, kIn) * mix(1.0, 0.85, kOut), uMotion);
  float dy = ((1.0 - kIn) * -0.7 + kOut * 0.6) * uSize * uMotion;
  dy += sin(uTime * 1.1 + aGlyph * 9.0) * uSize * 0.035 * uMotion;
  // outline hull: grow sideways only and sit just behind the letter, so it frames the
  // silhouette without ever folding through the front face at concave corners
  vec3 off = vec3(0.0);
  if (uThickness > 0.0) {
    float l = length(normal.xy);
    off = vec3(l > 1e-4 ? normal.xy / l : vec2(0.0), -1.0) * uThickness;
  }
  vec3 p = aCenter + (position + off - aCenter) * scale + vec3(0.0, dy, 0.0);
  vA = kIn * (1.0 - kOut);
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
}`

const FILL_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uEmissive;
uniform float uLit;
uniform float uGlow;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyAmb;
uniform vec3 uGroundAmb;
uniform vec3 uFirePos;
uniform vec3 uFireColor;
uniform float uFireIntensity;
uniform vec3 uRimColor;
uniform float uRimStrength;
varying vec3 vN;
varying vec3 vWorld;
varying float vA;
${TOON_BANDS}
void main() {
  if (vA < 0.004) discard;
  vec3 N = normalize(vN);
  // wrapped, banded sunlight so the faces toward the camera never go muddy
  float sun = toonBand(clamp(0.5 + 0.5 * dot(N, normalize(uSunDir)), 0.0, 1.0)) * smoothstep(-0.05, 0.15, uSunDir.y);
  vec3 amb = mix(uGroundAmb, uSkyAmb, N.y * 0.5 + 0.5) * 1.6;
  vec3 toF = uFirePos - vWorld;
  float fire = uFireIntensity * 3.0 / (1.0 + dot(toF, toF) * 0.04);
  fire = floor(clamp(fire, 0.0, 1.5) * 4.0) / 4.0;
  vec3 light = amb + uSunColor * sun * 0.75 + uFireColor * fire;
  vec3 col = uColor * mix(vec3(1.0), clamp(light, 0.0, 1.0), uLit);
  vec3 V = normalize(cameraPosition - vWorld);
  float rim = smoothstep(0.6, 0.8, 1.0 - clamp(dot(N, V), 0.0, 1.0));
  col += uRimColor * rim * uRimStrength * 0.6;
  col += uEmissive * (1.0 + uGlow);
  gl_FragColor = vec4(col, vA);
}`

const HULL_FRAG = /* glsl */ `
uniform vec3 uOutline;
varying float vA;
void main() {
  if (vA < 0.004) discard;
  gl_FragColor = vec4(uOutline, vA);
}`

export class Lettering {
  readonly group = new Group()
  /** Block size in world units (after layout). */
  width = 0
  height = 0
  private fill: Mesh
  private hull: Mesh
  private fillMat: ShaderMaterial
  private hullMat: ShaderMaterial

  constructor(
    private font: Font,
    private text: string,
    private style: LetteringStyle,
    layout: LetteringLayout,
  ) {
    const shared = {
      uIn: { value: 0 },
      uOut: { value: 0 },
      uSpread: { value: 2.5 },
      uMotion: { value: 1 },
      uSize: { value: layout.size },
      uTime: G.uTime,
    }
    this.fillMat = new ShaderMaterial({
      uniforms: {
        ...shared,
        uThickness: { value: 0 },
        uColor: { value: new Color(style.color) },
        uEmissive: { value: new Color(style.emissive ?? '#000000').multiplyScalar(style.emissiveIntensity ?? 1) },
        uLit: { value: style.lit ?? 0.7 },
        uGlow: { value: 0 },
        uSunDir: G.uSunDir, uSunColor: G.uSunColor, uSkyAmb: G.uSkyAmb, uGroundAmb: G.uGroundAmb,
        uFirePos: G.uFirePos, uFireColor: G.uFireColor, uFireIntensity: G.uFireIntensity,
        uRimColor: G.uRimColor, uRimStrength: G.uRimStrength,
      },
      vertexShader: VERT,
      fragmentShader: FILL_FRAG,
      transparent: true,
      side: FrontSide,
    })
    this.hullMat = new ShaderMaterial({
      uniforms: {
        ...shared,
        uThickness: { value: layout.size * (style.outlineWidth ?? 0.06) },
        uOutline: { value: new Color(style.outline) },
      },
      vertexShader: VERT,
      fragmentShader: HULL_FRAG,
      transparent: true,
      side: BackSide,
    })
    this.fill = new Mesh(new BufferGeometry(), this.fillMat)
    this.hull = new Mesh(new BufferGeometry(), this.hullMat)
    for (const m of [this.fill, this.hull]) {
      m.frustumCulled = false
      m.raycast = () => {}
    }
    this.hull.renderOrder = 4
    this.fill.renderOrder = 5
    this.group.add(this.hull, this.fill)
    this.layout(layout)
  }

  /** (Re)build the geometry for a new size or wrap width. */
  layout(l: LetteringLayout) {
    const { font, text } = this
    const data = font.data as unknown as { resolution: number; glyphs: Record<string, { ha: number }> }
    const k = l.size / data.resolution
    const adv = (ch: string) => (data.glyphs[ch] ?? data.glyphs['?']!).ha * k
    const space = adv(' ')
    const lineH = l.size * (l.lineHeight ?? 1.18)

    // greedy word wrap
    const lines: string[][] = [[]]
    let lineW = 0
    for (const word of text.split(/\s+/)) {
      const w = [...word].reduce((a, c) => a + adv(c), 0)
      const cur = lines[lines.length - 1]!
      if (l.maxWidth && cur.length && lineW + space + w > l.maxWidth) {
        lines.push([word])
        lineW = w
      } else {
        lineW += (cur.length ? space : 0) + w
        cur.push(word)
      }
    }

    const glyphs: BufferGeometry[] = []
    const total = [...text.replace(/\s+/g, '')].length
    let gi = 0
    let maxW = 0
    const widths = lines.map((ws) => ws.reduce((a, w, i) => a + [...w].reduce((s, c) => s + adv(c), 0) + (i ? space : 0), 0))
    const blockW = Math.max(...widths)
    lines.forEach((words, li) => {
      const w = widths[li]!
      maxW = Math.max(maxW, w)
      const align = l.align ?? 'center'
      let x = align === 'left' ? 0 : align === 'right' ? blockW - w : (blockW - w) / 2
      const y = -li * lineH
      words.forEach((word, wi) => {
        if (wi) x += space
        for (const ch of word) {
          const shapes = font.generateShapes(ch, l.size)
          if (shapes.length) {
            const g = new ExtrudeGeometry(shapes, {
              depth: l.size * (this.style.depth ?? 0.22),
              bevelEnabled: true,
              bevelThickness: l.size * 0.035,
              bevelSize: l.size * 0.02,
              bevelSegments: 1,
              curveSegments: 4,
            })
            g.translate(x, y, 0)
            g.computeBoundingBox()
            const c = g.boundingBox!.getCenter(new Vector3())
            const n = g.getAttribute('position').count
            g.setAttribute('aGlyph', new BufferAttribute(new Float32Array(n).fill(gi / Math.max(1, total - 1)), 1))
            g.setAttribute('aCenter', new BufferAttribute(new Float32Array(n * 3).map((_, i) => [c.x, c.y, c.z][i % 3]!), 3))
            g.deleteAttribute('uv')
            glyphs.push(g)
          }
          x += adv(ch)
          gi++
        }
      })
    })

    const geo = glyphs.length ? mergeGeometries(glyphs, false)! : new BufferGeometry()
    glyphs.forEach((g) => g.dispose())
    // anchor the block
    this.width = blockW
    this.height = lineH * (lines.length - 1) + l.size * 0.72
    const ax = l.anchorX ?? 'center', ay = l.anchorY ?? 'middle'
    const ox = ax === 'left' ? 0 : ax === 'right' ? -blockW : -blockW / 2
    const capTop = l.size * 0.72
    const oy = ay === 'top' ? -capTop : ay === 'bottom' ? this.height - capTop : this.height / 2 - capTop
    geo.translate(ox, oy, 0)
    const centers = geo.getAttribute('aCenter') as BufferAttribute | undefined
    if (centers) {
      for (let i = 0; i < centers.count; i++) centers.setXYZ(i, centers.getX(i) + ox, centers.getY(i) + oy, centers.getZ(i))
    }

    // outline hull: welded, smoothed normals so the extruded edges don't crack
    let hullGeo = new BufferGeometry()
    if (glyphs.length) {
      const src = new BufferGeometry()
      src.setAttribute('position', geo.getAttribute('position'))
      src.setAttribute('aGlyph', geo.getAttribute('aGlyph'))
      src.setAttribute('aCenter', geo.getAttribute('aCenter'))
      hullGeo = mergeVertices(src, l.size * 0.002)
      hullGeo.computeVertexNormals()
    }
    this.fill.geometry.dispose()
    this.hull.geometry.dispose()
    this.fill.geometry = geo
    this.hull.geometry = hullGeo
    for (const m of [this.fillMat, this.hullMat]) m.uniforms.uSize!.value = l.size
    this.hullMat.uniforms.uThickness!.value = l.size * (this.style.outlineWidth ?? 0.06)
  }

  /** inAmt: 0→1 as the block appears; outAmt: 0→1 as it leaves. */
  setReveal(inAmt: number, outAmt: number, motion = true) {
    for (const m of [this.fillMat, this.hullMat]) {
      m.uniforms.uIn!.value = inAmt
      m.uniforms.uOut!.value = outAmt
      m.uniforms.uMotion!.value = motion ? 1 : 0
    }
    this.group.visible = inAmt > 0.001 && outAmt < 0.999
  }

  set glow(v: number) {
    this.fillMat.uniforms.uGlow!.value = v
  }
}
