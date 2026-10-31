import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useReducedMotion, webglAvailable } from '../hooks/a11y'
import { statusMeta } from '../domain/status'
import { createJasoos, stepToward } from './JasoosJr'
import { addCloud, addIsland, addRoad, addTree, cameraTween, createBuilding, createStage, enablePicking, labelSprite, mergeStatic, ownMat } from './townKit'
import { addPostBox, addPowerLine, addTrafficMirror } from './townProps'

const LOOKS = {
  supported: { wall: '#fff2cc', roof: '#3f9b6b', door: '#b97d57', window: '#ffe9a8' },
  conflict: { wall: '#ffe1a6', roof: '#f2a531', door: '#b97d57', window: '#9ee3ff' },
  outdated: { wall: '#d6d6d2', roof: '#8f8f8b', door: '#9a9a96', window: '#bcbcb8' },
  missing: { wall: '#2b3157', roof: '#1f2340', door: '#3c4370', window: '#14172b' },
  unverified: { wall: '#dde7ef', roof: '#a9bccb', door: '#8ea3b5', window: '#c8d6e0' },
}
const DEFAULT_CAM = new THREE.Vector3(0, 11, 19.5)
const DEFAULT_TARGET = new THREE.Vector3(0, 0.2, 0.4)

function shortTitle(title) {
  return title.length > 16 ? `${title.slice(0, 15)}…` : title
}

function starMesh() {
  const shape = new THREE.Shape()
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 ? 0.16 : 0.38
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 })
  geo.center()
  return new THREE.Mesh(geo, ownMat('#ffd23f', { emissive: '#ffb100', emissiveIntensity: 0.55 }))
}

function boltMesh() {
  const s = new THREE.Shape()
  s.moveTo(0.1, 0.6); s.lineTo(-0.25, 0.02); s.lineTo(0.0, 0.02); s.lineTo(-0.15, -0.6); s.lineTo(0.28, 0.12); s.lineTo(0.03, 0.12); s.lineTo(0.22, 0.6); s.closePath()
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: false })
  geo.center()
  return new THREE.Mesh(geo, ownMat('#ffd23f', { emissive: '#ff9a00', emissiveIntensity: 0.9 }))
}

function cobweb() {
  const points = []
  const spokes = 6
  for (let i = 0; i < spokes; i += 1) {
    const a = (i / spokes) * (Math.PI / 2)
    points.push(new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * 0.8, -Math.sin(a) * 0.8, 0))
  }
  ;[0.25, 0.5, 0.75].forEach((r) => {
    for (let i = 0; i < spokes - 1; i += 1) {
      const a1 = (i / spokes) * (Math.PI / 2)
      const a2 = ((i + 1) / spokes) * (Math.PI / 2)
      points.push(new THREE.Vector3(Math.cos(a1) * r, -Math.sin(a1) * r, 0), new THREE.Vector3(Math.cos(a2) * r, -Math.sin(a2) * r, 0))
    }
  })
  return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: '#f5f5f5' }))
}

function fogPuffs(color, opacity) {
  const group = new THREE.Group()
  const material = new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 1, depthWrite: false })
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * Math.PI * 2
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.55 + (i % 3) * 0.15, 12, 8), material)
    puff.position.set(Math.cos(a) * 1.9, 0.35 + (i % 2) * 0.25, Math.sin(a) * 1.6)
    puff.userData.phase = a
    group.add(puff)
  }
  return group
}

function padlock() {
  const group = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.1), ownMat('#ffd23f', { metalness: 0.3, roughness: 0.4 }))
  group.add(body)
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 16, Math.PI), ownMat('#9aa7b3', { metalness: 0.5, roughness: 0.3 }))
  shackle.position.y = 0.13
  group.add(shackle)
  return group
}

