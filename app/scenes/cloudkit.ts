import { BufferAttribute, DataTexture, NearestFilter, RedFormat, type BufferGeometry } from 'three'
import { injectRim, toon } from '../core/toon'
import { G } from '../core/state'
import { blob, merge, rng, range } from '../core/util'

// Clouds keep a lighter toon ramp than solid objects so their shadow side stays soft.
const cloudRamp = (() => {
  const tex = new DataTexture(new Uint8Array([150, 196, 232, 255]), 4, 1, RedFormat)
  tex.minFilter = tex.magFilter = NearestFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
})()

/** A cumulus cluster: noise-displaced icospheres, bigger in the middle, flat-bottomed. */
export function cloudGeometry(seed: number, detail = 2): BufferGeometry {
  const r = rng(seed)
  const parts: BufferGeometry[] = []
  const n = 6 + Math.floor(r() * 6)
  for (let i = 0; i < n; i++) {
    const t = i / n
    const centre = 1 - Math.abs(t - 0.5) * 2
    const rad = 3.2 + centre * 4.5 + r() * 2
    const g = blob(rad, detail, 0.22, seed * 31 + i)
    const x = (t - 0.5) * 22 + range(r, -2, 2)
    const y = centre * 3.5 + range(r, -1, 1.5)
    const z = range(r, -5, 5)
    g.translate(x, y, z)
    parts.push(g)
  }
  const geo = merge(parts)
  // flatten the underside, the classic cumulus base
  const pos = geo.getAttribute('position') as BufferAttribute
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) < -2.2) pos.setY(i, -2.2 + (pos.getY(i) + 2.2) * 0.25)
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

const VERT_PARS = /* glsl */ `
uniform float uWind;
uniform vec3 uPointerRayO;
uniform vec3 uPointerRayD;
uniform float uPointerStrength;
uniform float uPush;
varying float vCamDist;
`

const VERT_MAIN = /* glsl */ `
vec4 wp = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  wp = instanceMatrix * wp;
  float ph = dot(instanceMatrix[3].xyz, vec3(0.013, 0.021, 0.017));
#else
  float ph = 0.0;
#endif
wp = modelMatrix * wp;
// slow billowing, faster when the wind gusts
wp.xyz += vec3(sin(uWind * 0.6 + wp.y * 0.05 + ph), sin(uWind * 0.45 + wp.x * 0.03 + ph) * 0.5, cos(uWind * 0.5 + wp.x * 0.04 + ph)) * 0.9;
// part around the pointer ray
vec3 rel = wp.xyz - uPointerRayO;
float along = max(dot(rel, uPointerRayD), 0.0);
vec3 away = rel - uPointerRayD * along;
float d = length(away);
float radius = 5.0 + along * 0.14;
float push = (1.0 - smoothstep(0.0, radius, d)) * uPointerStrength * uPush * (2.5 + along * 0.05);
wp.xyz += (away / max(d, 1e-3)) * push;
vec4 mvPosition = viewMatrix * wp;
gl_Position = projectionMatrix * mvPosition;
vCamDist = -mvPosition.z;
`

const FRAG_PARS = /* glsl */ `
uniform float uFadeNear;
uniform float uFadeFar;
varying float vCamDist;
float bayer4(vec2 p) {
  ivec2 i = ivec2(mod(p, 4.0));
  int idx = i.x + i.y * 4;
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[idx]) + 0.5) / 16.0;
}
`

const FRAG_MAIN = /* glsl */ `
if (vCamDist < uFadeFar) {
  float a = smoothstep(uFadeNear, uFadeFar, vCamDist);
  if (bayer4(gl_FragCoord.xy) > a) discard;
}
#include <clipping_planes_fragment>
`

/** Toon cloud material: rim light, wind billow, pointer parting, dithered near-camera fade. */
export function cloudMaterial(opts: { push?: number; fadeNear?: number; fadeFar?: number; color?: string; fog?: boolean } = {}) {
  const m = toon(opts.color ?? '#ffffff', { gradientMap: cloudRamp, rim: 1.3, fog: opts.fog ?? true })
  const local = {
    uPush: { value: opts.push ?? 1 },
    uFadeNear: { value: opts.fadeNear ?? 3 },
    uFadeFar: { value: opts.fadeFar ?? 14 },
  }
  m.onBeforeCompile = (shader) => {
    injectRim(shader, 1.3)
    Object.assign(shader.uniforms, local, {
      uWind: G.uWind,
      uPointerRayO: G.uPointerRayO,
      uPointerRayD: G.uPointerRayD,
      uPointerStrength: G.uPointerStrength,
    })
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <project_vertex>', VERT_MAIN)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <clipping_planes_fragment>', FRAG_MAIN)
  }
  m.customProgramCacheKey = () => 'toon-cloud'
  return m
}
