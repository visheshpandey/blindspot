// Street furniture and landmark buildings for the suburb. All original, built from primitives.
import * as THREE from 'three'
import { box, cyl, labelSprite, mat, outline } from './townKit'

function place(scene, x, z, rotY = 0) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = rotY
  scene.add(g)
  return g
}

/** Concrete utility poles joined by sagging power lines. */
export function addPowerLine(scene, points) {
  const tops = points.map(([x, z]) => {
    const g = place(scene, x, z)
    cyl(g, 0.05, 0.07, 3.3, '#9aa0a8', [0, 1.65, 0], { segments: 8, outline: 0.02 })
    box(g, [0.9, 0.06, 0.06], '#7b828c', [0, 3.05, 0])
    box(g, [0.22, 0.3, 0.2], '#8f969f', [0.12, 2.55, 0.12], { outline: 0.02 })
    return [new THREE.Vector3(x - 0.38, 3.08, z), new THREE.Vector3(x + 0.38, 3.08, z)]
  })
  const wireMat = new THREE.LineBasicMaterial({ color: '#2b2f45' })
  for (let i = 0; i < tops.length - 1; i += 1) {
    for (let k = 0; k < 2; k += 1) {
      const a = tops[i][k]
      const b = tops[i + 1][k]
      const mid = a.clone().lerp(b, 0.5)
      mid.y -= 0.35
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b)
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(16)), wireMat))
    }
  }
}

export function addVendingMachine(scene, x, z, rotY = 0, color = '#e94b3c') {
  const g = place(scene, x, z, rotY)
  box(g, [0.62, 1.3, 0.48], color, [0, 0.65, 0], { outline: 0.03 })
  box(g, [0.5, 0.62, 0.02], '#dff5ff', [0, 0.9, 0.25], { material: mat('#dff5ff', 0, { emissive: '#bfe9ff', emissiveIntensity: 0.55 }), castShadow: false })
  const colors = ['#ffd23f', '#2ec4b6', '#ff6b5b', '#7a5cc2', '#5fae62']
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 5; c += 1) box(g, [0.06, 0.12, 0.03], colors[(r + c) % colors.length], [-0.18 + c * 0.09, 0.73 + r * 0.17, 0.27], { castShadow: false })
  }
  box(g, [0.36, 0.1, 0.04], '#2b2f45', [0, 0.25, 0.25], { castShadow: false })
  return g
}

export function addPostBox(scene, x, z) {
  const g = place(scene, x, z)
  cyl(g, 0.17, 0.17, 0.75, '#d6342b', [0, 0.45, 0], { segments: 16, outline: 0.03 })
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#d6342b'))
  dome.position.y = 0.82
  g.add(dome)
  box(g, [0.18, 0.03, 0.04], '#2b2f45', [0, 0.65, 0.17], { castShadow: false })
  cyl(g, 0.05, 0.05, 0.1, '#2b2f45', [0, 0.04, 0])
  return g
}

/** The orange curved-mirror pole found at Japanese street corners. */
export function addTrafficMirror(scene, x, z, rotY = 0) {
  const g = place(scene, x, z, rotY)
  cyl(g, 0.035, 0.035, 2.3, '#ff8a3d', [0, 1.15, 0], { segments: 8, outline: 0.015 })
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 24), mat('#ff8a3d'))
  ring.position.set(0, 2.35, 0.08)
  g.add(ring)
  const mirror = new THREE.Mesh(new THREE.CircleGeometry(0.28, 24), new THREE.MeshBasicMaterial({ color: '#d7eefc' }))
  mirror.position.set(0, 2.35, 0.1)
  g.add(mirror)
  return g
}

