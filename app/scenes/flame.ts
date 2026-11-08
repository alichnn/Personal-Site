import { DoubleSide, InstancedBufferAttribute, InstancedMesh, PlaneGeometry, ShaderMaterial } from 'three'
import { G } from '../core/state'
import { NOISE } from '../core/glsl'

/** Stylised toon flame tongues: upright billboards with three hard colour bands. */
export function makeFlames(count: number, seed = 1) {
  const geo = new PlaneGeometry(1, 1, 1, 1)
  geo.translate(0, 0.5, 0)
  const seeds = new Float32Array(count)
  for (let i = 0; i < count; i++) seeds[i] = ((i * 0.6180339 + seed * 0.37) % 1) * 10
  geo.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1))
  const mat = new ShaderMaterial({
    uniforms: { uTime: G.uTime, uHeat: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      varying vec2 vUv;
      varying float vSeed;
      void main() {
        vUv = uv;
        vSeed = aSeed;
        vec3 centre = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float sx = length(instanceMatrix[0].xyz);
        float sy = length(instanceMatrix[1].xyz);
        // cylindrical billboard: always upright, turned toward the camera
        vec3 toCam = cameraPosition - centre;
        toCam.y = 0.0;
        vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), normalize(toCam + vec3(1e-4, 0.0, 0.0))));
        vec3 wp = centre + right * position.x * sx + vec3(0.0, position.y * sy, 0.0);
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uHeat;
      varying vec2 vUv;
      varying float vSeed;
      ${NOISE}
      void main() {
        float x = (vUv.x - 0.5) * 2.0;
        float y = vUv.y;
        float n = fbm(vec2(x * 1.4 + vSeed * 3.1, y * 2.2 - uTime * 2.6 + vSeed));
        float sway = (n - 0.5) * 0.7 * y + sin(uTime * 3.0 + vSeed + y * 4.0) * 0.08 * y;
        float width = pow(1.0 - y, 0.75) * (0.62 + 0.55 * n);
        float body = width - abs(x + sway) - y * 0.08;
        if (body < 0.0) discard;
        float k = body + (n - 0.5) * 0.12;
        vec3 col = vec3(2.2, 0.42, 0.1);
        col = mix(col, vec3(3.0, 1.15, 0.2), step(0.13, k));
        col = mix(col, vec3(3.4, 2.5, 0.9), step(0.3, k));
        gl_FragColor = vec4(col * uHeat, 1.0);
      }`,
    side: DoubleSide,
    fog: false,
  })
  const mesh = new InstancedMesh(geo, mat, count)
  mesh.frustumCulled = false
  return mesh
}
