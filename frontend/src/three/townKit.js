// Shared three.js building blocks for every Detective Town scene (overview, analyzing, report).
// Look: a cel-shaded Japanese suburb with ink outlines, so the 3D world matches the UI's 3px ink strokes.
// Everything here is original geometry built from primitives; no external models or character assets.
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { isDev } from '../config/env'

const INK = '#1f2340'

function frozen(node, root) {
  for (let n = node; n && n !== root; n = n.parent) if (n.userData?.pick || n.userData?.dynamic) return false
  return true
}

/**
 * Merges every static mesh under `root` into one mesh per material (in root's local space).
 * Clickable groups (userData.pick) and animated objects (userData.dynamic) are left alone;
 * call this again on each clickable group to merge inside it. Turns ~1500 draw calls into a few dozen.
 */
export function mergeStatic(root) {
  root.updateMatrixWorld(true)
  const toLocal = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const buckets = new Map()
  const merged = new Set()
  root.traverse((o) => {
    if (!o.isMesh || o === root || !frozen(o, root)) return
    const m = o.material
    if (Array.isArray(m) || m.isShaderMaterial || m.transparent) return
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
    Object.keys(g.attributes).forEach((name) => { if (name !== 'position' && name !== 'normal') g.deleteAttribute(name) })
    if (!g.attributes.normal) g.computeVertexNormals()
    g.morphAttributes = {}
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toLocal, o.matrixWorld))
    const key = `${m.uuid}|${o.castShadow ? 1 : 0}`
    if (!buckets.has(key)) buckets.set(key, { material: m, cast: o.castShadow, receive: o.receiveShadow, geos: [] })
    buckets.get(key).geos.push(g)
    merged.add(o)
  })
  merged.forEach((o) => {
    // Keep anything under a merged mesh that wasn't merged itself (sprites, lines, dynamic parts).
    ;[...o.children].forEach((child) => { if (!merged.has(child)) o.parent ? o.parent.attach(child) : root.attach(child) })
  })
  merged.forEach((o) => { o.parent?.remove(o) })
  buckets.forEach(({ material, cast, receive, geos }) => {
    const geometry = mergeGeometries(geos, false)
    geos.forEach((g) => g.dispose())
    if (!geometry) return
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = cast
    mesh.receiveShadow = receive
    mesh.userData.merged = true
    root.add(mesh)
  })
}

let toonRamp = null
function ramp() {
  if (toonRamp) return toonRamp
  // Three light bands give the flat, anime-style shading.
  toonRamp = new THREE.DataTexture(new Uint8Array([90, 175, 255]), 3, 1, THREE.RedFormat)
  toonRamp.minFilter = THREE.NearestFilter
  toonRamp.magFilter = THREE.NearestFilter
  toonRamp.needsUpdate = true
  return toonRamp
}

const TOON_KEYS = new Set(['emissive', 'emissiveIntensity', 'transparent', 'opacity', 'side', 'depthWrite', 'map'])
function toonOpts(opts) {
  return Object.fromEntries(Object.entries(opts).filter(([k]) => TOON_KEYS.has(k)))
}

const materialCache = new Map()
/** Shared cel-shaded material, cached by colour + options. Do not mutate; use ownMat for per-object changes. */
export function mat(color, _roughness, extra = {}) {
  const key = `${color}|${JSON.stringify(extra)}`
  if (!materialCache.has(key)) materialCache.set(key, new THREE.MeshToonMaterial({ color, gradientMap: ramp(), ...toonOpts(extra) }))
  return materialCache.get(key)
}

/** A material that each object owns, so it can be recoloured or animated on its own. */
export function ownMat(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: ramp(), ...toonOpts(opts) })
}

const outlineMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })
/** Inverted-hull ink outline. Cheap and reads like a pen stroke at diorama scale. */
export function outline(mesh, thickness = 0.045) {
  mesh.geometry.computeBoundingBox()
  const size = new THREE.Vector3()
  mesh.geometry.boundingBox.getSize(size)
  const shell = new THREE.Mesh(mesh.geometry, outlineMat)
  shell.scale.set(1 + thickness / Math.max(size.x, 0.05) * 2, 1 + thickness / Math.max(size.y, 0.05) * 2, 1 + thickness / Math.max(size.z, 0.05) * 2)
  shell.castShadow = false
  shell.receiveShadow = false
  shell.userData.isOutline = true
  mesh.add(shell)
  return mesh
}

export function box(parent, size, color, position, opts = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), opts.material || mat(color))
  mesh.position.set(...position)
  mesh.castShadow = opts.castShadow !== false
  mesh.receiveShadow = true
  if (opts.rotation) mesh.rotation.set(...opts.rotation)
  if (opts.outline) outline(mesh, opts.outline === true ? 0.045 : opts.outline)
  parent.add(mesh)
  return mesh
}

export function cyl(parent, rTop, rBottom, height, color, position, opts = {}) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, height, opts.segments || 12), opts.material || mat(color))
  mesh.position.set(...position)
  mesh.castShadow = opts.castShadow !== false
  mesh.receiveShadow = true
  if (opts.rotation) mesh.rotation.set(...opts.rotation)
  if (opts.outline) outline(mesh, opts.outline === true ? 0.04 : opts.outline)
  parent.add(mesh)
  return mesh
}