export function addCar(scene, x, z, rotY = 0, color = '#2ec4b6') {
  const g = place(scene, x, z, rotY)
  g.userData.dynamic = true
  const body = box(g, [0.75, 0.32, 1.4], color, [0, 0.32, 0], { outline: 0.03 })
  box(g, [0.68, 0.32, 0.8], '#f3f7fb', [0, 0.62, -0.08], { outline: 0.03 })
  box(g, [0.7, 0.22, 0.02], '#9fd6f5', [0, 0.63, 0.33], { castShadow: false })
  ;[[-0.38, 0.45], [0.38, 0.45], [-0.38, -0.45], [0.38, -0.45]].forEach(([wx, wz]) => cyl(g, 0.15, 0.15, 0.12, '#2b2f45', [wx, 0.15, wz], { rotation: [0, 0, Math.PI / 2], segments: 12 }))
  box(g, [0.14, 0.08, 0.02], '#fff1b3', [-0.24, 0.36, 0.71], { castShadow: false })
  box(g, [0.14, 0.08, 0.02], '#fff1b3', [0.24, 0.36, 0.71], { castShadow: false })
  return g
}

export function addBench(scene, x, z, rotY = 0) {
  const g = place(scene, x, z, rotY)
  box(g, [1.0, 0.06, 0.32], '#b0794d', [0, 0.4, 0], { outline: 0.02 })
  box(g, [1.0, 0.24, 0.05], '#b0794d', [0, 0.6, -0.15], { outline: 0.02 })
  ;[-0.42, 0.42].forEach((bx) => box(g, [0.05, 0.4, 0.3], '#5a5f70', [bx, 0.2, 0]))
  return g
}

export function addPark(scene, x, z, rotY = 0) {
  const g = place(scene, x, z, rotY)
  box(g, [3.6, 0.06, 2.8], '#e8d7a8', [0, 0.06, 0], { castShadow: false })
  // Slide
  box(g, [0.5, 1.1, 0.5], '#ff6b5b', [-1.1, 0.6, -0.5], { outline: 0.03 })
  box(g, [0.45, 0.05, 1.5], '#ffd23f', [-1.1, 0.58, 0.35], { rotation: [-0.6, 0, 0], outline: 0.02 })
  // Swing set
  ;[-0.2, 1.4].forEach((sx) => box(g, [0.06, 1.5, 0.06], '#2ec4b6', [sx, 0.75, -0.6], { outline: 0.015 }))
  box(g, [1.7, 0.06, 0.06], '#2ec4b6', [0.6, 1.5, -0.6], { outline: 0.015 })
  ;[0.25, 0.95].forEach((sx) => {
    box(g, [0.02, 0.9, 0.02], '#5a5f70', [sx, 1.03, -0.6], { castShadow: false })
    box(g, [0.3, 0.04, 0.16], '#ff8a3d', [sx, 0.58, -0.6])
  })
  // Sandbox
  box(g, [1.1, 0.12, 0.8], '#b0794d', [0.7, 0.12, 0.7], { outline: 0.02 })
  box(g, [0.95, 0.06, 0.65], '#f2e2b0', [0.7, 0.16, 0.7], { castShadow: false })
  return g
}

/** A small neighbourhood police box (koban) with a red lamp: Detective HQ. */
export function addPoliceBox(scene, x, z, rotY = 0, userData = {}) {
  const g = place(scene, x, z, rotY)
  g.userData = userData
  box(g, [2.4, 0.1, 2.2], '#d9d2c3', [0, 0.05, 0.2], { castShadow: false })
  box(g, [1.9, 1.5, 1.6], '#f4f1e6', [0, 0.85, 0], { outline: true })
  box(g, [2.2, 0.16, 1.9], '#2f3b5c', [0, 1.68, 0.05], { outline: 0.03 })
  box(g, [1.3, 0.35, 1.1], '#2f3b5c', [0, 1.92, 0], { outline: 0.03 })
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), mat('#ff3b30', 0, { emissive: '#ff3b30', emissiveIntensity: 0.9 }))
  lamp.position.set(0, 1.45, 0.86)
  outline(lamp, 0.02)
  g.add(lamp)
  box(g, [0.75, 1.0, 0.05], '#a9e4ff', [-0.35, 0.7, 0.81], { castShadow: false })
  box(g, [0.5, 0.5, 0.05], '#a9e4ff', [0.5, 0.95, 0.81], { castShadow: false })
  const sign = labelSprite('DETECTIVE HQ', { bg: '#ffd23f' })
  sign.position.set(0, 2.55, 0.2)
  sign.scale.set(2.3, 0.58, 1)
  g.add(sign)
  return g
}

