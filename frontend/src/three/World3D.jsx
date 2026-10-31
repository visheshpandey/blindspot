import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useReducedMotion, webglAvailable } from '../hooks/a11y'
import { createJasoos, stepToward } from './JasoosJr'
import { addCloud, addIsland, addRoad, addTree, box, cameraTween, createBuilding, createStage, cyl, enablePicking, labelSprite, mat, mergeStatic, outline } from './townKit'
import { addBench, addCar, addCrosswalk, addPark, addPoliceBox, addPostBox, addPowerLine, addSchool, addShop, addTrafficMirror, addVendingMachine } from './townProps'

// Street plan: one east–west road (z≈0.6) and one north–south road (x≈0.6) cross in the middle.
// Each quarter holds one landmark that maps to a part of Blindspot.
function buildTown(scene) {
  addIsland(scene)
  addRoad(scene, [[-9.6, 0.4], [-5, 0.7], [0, 0.6], [5, 0.5], [9.6, 0.7]])
  addRoad(scene, [[0.6, -5.2], [0.5, -2], [0.6, 2], [0.7, 8.8]], { width: 0.85 })
  addCrosswalk(scene, 0.6, 1.75)
  addCrosswalk(scene, -0.75, 0.62, Math.PI / 2)

  addPoliceBox(scene, -3.3, -2.1, 0, { pick: true, action: 'hq' })
  const library = createBuilding({ x: 3.6, z: -2.7, wall: '#fff0c8', roof: '#d9574a', door: '#6a9ac2', sign: 'SOURCE LIBRARY', userData: { pick: true, action: 'sources' } })
  scene.add(library.group)
  addShop(scene, 4.1, 3.3, 0, { pick: true, action: 'evidence' })
  addSchool(scene, -4.1, 3.4, 0, { pick: true, action: 'report' })

  // Case Archive: a tall records tower closing the north end of the street.
  const tower = new THREE.Group()
  tower.position.set(0.6, 0, -6.7)
  tower.userData = { pick: true, action: 'archive' }
  box(tower, [1.7, 3.3, 1.7], '#f3c96e', [0, 1.75, 0], { outline: true })
  for (let f = 0; f < 3; f += 1) box(tower, [0.5, 0.45, 0.04], '#a9e4ff', [0, 0.9 + f * 0.9, 0.87], { castShadow: false })
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.2, 4), mat('#ff6b5b'))
  cap.position.y = 4.0
  cap.rotation.y = Math.PI / 4
  cap.castShadow = true
  outline(cap, 0.05)
  tower.add(cap)
  const label = labelSprite('CASE ARCHIVE')
  label.scale.set(2.2, 0.55, 1)
  label.position.set(0, 5.1, 0)
  tower.add(label)
  scene.add(tower)

  // Ordinary neighbours make it a street instead of a set of icons.
  ;[{ x: -7.1, z: -2.7, wall: '#f7e6d0', roof: '#5d6d8a' }, { x: 7.1, z: -2.6, wall: '#e9f1f7', roof: '#4f7d5c', width: 2.3 },
    { x: 7.4, z: 3.5, wall: '#fbe3e3', roof: '#5d6d8a', width: 2.1, storey2: 0.9 }].forEach((n) => scene.add(createBuilding(n).group))

  addPark(scene, -4.0, -6.3)
  addBench(scene, -2.6, -5.4, -0.3)
  addVendingMachine(scene, -1.55, -1.5, 0)
  addPostBox(scene, -1.5, 1.7)
  addTrafficMirror(scene, -0.2, -0.25, Math.PI / 4)
  addTrafficMirror(scene, 1.5, 1.5, -Math.PI * 0.75)
  addPowerLine(scene, [[-8.4, -0.35], [-4.9, -0.3], [-1.3, -0.3], [2.4, -0.4], [5.9, -0.45], [8.9, -0.3]])

  ;[[-6.9, 6.1, 1, 3], [6.4, 6.3, 0.95, 0], [-1.9, 7.3, 0.85, 3], [3.0, 7.6, 0.9, 1], [-2.1, -4.3, 0.75, 3],
    [2.6, -5.4, 0.9, 2], [6.2, -5.7, 1, 3], [-8.6, 2.7, 0.85, 0], [-7.4, -5.2, 0.8, 1]].forEach(([x, z, s, v]) => addTree(scene, x, z, s, v))
  // Low hedges along the south road.
  ;[[-1.7, 5.2], [-1.7, 6.2], [2.0, 5.6]].forEach(([x, z]) => box(scene, [0.5, 0.35, 0.9], '#4f9d5b', [x, 0.25, z], { outline: 0.03 }))
  cyl(scene, 0.04, 0.04, 1.3, '#687b86', [1.4, 0.65, -3.6])

  const cars = [addCar(scene, -6, 0.42, Math.PI / 2, '#ffd23f'), addCar(scene, 5.5, 0.8, -Math.PI / 2, '#2ec4b6')]
  const clouds = [addCloud(scene, -7.4, 8.2, -6.5, 1.25), addCloud(scene, 6.5, 9.2, -2.5, 1.05), addCloud(scene, 0, 9.8, 7.5, 0.9)]
  return { cars, clouds }
}