export function labelSprite(text, { bg = '#fff8ea', ink = INK, width = 512, height = 128, font = 42 } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = bg
  ctx.strokeStyle = ink
  ctx.lineWidth = 9
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(8, 8, width - 16, height - 16, 26)
  else ctx.rect(8, 8, width - 16, height - 16)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = ink
  ctx.font = `800 ${font}px "Baloo 2", "Nunito", Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, width / 2, height / 2 + 3, width - 60)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }))
  sprite.scale.set(3.1, 0.78, 1)
  return sprite
}

function windowUnit(parent, x, y, z, glassMaterial, { w = 0.62, h = 0.6, shutter = false } = {}) {
  box(parent, [w + 0.1, h + 0.1, 0.08], '#fdfaf0', [x, y, z], { castShadow: false })
  const glass = box(parent, [w, h, 0.04], '#9ee3ff', [x, y, z + 0.045], { material: glassMaterial, castShadow: false })
  box(parent, [0.04, h, 0.06], '#fdfaf0', [x, y, z + 0.06], { castShadow: false })
  if (shutter) box(parent, [w + 0.12, 0.12, 0.14], '#8b93a7', [x, y + h / 2 + 0.1, z + 0.05], { castShadow: false })
  return glass
}

const FUTONS = ['#ff9fb2', '#9ad0ff', '#ffe08a', '#b6e3b0']

/**
 * A two-storey Japanese suburban house: ground floor with a sliding genkan door, a narrower upper floor
 * with a balcony (and sometimes a futon airing), a tiled hip roof, and a block-wall front yard with a gate.
 * Returns { group, wallMat, roofMat, glassMat, doorMat, door, height, depth, width, anchors }.
 */
export function createBuilding(config) {
  const group = new THREE.Group()
  group.position.set(config.x, 0, config.z)
  if (config.rotationY) group.rotation.y = config.rotationY
  group.userData = { ...config.userData }
  const w = config.width || 2.65
  const d = config.depth || 2.2
  const h1 = config.storey || 1.15
  const h2 = config.storey2 ?? 1.0
  const base = 0.12
  const wallMat = ownMat(config.wall)
  const roofMat = ownMat(config.roof)
  const glassMat = ownMat(config.window || '#a9e4ff', { emissive: '#000000' })
  const doorMat = ownMat(config.door || '#c58b5e')
  const seed = Math.abs(Math.round((config.x * 13 + config.z * 7) * 10))

  // Yard slab and block wall with a gate gap in front.
  box(group, [w + 1.1, 0.1, d + 1.5], '#d9d2c3', [0, 0.05, 0.35], { castShadow: false })
  const wallH = 0.42
  const yardFront = d / 2 + 1.05
  ;[[-1, (w + 1.1) / 2 - 0.45], [1, (w + 1.1) / 2 - 0.45]].forEach(([side, len]) => {
    box(group, [len, wallH, 0.14], '#c9c3b6', [side * ((w + 1.1) / 2 - len / 2), wallH / 2 + 0.1, yardFront], { outline: 0.03 })
  })
  ;[-1, 1].forEach((side) => box(group, [0.14, wallH, d + 1.4], '#c9c3b6', [side * ((w + 1.1) / 2 - 0.07), wallH / 2 + 0.1, 0.35], { outline: 0.03 }))
  // Mailbox on the gate post.
  box(group, [0.16, 0.2, 0.12], '#d94b3d', [0.55, wallH + 0.22, yardFront], { outline: 0.02 })

  // Ground floor.
  box(group, [w, h1, d], config.wall, [0, base + h1 / 2, 0], { material: wallMat, outline: true })
  // Eave between floors (the classic two-tier silhouette).
  box(group, [w + 0.34, 0.1, d + 0.34], config.roof, [0, base + h1 + 0.02, 0], { material: roofMat, outline: 0.03 })
  // Upper floor, set back a little.
  const uw = w * 0.86
  const ud = d * 0.78
  const upperZ = -d * 0.08
  if (h2 > 0) box(group, [uw, h2, ud], config.wall, [0, base + h1 + 0.07 + h2 / 2, upperZ], { material: wallMat, outline: true })
  const topY = base + h1 + 0.07 + h2
  // Hip roof: a four-sided cone stretched to the floor plan.
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1, 0.9, 4), roofMat)
  roof.rotation.y = Math.PI / 4
  roof.scale.set((uw + 0.5) * 0.72, 1, (ud + 0.5) * 0.72)
  roof.position.set(0, topY + 0.45, upperZ)
  roof.castShadow = true
  outline(roof, 0.05)
  group.add(roof)
  // Ridge tiles.
  box(group, [0.1, 0.08, 0.1], '#3d4660', [0, topY + 0.9, upperZ], { castShadow: false })

  // Front details: sliding door, windows, little porch light.
  const front = d / 2 + 0.04
  const door = box(group, [0.62, 0.86, 0.06], config.door || '#c58b5e', [-0.55, base + 0.43, front], { material: doorMat })
  box(group, [0.03, 0.86, 0.08], '#fdfaf0', [-0.55, base + 0.43, front + 0.01], { castShadow: false })
  box(group, [0.78, 0.07, 0.3], config.roof, [-0.55, base + 0.95, front + 0.12], { material: roofMat })
  box(group, [0.1, 0.1, 0.06], '#fff1b3', [-0.98, base + 0.78, front + 0.02], { material: mat('#fff1b3', 0, { emissive: '#ffe08a', emissiveIntensity: 0.5 }), castShadow: false })
  windowUnit(group, 0.55, base + 0.62, front, glassMat, { w: 0.8, h: 0.55, shutter: true })
  if (h2 > 0) {
    const upFront = upperZ + ud / 2 + 0.04
    windowUnit(group, -uw * 0.22, base + h1 + 0.6, upFront, glassMat, { w: 0.62, h: 0.5 })
    windowUnit(group, uw * 0.22, base + h1 + 0.6, upFront, glassMat, { w: 0.62, h: 0.5 })
    // Balcony with railing bars.
    const balconyZ = upFront + 0.22
    box(group, [uw * 0.8, 0.05, 0.42], '#e9e4d8', [0, base + h1 + 0.1, balconyZ - 0.05], { castShadow: false })
    box(group, [uw * 0.8, 0.04, 0.04], '#8b93a7', [0, base + h1 + 0.42, balconyZ + 0.14], { castShadow: false })
    for (let i = 0; i < 7; i += 1) box(group, [0.025, 0.3, 0.025], '#8b93a7', [-uw * 0.38 + (i * uw * 0.76) / 6, base + h1 + 0.27, balconyZ + 0.14], { castShadow: false })
    if (seed % 3 !== 0) box(group, [0.55, 0.36, 0.05], FUTONS[seed % FUTONS.length], [uw * 0.12, base + h1 + 0.3, balconyZ + 0.17], { castShadow: false })
  }

  if (config.sign) {
    const sign = labelSprite(config.sign, { bg: '#fff8ea' })
    sign.position.set(0, topY + 1.35, upperZ)
    sign.scale.set(2.3, 0.58, 1)
    group.add(sign)
  }
  // Garden shrub.
  const shrub = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), mat('#5fae62'))
  shrub.position.set(w / 2 + 0.05, 0.32, d / 2 + 0.55)
  shrub.scale.y = 0.8
  shrub.castShadow = true
  outline(shrub, 0.03)
  group.add(shrub)

  const height = topY
  return {
    group, wallMat, roofMat, glassMat, doorMat, door, height, depth: d, width: w,
    anchors: {
      top: topY + 1.25,
      webLeft: new THREE.Vector3(-w / 2 + 0.02, base + h1 - 0.02, d / 2 + 0.06),
      webRight: new THREE.Vector3(w / 2 - 0.02, base + h1 - 0.02, d / 2 + 0.06),
      door: new THREE.Vector3(-0.55, base + 0.5, front + 0.08),
      tag: new THREE.Vector3(0, 0.6, yardFront + 0.55),
    },
  }
}

export function addTree(scene, x, z, scale = 1, variant = 0) {
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  const trunk = cyl(group, 0.11 * scale, 0.16 * scale, 0.95 * scale, '#9a6a45', [0, 0.47 * scale, 0], { segments: 8, outline: 0.025 })
  trunk.castShadow = true
  const colors = ['#5fae62', '#7cc66b', '#4f9d5b', '#ffb7c5']
  const leafMat = mat(colors[variant % colors.length])
  ;[[0, 1.25, 0, 0.58], [-0.34, 1.08, 0.08, 0.43], [0.34, 1.12, 0.02, 0.46], [0, 1.6, -0.02, 0.43]].forEach(([lx, ly, lz, r]) => {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(r * scale, 12, 9), leafMat)
    leaf.position.set(lx * scale, ly * scale, lz * scale)
    leaf.castShadow = true
    outline(leaf, 0.035)
    group.add(leaf)
  })
  scene.add(group)
  return group
}

export function addCloud(scene, x, y, z, scale = 1) {
  const group = new THREE.Group()
  group.position.set(x, y, z)
  group.userData.dynamic = true
  const cloudMat = new THREE.MeshBasicMaterial({ color: '#ffffff' })
  ;[[-0.45, 0, 0, 0.38], [0, 0.16, 0, 0.52], [0.48, 0, 0, 0.34], [0.08, -0.08, 0.08, 0.36]].forEach(([cx, cy, cz, r]) => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(r * scale, 14, 10), cloudMat)
    puff.position.set(cx * scale, cy * scale, cz * scale)
    group.add(puff)
  })
  scene.add(group)
  return group
}

/** A flat asphalt road along a curve, with a dashed centre line laid along its tangent. */
export function addRoad(scene, points, { width = 0.95 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0.095, z)))
  const steps = 90
  const verts = []
  const idx = []
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const p = curve.getPoint(t)
    const tan = curve.getTangent(t)
    const nx = -tan.z
    const nz = tan.x
    verts.push(p.x + nx * width / 2, 0.095, p.z + nz * width / 2, p.x - nx * width / 2, 0.095, p.z - nz * width / 2)
    if (i < steps) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  const road = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: '#5a5f70', gradientMap: ramp(), side: THREE.DoubleSide }))
  road.receiveShadow = true
  scene.add(road)
  const dashMat = new THREE.MeshBasicMaterial({ color: '#f4f1e6' })
  for (let i = 1; i < 30; i += 1) {
    const t = i / 30
    const p = curve.getPoint(t)
    const tan = curve.getTangent(t)
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.28), dashMat)
    dash.rotation.x = -Math.PI / 2
    dash.rotation.z = -Math.atan2(tan.x, tan.z)
    dash.position.set(p.x, 0.11, p.z)
    scene.add(dash)
  }
  return curve
}

export function addIsland(scene, radius = 10.4) {
  const base = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius + 0.45, 0.72, 72), mat('#c99a63'))
  base.position.y = -0.58
  base.receiveShadow = true
  outline(base, 0.06)
  scene.add(base)
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(radius - 0.17, radius - 0.17, 0.25, 72), mat('#8fd07e'))
  grass.position.y = -0.1
  grass.receiveShadow = true
  scene.add(grass)
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(radius - 0.55, radius - 0.55, 0.06, 72), mat('#a5df8e'))
  inner.position.y = 0.04
  inner.receiveShadow = true
  scene.add(inner)
  for (let i = 0; i < 32; i += 1) {
    const angle = (i / 32) * Math.PI * 2
    const flower = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat(['#ffd23f', '#ff6b5b', '#ffb7c5'][i % 3]))
    flower.position.set(Math.cos(angle) * (radius - 1.0), 0.12, Math.sin(angle) * (radius - 1.0))
    scene.add(flower)
  }
}

function addSky(scene) {
  const geo = new THREE.SphereGeometry(80, 24, 16)
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color('#7cc3f2') }, horizon: { value: new THREE.Color('#e4f5ff') }, glow: { value: new THREE.Color('#fff1c9') } },
    vertexShader: 'varying vec3 vPos; void main(){ vPos = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 horizon; uniform vec3 glow; varying vec3 vPos; void main(){ float h = clamp(vPos.y*1.4,0.0,1.0); vec3 c = mix(horizon, top, pow(h,0.7)); float s = pow(max(dot(vPos, normalize(vec3(-0.4,0.35,0.5))),0.0), 12.0); gl_FragColor = vec4(c + glow*s*0.6, 1.0); }',
  })
  const sky = new THREE.Mesh(geo, material)
  sky.renderOrder = -1
  scene.add(sky)
  return sky
}

/**
 * Creates renderer, scene, camera, lights and orbit controls inside `host`.
 * Performance budget: one shadow-casting light, 1024 shadow map, pixel ratio capped at 2.
 */
export function createStage(host, { reducedMotion = false, autoRotate = true, camera: camPos = [15.5, 17.2, 19.2], target = [0, 0.6, 0], minDistance = 12, maxDistance = 30, enableZoom = true, viewShift = 0 } = {}) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#cfeeff')
  scene.fog = new THREE.Fog('#dff3ff', 34, 70)
  addSky(scene)
  const camera = new THREE.PerspectiveCamera(34, host.clientWidth / Math.max(host.clientHeight, 1), 0.1, 200)
  camera.position.set(...camPos)
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(host.clientWidth, host.clientHeight)
  // viewShift moves the picture sideways (fraction of width) so overlaid UI doesn't cover the subject.
  const applyShift = (w, h) => { if (viewShift && w > 760) camera.setViewOffset(w, h, -w * viewShift, 0, w, h); else camera.clearViewOffset() }
  applyShift(host.clientWidth, host.clientHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.domElement.setAttribute('aria-hidden', 'true')
  host.appendChild(renderer.domElement)
  if (isDev) window.__blindspotRenderers = [...(window.__blindspotRenderers || []), renderer]

  scene.add(new THREE.HemisphereLight('#f2fbff', '#86a873', 1.9))
  const sun = new THREE.DirectionalLight('#fff3d6', 2.6)
  sun.position.set(-9, 18, 11)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16 })
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.02
  scene.add(sun)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = !reducedMotion
  controls.dampingFactor = 0.07
  controls.enablePan = false
  controls.enableZoom = enableZoom
  controls.minDistance = minDistance
  controls.maxDistance = maxDistance
  controls.minPolarAngle = 0.55
  controls.maxPolarAngle = 1.25
  controls.target.set(...target)
  controls.autoRotate = autoRotate && !reducedMotion
  controls.autoRotateSpeed = 0.35
  controls.update()

  let visible = true
  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting })
  io.observe(host)
  const ro = new ResizeObserver(() => {
    const { clientWidth: w, clientHeight: h } = host
    if (!w || !h) return
    camera.aspect = w / h
    applyShift(w, h)
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  })
  ro.observe(host)

  let frame = 0
  const clock = new THREE.Clock()
  const start = (tick) => {
    const loop = () => {
      frame = requestAnimationFrame(loop)
      if (!visible || document.hidden) return
      const dt = Math.min(clock.getDelta(), 0.05)
      tick?.(clock.elapsedTime, dt)
      controls.update()
      renderer.render(scene, camera)
    }
    loop()
  }

  const shared = new Set([...materialCache.values(), outlineMat])
  const dispose = () => {
    cancelAnimationFrame(frame)
    io.disconnect()
    ro.disconnect()
    controls.dispose()
    scene.traverse((object) => {
      if (!object.userData?.isOutline) object.geometry?.dispose?.()
      const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : []
      materials.forEach((m) => { m.map?.dispose?.(); if (!shared.has(m)) m.dispose() })
    })
    renderer.dispose()
    renderer.domElement.remove()
  }

  return { scene, camera, renderer, controls, start, dispose }
}

/** Raycast click helper that ignores drags. Calls onPick(userData) with the first ancestor that has userData.pick. */
export function enablePicking({ renderer, camera, scene }, onPick, onHover) {
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  let down = null
  const pickAt = (event) => {
    const rect = renderer.domElement.getBoundingClientRect()
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    for (const hit of raycaster.intersectObjects(scene.children, true)) {
      let node = hit.object
      while (node) {
        if (node.userData?.pick) return node.userData
        node = node.parent
      }
    }
    return null
  }
  const onDown = (e) => { down = { x: e.clientX, y: e.clientY } }
  const onUp = (e) => {
    if (!down) return
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
    down = null
    if (moved > 6) return
    const data = pickAt(e)
    if (data) onPick(data)
  }
  const onMove = (e) => {
    const data = pickAt(e)
    renderer.domElement.style.cursor = data ? 'pointer' : 'grab'
    onHover?.(data)
  }
  renderer.domElement.addEventListener('pointerdown', onDown)
  renderer.domElement.addEventListener('pointerup', onUp)
  renderer.domElement.addEventListener('pointermove', onMove)
  return () => {
    renderer.domElement.removeEventListener('pointerdown', onDown)
    renderer.domElement.removeEventListener('pointerup', onUp)
    renderer.domElement.removeEventListener('pointermove', onMove)
  }
}

/** Smoothly moves camera + orbit target. Instant when reduced motion is on. */
export function cameraTween(camera, controls) {
  let job = null
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
  return {
    fly(toPos, toTarget, { instant = false, duration = 1.1 } = {}) {
      if (instant) {
        camera.position.copy(toPos)
        controls.target.copy(toTarget)
        job = null
        return
      }
      job = { fromPos: camera.position.clone(), fromTarget: controls.target.clone(), toPos, toTarget, t: 0, duration }
    },
    update(dt) {
      if (!job) return
      job.t = Math.min(1, job.t + dt / job.duration)
      const k = ease(job.t)
      camera.position.lerpVectors(job.fromPos, job.toPos, k)
      controls.target.lerpVectors(job.fromTarget, job.toTarget, k)
      if (job.t >= 1) job = null
    },
    get busy() { return Boolean(job) },
  }
}
