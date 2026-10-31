import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useReducedMotion, webglAvailable } from '../hooks/a11y'
import { createJasoos, stepToward } from './JasoosJr'
import { addCloud, addRoad, addTree, box, createBuilding, createStage, cyl, labelSprite, mat, mergeStatic } from './townKit'
import { addPostBox, addPowerLine, addTrafficMirror, addVendingMachine } from './townProps'

const LOOK = {
  Primary: { wall: '#e9f3ff', roof: '#3f7fb8' },
  Institutional: { wall: '#f1ecff', roof: '#7a5cc2' },
  Secondary: { wall: '#fff3d6', roof: '#e0a52a' },
  Pasted: { wall: '#e3faf6', roof: '#2ec4b6' },
}
const SLOT_X = [-9.2, -4.6, 0, 4.6, 9.2]

function emptyLot(x) {
  const g = new THREE.Group()
  g.position.set(x, 0, 0)
  box(g, [3.2, 0.08, 3], '#cdbf9f', [0, 0.05, 0.3], { castShadow: false })
  ;[[-1.4, -1], [1.4, -1], [-1.4, 1.6], [1.4, 1.6]].forEach(([px, pz]) => cyl(g, 0.12, 0.2, 0.42, '#ff8a3d', [px, 0.26, pz], { segments: 10, outline: 0.02 }))
  cyl(g, 0.05, 0.05, 1.2, '#8a5a33', [0, 0.6, 1.4], { segments: 6 })
  const sign = labelSprite('ADD A PAGE', { bg: '#ffd23f' })
  sign.scale.set(1.9, 0.48, 1)
  sign.position.set(0, 1.35, 1.4)
  g.add(sign)
  return g
}

function shortHost(host) {
  const h = (host || 'pasted text').replace(/^www\./, '')
  return h.length > 18 ? `${h.slice(0, 17)}…` : h
}

/** The street that builds itself while you add sources on the New investigation page. */
export default function CaseStreet({ slots }) {
  const hostRef = useRef(null)
  const apiRef = useRef(null)
  const reducedMotion = useReducedMotion()
  const [failed, setFailed] = useState(() => !webglAvailable())
  const key = JSON.stringify(slots)

  useEffect(() => {
    if (failed || !hostRef.current) return undefined
    let stage
    try {
      stage = createStage(hostRef.current, { reducedMotion, autoRotate: false, camera: [0, 3.3, 14], target: [0, 2.1, 0.6], enableZoom: false, minDistance: 10, maxDistance: 30 })
      stage.controls.minAzimuthAngle = -0.45
      stage.controls.maxAzimuthAngle = 0.45
      const scene = stage.scene
      const ground = new THREE.Mesh(new THREE.BoxGeometry(40, 0.4, 14), mat('#9bd884'))
      ground.position.set(0, -0.2, 0)
      ground.receiveShadow = true
      scene.add(ground)
      addRoad(scene, [[-20, 3.7], [0, 3.7], [20, 3.7]], { width: 1.6 })
      box(scene, [40, 0.12, 0.9], '#d9d2c3', [0, 0.06, 2.55], { castShadow: false })
      ;[[-14, -1.5, 1.1, 0], [-12.4, -3.5, 0.9, 3], [13.6, -1.6, 1.1, 1], [12.2, -3.6, 0.9, 3], [-6.9, -3.6, 0.8, 2], [2.3, -3.8, 0.85, 0], [7, -3.6, 0.8, 3]].forEach(([x, z, s, v]) => addTree(scene, x, z, s, v))
      addPowerLine(scene, [[-16, 2.4], [-6.9, 2.4], [2.3, 2.4], [11.5, 2.4], [18, 2.4]])
      addTrafficMirror(scene, -13.2, 2.6, Math.PI / 5)
      addVendingMachine(scene, 13.3, 1.2, -0.3)
      addPostBox(scene, -11.6, 1.9)
      mergeStatic(scene)
      const clouds = [addCloud(scene, -10, 7.5, -6, 1.1), addCloud(scene, 8, 8.4, -7, 1.3)]

      const jasoos = createJasoos({ scale: 1.15 })
      jasoos.group.position.set(-13, 0.08, 2.4)
      scene.add(jasoos.group)
      const target = jasoos.group.position.clone()
      let gaspPending = false
      let street = null
      const popping = []

      apiRef.current = {
        build(list, newest) {
          if (street) {
            scene.remove(street)
            street.traverse((o) => { o.geometry?.dispose?.(); if (o.material && !o.material.isMeshToonMaterial) o.material.dispose?.() })
          }
          street = new THREE.Group()
          list.forEach((slot, i) => {
            if (!slot) { street.add(emptyLot(SLOT_X[i])); return }
            const look = LOOK[slot.tier] || LOOK.Secondary
            const house = createBuilding({ x: SLOT_X[i], z: 0, ...look, width: 2.5, depth: 2.1, sign: shortHost(slot.host).toUpperCase() })
            const tag = labelSprite(slot.tier === 'Pasted' ? 'PASTED TEXT' : slot.tier.toUpperCase(), { bg: '#ffffff', font: 40 })
            tag.scale.set(1.9, 0.48, 1)
            tag.position.set(0, 0.55, 2.45)
            house.group.add(tag)
            mergeStatic(house.group)
            street.add(house.group)
            if (i === newest && !reducedMotion) { house.group.scale.setScalar(0.01); popping.push({ g: house.group, t: 0 }) }
          })
          scene.add(street)
          if (newest != null && list[newest]) {
            target.set(SLOT_X[newest] + 1.5, 0.08, 2.35)
            gaspPending = true
            if (reducedMotion) jasoos.group.position.copy(target)
          }
        },
      }

      stage.start((t, dt) => {
        clouds.forEach((c, i) => { if (!reducedMotion) c.position.x += Math.sin(t * 0.2 + i) * 0.004 })
        for (let i = popping.length - 1; i >= 0; i -= 1) {
          const p = popping[i]
          p.t = Math.min(1, p.t + dt / 0.45)
          const k = 1 + 0.25 * Math.sin(p.t * Math.PI) // overshoot pop
          p.g.scale.setScalar(Math.max(0.01, p.t * k))
          if (p.t >= 1) { p.g.scale.setScalar(1); popping.splice(i, 1) }
        }
        const arrived = stepToward(jasoos, target, dt, reducedMotion ? 100 : 5)
        if (arrived && gaspPending) { jasoos.setPose('gasp'); gaspPending = false }
        jasoos.update(t, dt)
      })
    } catch (error) {
      console.warn('Blindspot: case street unavailable.', error)
      stage?.dispose()
      setFailed(true)
      return undefined
    }
    return () => { apiRef.current = null; stage?.dispose() }
  }, [failed, reducedMotion])

  // Rebuild the houses when the sources change; the newest filled slot gets the pop and the visit.
  const prev = useRef([])
  useEffect(() => {
    const id = setTimeout(() => {
      const before = prev.current
      let newest = null
      slots.forEach((s, i) => { if (s && (!before[i] || before[i].host !== s.host || before[i].tier !== s.tier)) newest = i })
      prev.current = slots
      apiRef.current?.build(slots, newest)
    }, apiRef.current ? 350 : 600)
    return () => clearTimeout(id)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) return null
  return <div className="case-street-canvas" ref={hostRef} aria-hidden="true" />
}
