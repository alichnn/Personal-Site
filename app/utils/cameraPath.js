import * as THREE from 'three'

export function buildCameraPath() {
  const pathPoints = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(2, 1, -16),
    new THREE.Vector3(-2, 0.5, -34),
    new THREE.Vector3(1, -0.5, -50),
    new THREE.Vector3(-1, -1, -66),
    new THREE.Vector3(2, -0.5, -82),
    new THREE.Vector3(0, -2, -98),
    new THREE.Vector3(-2, -3, -114),
    new THREE.Vector3(1, 0, -130),
    new THREE.Vector3(0, 1, -146),
  ]
  return new THREE.CatmullRomCurve3(pathPoints, false, 'catmullrom', 0.5)
}
