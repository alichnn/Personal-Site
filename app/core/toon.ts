import {
  BackSide,
  BufferGeometry,
  Color,
  DataTexture,
  Mesh,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  type ColorRepresentation,
  type MeshToonMaterialParameters,
  type WebGLProgramParametersWithUniforms,
} from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { G } from './state'

/** Four-step ramp shared by every toon surface in the world. */
export const gradientMap = (() => {
  const tex = new DataTexture(new Uint8Array([72, 138, 200, 255]), 4, 1, RedFormat)
  tex.minFilter = NearestFilter
  tex.magFilter = NearestFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
})()

/** GLSL injected into toon fragment shaders: a hard-edged rim light driven by the global rig. */
const RIM_PARS = /* glsl */ `
uniform vec3 uRimColor;
uniform float uRimStrength;
uniform float uRimAmt;
`
const RIM_MAIN = /* glsl */ `
{
  float facing = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
  float rim = smoothstep(0.62, 0.8, 1.0 - facing);
  outgoingLight += uRimColor * rim * uRimStrength * uRimAmt * (0.45 + 0.55 * diffuseColor.rgb);
}
#include <opaque_fragment>
`

export interface ToonOptions extends MeshToonMaterialParameters {
  /** Rim light multiplier (0 disables). */
  rim?: number
}

/** Adds the rim light to a shader inside onBeforeCompile. */
export function injectRim(shader: WebGLProgramParametersWithUniforms, rim: number) {
  shader.uniforms.uRimColor = G.uRimColor
  shader.uniforms.uRimStrength = G.uRimStrength
  shader.uniforms.uRimAmt = { value: rim }
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${RIM_PARS}`)
    .replace('#include <opaque_fragment>', RIM_MAIN)
}

export function toon(color: ColorRepresentation, opts: ToonOptions = {}) {
  const { rim = 1, ...params } = opts
  const m = new MeshToonMaterial({ color, gradientMap, ...params })
  m.onBeforeCompile = (shader) => injectRim(shader, rim)
  m.customProgramCacheKey = () => 'toon-rim'
  return m
}

const outlineCache = new Map<string, ShaderMaterial>()

function outlineMaterial(thickness: number, color: ColorRepresentation) {
  const key = `${thickness}|${new Color(color).getHexString()}`
  let m = outlineCache.get(key)
  if (m) return m
  m = new ShaderMaterial({
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      { uThickness: { value: thickness }, uColor: { value: new Color(color) } },
    ]),
    vertexShader: /* glsl */ `
      uniform float uThickness;
      #include <common>
      #include <fog_pars_vertex>
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position + normal * uThickness, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      #include <common>
      #include <fog_pars_fragment>
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
        #include <fog_fragment>
      }`,
    side: BackSide,
    fog: true,
  })
  outlineCache.set(key, m)
  return m
}

/**
 * Inverted-hull outline. Uses welded, smoothed normals so flat-shaded low-poly
 * geometry doesn't crack open at its hard edges.
 */
export function addOutline(mesh: Mesh, thickness = 0.03, color: ColorRepresentation = '#24160f') {
  const src = new BufferGeometry()
  src.setAttribute('position', mesh.geometry.getAttribute('position'))
  if (mesh.geometry.index) src.setIndex(mesh.geometry.index)
  const welded = mergeVertices(src, 1e-3)
  welded.computeVertexNormals()
  const hull = new Mesh(welded, outlineMaterial(thickness, color))
  hull.raycast = () => {}
  hull.name = 'outline'
  mesh.add(hull)
  return hull
}

/** Outline every toon mesh under a group. */
export function outlineAll(root: { traverse: (cb: (o: any) => void) => void }, thickness = 0.03, color?: ColorRepresentation) {
  const meshes: Mesh[] = []
  root.traverse((o) => {
    if (o.isMesh && o.name !== 'outline' && !o.userData.noOutline) meshes.push(o)
  })
  for (const m of meshes) addOutline(m, thickness, color)
}