const FINAL_CAM = new THREE.Vector3(16.5, 15, 21)
const START_CAM = new THREE.Vector3(2, 34, 40)

export default function World3D({ onZone, hero = false }) {
  const hostRef = useRef(null)
  const onZoneRef = useRef(onZone)
  const reducedMotion = useReducedMotion()
  const [failed, setFailed] = useState(() => !webglAvailable())
  onZoneRef.current = onZone

  useEffect(() => {
    if (failed || !hostRef.current) return undefined
    let stage
    let unpick
    try {
      stage = createStage(hostRef.current, {
        reducedMotion, autoRotate: true, camera: (hero && !reducedMotion ? START_CAM : FINAL_CAM).toArray(),
        target: [0, 0.4, 0.6], minDistance: 12, maxDistance: 30, enableZoom: !hero, viewShift: hero ? 0.17 : 0,
      })
      stage.controls.autoRotateSpeed = 0.22
      const { cars, clouds } = buildTown(stage.scene)
      mergeStatic(stage.scene)
      stage.scene.children.filter((c) => c.userData?.pick).forEach((group) => mergeStatic(group))
      const jasoos = createJasoos({ scale: 1.1 })
      jasoos.group.position.set(-1.3, 0.08, 1.5)
      stage.scene.add(jasoos.group)
      const patrol = [new THREE.Vector3(-1.3, 0, 1.5), new THREE.Vector3(-1.3, 0, -1.0), new THREE.Vector3(2.0, 0, -1.0), new THREE.Vector3(2.0, 0, 1.6)]
      let leg = 0
      let pause = 0
      const tween = cameraTween(stage.camera, stage.controls)
      if (hero && !reducedMotion) {
        stage.controls.autoRotate = false
        tween.fly(FINAL_CAM.clone(), new THREE.Vector3(0, 0.4, 0.6), { duration: 2.6 })
      }
      unpick = enablePicking(stage, (data) => onZoneRef.current?.(data.action))
      stage.start((t, dt) => {
        tween.update(dt)
        if (hero && !reducedMotion && !tween.busy && !stage.controls.autoRotate) stage.controls.autoRotate = true
        if (!reducedMotion) {
          clouds.forEach((cloud, i) => { cloud.position.x += Math.sin(t * 0.17 + i) * 0.003 })
          cars[0].position.x = -9 + ((t * 1.6) % 18)
          cars[1].position.x = 9 - ((t * 1.2 + 6) % 18)
          if (pause > 0) pause -= dt
          else if (stepToward(jasoos, patrol[leg], dt, 1.5)) { leg = (leg + 1) % patrol.length; pause = 1.4 }
        }
        jasoos.update(t, dt)
      })
    } catch (error) {
      console.warn('Blindspot: 3D town unavailable, showing the illustrated town instead.', error)
      stage?.dispose()
      setFailed(true)
      return undefined
    }
    return () => { unpick?.(); stage?.dispose() }
  }, [failed, reducedMotion, hero])

  if (failed) {
    return <div className="world3d-fallback"><img src="/world-scene.svg" alt="Illustrated Blindspot detective town" /><p>Your browser couldn't start the 3D scene. Everything else in Blindspot still works.</p></div>
  }
  return <div className="world3d-host" ref={hostRef} role="img" aria-label="3D detective town. Drag to look around; click a building to open that part of Blindspot. The same places are listed as buttons." />
}
