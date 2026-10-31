// Jasoos Jr. — Blindspot's original detective mascot, built only from three.js primitives.
// Brown bob hair, orange cap with a yellow button, round glasses, big eyes with highlights,
// blush, a teal detective coat with a brown belt, and a yellow magnifying glass.
import * as THREE from 'three'
import { mat } from './townKit'

const C = {
  skin: '#f6cba4', hair: '#7a4a2b', cap: '#ff8a3d', capButton: '#ffd23f', coat: '#2ec4b6', coatDark: '#21a094',
  belt: '#8a5a33', buckle: '#ffd23f', pants: '#3b4370', shoe: '#6b3f25', glasses: '#1f2340', eyeWhite: '#ffffff',
  pupil: '#1f2340', blush: '#ff9a8b', mouth: '#b4473f', lens: '#ffd23f', glass: '#d9f4ff',
}

function mesh(geometry, material, position = [0, 0, 0], parent) {
  const m = new THREE.Mesh(geometry, material)
  m.position.set(...position)
  m.castShadow = true
  parent?.add(m)
  return m
}

export function createJasoos({ scale = 1 } = {}) {
  const root = new THREE.Group()
  root.userData.dynamic = true
  const body = new THREE.Group() // bobs while walking
  root.add(body)
  root.scale.setScalar(scale)

  // Legs and shoes (pivot at the hip so they can swing)
  const legs = [-0.14, 0.14].map((x) => {
    const pivot = new THREE.Group()
    pivot.position.set(x, 0.52, 0)
    mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.4, 10), mat(C.pants), [0, -0.2, 0], pivot)
    const shoe = mesh(new THREE.SphereGeometry(0.12, 12, 8), mat(C.shoe), [0, -0.42, 0.05], pivot)
    shoe.scale.set(1, 0.6, 1.4)
    body.add(pivot)
    return pivot
  })

  // Coat: flared cone body + collar + belt
  const coat = mesh(new THREE.CylinderGeometry(0.27, 0.4, 0.62, 18), mat(C.coat), [0, 0.8, 0], body)
  coat.receiveShadow = true
  mesh(new THREE.TorusGeometry(0.25, 0.06, 8, 18), mat(C.coatDark), [0, 1.1, 0], body).rotation.x = Math.PI / 2
  mesh(new THREE.CylinderGeometry(0.335, 0.345, 0.07, 18), mat(C.belt), [0, 0.74, 0], body)
  mesh(new THREE.BoxGeometry(0.1, 0.08, 0.04), mat(C.buckle), [0, 0.74, 0.34], body)
  ;[0.92, 0.82].forEach((y) => mesh(new THREE.SphereGeometry(0.028, 8, 6), mat(C.capButton), [0, y, 0.3], body))

  // Arms (pivot at shoulder). Right arm holds the magnifying glass.
  const arm = (side) => {
    const pivot = new THREE.Group()
    pivot.position.set(0.3 * side, 1.02, 0)
    mesh(new THREE.CapsuleGeometry(0.075, 0.3, 4, 8), mat(C.coat), [0, -0.2, 0], pivot)
    mesh(new THREE.SphereGeometry(0.075, 10, 8), mat(C.skin), [0, -0.42, 0], pivot)
    pivot.rotation.z = 0.35 * side
    body.add(pivot)
    return pivot
  }
  const leftArm = arm(-1)
  const rightArm = arm(1)
  const glassGroup = new THREE.Group()
  glassGroup.position.set(0.02, -0.5, 0.12)
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.24, 8), mat(C.belt), [0, -0.08, 0], glassGroup)
  const ring = mesh(new THREE.TorusGeometry(0.15, 0.035, 10, 22), mat(C.lens), [0, 0.13, 0], glassGroup)
  ring.rotation.y = Math.PI / 2.4
  const glassDisc = mesh(new THREE.CircleGeometry(0.14, 20), new THREE.MeshStandardMaterial({ color: C.glass, transparent: true, opacity: 0.55, roughness: 0.1 }), [0, 0.13, 0], glassGroup)
  glassDisc.rotation.y = Math.PI / 2.4
  rightArm.add(glassGroup)
  rightArm.rotation.set(-0.9, 0, -0.35)

  // Head
  const head = new THREE.Group()
  head.position.set(0, 1.45, 0)
  body.add(head)
  const face = mesh(new THREE.SphereGeometry(0.36, 24, 18), mat(C.skin), [0, 0, 0], head)
  face.scale.set(1.05, 1, 0.95)

  // Bob hair: back shell + side bobs + fringe
  const hairMat = mat(C.hair)
  const shell = mesh(new THREE.SphereGeometry(0.39, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat, [0, 0.04, -0.03], head)
  shell.rotation.x = -0.25
  ;[-1, 1].forEach((side) => {
    const bob = mesh(new THREE.SphereGeometry(0.17, 14, 10), hairMat, [0.31 * side, -0.12, -0.04], head)
    bob.scale.set(0.75, 1.25, 1)
  })
  const fringe = mesh(new THREE.CylinderGeometry(0.33, 0.35, 0.09, 20, 1, false, -Math.PI * 0.45, Math.PI * 0.9), hairMat, [0, 0.2, 0.02], head)
  fringe.rotation.x = -0.12

  // Orange cap with yellow button
  const cap = mesh(new THREE.SphereGeometry(0.37, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.cap), [0, 0.18, -0.01], head)
  cap.scale.y = 0.8
  const brim = mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.035, 20, 1, false, -Math.PI / 2, Math.PI), mat(C.cap), [0, 0.2, 0.25], head)
  brim.scale.set(1, 1, 0.75)
  mesh(new THREE.SphereGeometry(0.05, 10, 8), mat(C.capButton), [0, 0.48, -0.01], head)

  // Big eyes with highlights, behind round glasses
  const eyes = [-0.13, 0.13].map((x) => {
    const eye = new THREE.Group()
    eye.position.set(x, 0.0, 0.31)
    const white = mesh(new THREE.SphereGeometry(0.085, 14, 10), mat(C.eyeWhite, 0.4), [0, 0, 0], eye)
    white.scale.z = 0.5
    mesh(new THREE.SphereGeometry(0.05, 12, 8), mat(C.pupil, 0.3), [0, -0.005, 0.03], eye).scale.z = 0.5
    mesh(new THREE.SphereGeometry(0.017, 8, 6), mat('#ffffff', 0.2, { emissive: '#ffffff', emissiveIntensity: 0.6 }), [0.018, 0.02, 0.06], eye)
    const frame = mesh(new THREE.TorusGeometry(0.105, 0.017, 8, 22), mat(C.glasses, 0.4), [0, 0, 0.05], eye)
    frame.castShadow = false
    head.add(eye)
    return eye
  })
  mesh(new THREE.BoxGeometry(0.06, 0.018, 0.018), mat(C.glasses), [0, 0.01, 0.37], head)
  ;[-1, 1].forEach((side) => {
    const blush = mesh(new THREE.SphereGeometry(0.055, 10, 8), mat(C.blush, 0.9), [0.22 * side, -0.12, 0.28], head)
    blush.scale.set(1.2, 0.6, 0.3)
  })
  const mouth = mesh(new THREE.TorusGeometry(0.045, 0.014, 6, 14, Math.PI), mat(C.mouth), [0, -0.17, 0.33], head)
  mouth.rotation.z = Math.PI
  const gaspMouth = mesh(new THREE.SphereGeometry(0.04, 12, 8), mat(C.mouth), [0, -0.17, 0.33], head)
  gaspMouth.scale.set(1, 1.3, 0.4)
  gaspMouth.visible = false

  let pose = 'idle'
  let poseTime = 0
  const setPose = (next) => {
    if (pose === next) return
    pose = next
    poseTime = 0
  }

  const update = (t, dt = 0.016) => {
    poseTime += dt
    const walking = pose === 'walk'
    const swing = walking ? Math.sin(t * 9) * 0.55 : 0
    legs[0].rotation.x = swing
    legs[1].rotation.x = -swing
    leftArm.rotation.x = walking ? -swing * 0.7 : Math.sin(t * 1.6) * 0.05
    body.position.y = walking ? Math.abs(Math.sin(t * 9)) * 0.06 : Math.sin(t * 2) * 0.015
    head.rotation.z = pose === 'idle' ? Math.sin(t * 1.3) * 0.05 : 0
    // Eyes blink every few seconds
    const blink = (t % 3.7) < 0.12 ? 0.15 : 1
    eyes.forEach((eye) => { eye.scale.y = blink })

    const gasp = pose === 'gasp'
    mouth.visible = !gasp
    gaspMouth.visible = gasp
    if (gasp) {
      const k = Math.min(poseTime / 0.2, 1)
      leftArm.rotation.z = -0.35 - 1.9 * k
      body.position.y = Math.max(0, Math.sin(Math.min(poseTime * 6, Math.PI)) * 0.25)
      head.rotation.x = -0.15 * k
      if (poseTime > 1.4) setPose('idle')
    } else {
      leftArm.rotation.z = -0.35
      head.rotation.x = 0
    }
  }

  return { group: root, setPose, update, get pose() { return pose } }
}

/** Walks the mascot toward a point on the ground. Returns true when arrived. */
export function stepToward(jasoos, target, dt, speed = 3.2) {
  const pos = jasoos.group.position
  const dx = target.x - pos.x
  const dz = target.z - pos.z
  const dist = Math.hypot(dx, dz)
  if (dist < 0.08) {
    if (jasoos.pose === 'walk') jasoos.setPose('idle')
    return true
  }
  if (jasoos.pose !== 'gasp') jasoos.setPose('walk')
  const stepLen = Math.min(dist, speed * dt)
  pos.x += (dx / dist) * stepLen
  pos.z += (dz / dist) * stepLen
  const heading = Math.atan2(dx, dz)
  let delta = heading - jasoos.group.rotation.y
  delta = Math.atan2(Math.sin(delta), Math.cos(delta))
  jasoos.group.rotation.y += delta * Math.min(1, dt * 10)
  return false
}