function decorate(house, finding) {
  const { group, height, depth } = house
  const top = house.anchors.top + 0.6
  const fx = { spin: null, flicker: null, bob: null, fog: null, glow: null }
  switch (finding.status) {
    case 'supported': {
      fx.spin = starMesh()
      fx.spin.userData.dynamic = true
      fx.spin.position.set(0, top, 0)
      group.add(fx.spin)
      house.glassMat.emissive.set('#ffbf3f')
      house.glassMat.emissiveIntensity = 0.6
      break
    }
    case 'conflict': {
      fx.flicker = boltMesh()
      fx.flicker.userData.dynamic = true
      fx.flicker.position.set(0.15, top + 0.1, 0)
      fx.flicker.scale.setScalar(1.25)
      group.add(fx.flicker)
      break
    }
    case 'outdated': {
      const web = cobweb()
      web.position.copy(house.anchors.webLeft)
      group.add(web)
      const web2 = cobweb()
      web2.position.copy(house.anchors.webRight)
      web2.scale.x = -1
      group.add(web2)
      break
    }
    case 'missing': {
      fx.bob = labelSprite('???', { bg: '#ff6b5b', ink: '#1f2340', width: 256, height: 128, font: 72 })
      fx.bob.scale.set(1.2, 0.6, 1)
      fx.bob.position.set(0, top, 0)
      fx.bob.userData.baseY = top
      group.add(fx.bob)
      break
    }
    default: {
      fx.fog = fogPuffs('#ffffff', 0.32)
      group.add(fx.fog)
      const lock = padlock()
      lock.position.copy(house.anchors.door)
      group.add(lock)
    }
  }
  // Status is never colour-only: every house carries its status as text.
  const meta = statusMeta(finding.status)
  const tag = labelSprite(`${finding.critical ? '★ ' : ''}${meta.label.toUpperCase()}`, { bg: '#ffffff', font: 38 })
  tag.scale.set(2.9, 0.72, 1)
  tag.position.copy(house.anchors.tag)
  group.add(tag)
  return fx
}

function layout(count) {
  const cols = count <= 3 ? count : Math.ceil(count / 2)
  const rows = Math.ceil(count / cols)
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / cols)
    const inRow = row === rows - 1 ? count - row * cols : cols
    const col = i % cols
    return { x: (col - (inRow - 1) / 2) * 4.7 + (row % 2 ? 1.2 : -0.6), z: (row - (rows - 1) / 2) * 5.6 - 0.8 }
  })
}