/** A three-storey school with a clock: the Report Centre. */
export function addSchool(scene, x, z, rotY = 0, userData = {}) {
  const g = place(scene, x, z, rotY)
  g.userData = userData
  box(g, [5.2, 0.1, 2.6], '#d9d2c3', [0, 0.05, 0.4], { castShadow: false })
  box(g, [4.6, 2.5, 1.5], '#f6f1e2', [0, 1.3, 0], { outline: true })
  box(g, [4.8, 0.12, 1.7], '#c9c3b6', [0, 2.6, 0])
  box(g, [1.0, 0.9, 1.3], '#f6f1e2', [0, 3.05, 0], { outline: 0.04 })
  const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 24), mat('#ffffff'))
  clock.rotation.x = Math.PI / 2
  clock.position.set(0, 3.1, 0.68)
  outline(clock, 0.03)
  g.add(clock)
  box(g, [0.03, 0.2, 0.02], '#1f2340', [0, 3.17, 0.72], { castShadow: false })
  box(g, [0.15, 0.03, 0.02], '#1f2340', [0.06, 3.1, 0.72], { castShadow: false })
  const glass = mat('#a9e4ff')
  for (let floor = 0; floor < 3; floor += 1) {
    for (let col = 0; col < 7; col += 1) {
      if (floor === 0 && col === 3) continue
      box(g, [0.42, 0.42, 0.04], '#a9e4ff', [-1.8 + col * 0.6, 0.55 + floor * 0.75, 0.76], { material: glass, castShadow: false })
    }
  }
  box(g, [0.7, 0.75, 0.05], '#7a5c45', [0, 0.45, 0.77], { castShadow: false })
  const sign = labelSprite('REPORT CENTRE', { bg: '#fff8ea' })
  sign.position.set(0, 4.05, 0)
  sign.scale.set(2.5, 0.62, 1)
  g.add(sign)
  return g
}

/** A corner shop with a striped awning and vending machines: the Evidence Lab. */
export function addShop(scene, x, z, rotY = 0, userData = {}) {
  const g = place(scene, x, z, rotY)
  g.userData = userData
  box(g, [3.0, 0.1, 2.4], '#d9d2c3', [0, 0.05, 0.3], { castShadow: false })
  box(g, [2.6, 1.6, 1.8], '#e7f4ff', [0, 0.9, 0], { outline: true })
  box(g, [2.8, 0.2, 2.0], '#2ec4b6', [0, 1.8, 0], { outline: 0.03 })
  for (let i = 0; i < 7; i += 1) {
    const stripe = box(g, [0.37, 0.05, 0.55], i % 2 ? '#ffffff' : '#ff6b5b', [-1.11 + i * 0.37, 1.4, 1.15], { rotation: [0.45, 0, 0], castShadow: false })
    stripe.receiveShadow = false
  }
  box(g, [2.2, 0.9, 0.04], '#cfefff', [0, 0.65, 0.91], { material: mat('#cfefff', 0, { emissive: '#fff1c9', emissiveIntensity: 0.35 }), castShadow: false })
  const sign = labelSprite('EVIDENCE LAB', { bg: '#fff8ea' })
  sign.position.set(0, 2.4, 0.1)
  sign.scale.set(2.3, 0.58, 1)
  g.add(sign)
  const vm = addVendingMachine(g, 1.7, 0.45, 0, '#2f6fd6')
  vm.position.set(1.75, 0, 0.45)
  return g
}

export function addCrosswalk(scene, x, z, rotY = 0) {
  const g = place(scene, x, z, rotY)
  const stripe = new THREE.MeshBasicMaterial({ color: '#f4f1e6' })
  for (let i = 0; i < 5; i += 1) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.9), stripe)
    s.rotation.x = -Math.PI / 2
    s.position.set(-0.4 + i * 0.2, 0.115, 0)
    g.add(s)
  }
  return g
}