export default function TownScene({ findings, selectedId, onSelect, resetSignal = 0, onFail }) {
  const hostRef = useRef(null)
  const apiRef = useRef(null)
  const onSelectRef = useRef(onSelect)
  const reducedMotion = useReducedMotion()
  const [failed, setFailed] = useState(() => !webglAvailable())
  onSelectRef.current = onSelect

  useEffect(() => { if (failed) onFail?.() }, [failed, onFail])

  useEffect(() => {
    if (failed || !hostRef.current) return undefined
    let stage
    let unpick
    try {
      stage = createStage(hostRef.current, { reducedMotion, autoRotate: false, camera: DEFAULT_CAM.toArray(), target: DEFAULT_TARGET.toArray(), minDistance: 7, maxDistance: 34 })
      addIsland(stage.scene, Math.max(11, findings.length * 1.4 + 4))
      ;[[-10, -6], [10, -6], [-10.5, 4], [10.5, 4], [0, -9.5], [-6, 9], [6, 9]].forEach(([x, z], i) => addTree(stage.scene, x, z, 0.95, i))
      // A street runs in front of each row of houses, with poles and wires: it reads as a real block.
      const spotsForRoads = layout(findings.length)
      const rowZs = [...new Set(spotsForRoads.map((s) => s.z))]
      const span = Math.max(...spotsForRoads.map((s) => Math.abs(s.x)), 4) + 3.6
      rowZs.forEach((z) => addRoad(stage.scene, [[-span, z + 3.25], [0, z + 3.3], [span, z + 3.25]], { width: 0.9 }))
      addPowerLine(stage.scene, [-span + 0.8, -span / 3, span / 3, span - 0.8].map((x) => [x, rowZs[0] - 2.4]))
      addTrafficMirror(stage.scene, -span + 1.2, rowZs[rowZs.length - 1] + 2.6, Math.PI / 6)
      addPostBox(stage.scene, span - 1.4, rowZs[rowZs.length - 1] + 2.55)
      const clouds = [addCloud(stage.scene, -8, 8, -7, 1.2), addCloud(stage.scene, 7, 9, -4, 1)]
      const spots = layout(findings.length)
      const houses = findings.map((finding, i) => {
        const look = LOOKS[finding.status] || LOOKS.unverified
        const house = createBuilding({ ...spots[i], ...look, sign: shortTitle(finding.title).toUpperCase(), userData: { pick: true, id: finding.id } })
        stage.scene.add(house.group)
        return { finding, house, fx: decorate(house, finding) }
      })
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.09, 8, 48), ownMat('#ff6b5b', { emissive: '#ff6b5b', emissiveIntensity: 0.4 }))
      ring.rotation.x = Math.PI / 2
      ring.position.y = 0.16
      ring.visible = false
      ring.userData.dynamic = true
      stage.scene.add(ring)
      mergeStatic(stage.scene)
      houses.forEach(({ house }) => mergeStatic(house.group))

      const jasoos = createJasoos({ scale: 1.2 })
      jasoos.group.position.set(0, 0.08, Math.max(...spots.map((s) => s.z), 0) + 3.4)
      stage.scene.add(jasoos.group)
      const walkTarget = jasoos.group.position.clone()
      let gaspPending = false

      const tween = cameraTween(stage.camera, stage.controls)
      unpick = enablePicking(stage, (data) => onSelectRef.current?.(data.id))

      apiRef.current = {
        select(id) {
          const entry = houses.find((h) => h.finding.id === id)
          if (!entry) { ring.visible = false; return }
          const p = entry.house.group.position
          ring.visible = true
          ring.position.x = p.x
          ring.position.z = p.z
          walkTarget.set(p.x + 1.4, 0.08, p.z + 2.4)
          gaspPending = entry.finding.status === 'conflict'
          if (reducedMotion) { jasoos.group.position.copy(walkTarget) }
          tween.fly(new THREE.Vector3(p.x + 2.5, 6.5, p.z + 9.5), new THREE.Vector3(p.x, 1.4, p.z), { instant: reducedMotion })
        },
        reset() {
          ring.visible = false
          tween.fly(DEFAULT_CAM.clone(), DEFAULT_TARGET.clone(), { instant: reducedMotion })
        },
      }

      stage.start((t, dt) => {
        tween.update(dt)
        const arrived = stepToward(jasoos, walkTarget, dt, reducedMotion ? 100 : 4)
        if (arrived && gaspPending) { jasoos.setPose('gasp'); gaspPending = false }
        jasoos.update(t, dt)
        if (reducedMotion) return
        clouds.forEach((c, i) => { c.position.x += Math.sin(t * 0.2 + i) * 0.003 })
        ring.scale.setScalar(1 + Math.sin(t * 3) * 0.04)
        // Status icons stay still on purpose: one fixed icon per status, so the town always reads the same way.
      })
    } catch (error) {
      console.warn('Blindspot: findings town unavailable, falling back to the table.', error)
      stage?.dispose()
      setFailed(true)
      return undefined
    }
    return () => { unpick?.(); apiRef.current = null; stage?.dispose() }
  }, [failed, reducedMotion, findings])

  useEffect(() => { if (selectedId) apiRef.current?.select(selectedId) }, [selectedId])
  useEffect(() => { if (resetSignal) apiRef.current?.reset() }, [resetSignal])

  if (failed) return <div className="town-fallback" role="note">Your browser couldn't start the 3D town, so the evidence is shown as a list instead.</div>
  return <div className="town-canvas" ref={hostRef} role="img" aria-label={`3D town with one house per finding (${findings.length} houses). Use the house list to open each finding with the keyboard.`} />
}
