import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useReducedMotion, webglAvailable } from '../hooks/a11y'
import { STEPS } from '../domain/status'
import { createJasoos, stepToward } from './JasoosJr'
import { addCloud, addIsland, addTree, createBuilding, createStage, mergeStatic } from './townKit'

const ROOFS = ['#ff6b5b', '#2ec4b6', '#4a99d0', '#ffd23f', '#81bd79', '#ff8a3d', '#a07be0', '#ff6b5b']

/** One house per pipeline step. Jasoos Jr. walks to the house of the current step; finished houses light up. */
export default function AnalyzingScene({ activeIndex, doneCount, onFail }) {
  const hostRef = useRef(null)
  const stateRef = useRef({ activeIndex, doneCount })
  const reducedMotion = useReducedMotion()
  const [failed, setFailed] = useState(() => !webglAvailable())
  stateRef.current = { activeIndex, doneCount }

  useEffect(() => { if (failed) onFail?.() }, [failed, onFail])

  useEffect(() => {
    if (failed || !hostRef.current) return undefined
    let stage
    try {
      stage = createStage(hostRef.current, { reducedMotion, autoRotate: true, camera: [0, 15, 24], target: [0, 0.5, 0], minDistance: 14, maxDistance: 32 })
      stage.controls.autoRotateSpeed = 0.18
      addIsland(stage.scene, 11.5)
      ;[[-9.5, -6], [9.5, -6], [-9.8, 5], [9.8, 5]].forEach(([x, z], i) => addTree(stage.scene, x, z, 0.9, i))
      addCloud(stage.scene, -7, 8.5, -6, 1.2)
      addCloud(stage.scene, 7, 9, -3, 1)
      const radius = 6.6
      const houses = STEPS.map((step, i) => {
        const angle = (i / STEPS.length) * Math.PI * 2 - Math.PI / 2
        const x = Math.cos(angle) * radius
        const z = Math.sin(angle) * radius
        const house = createBuilding({ x, z, wall: '#fff2cc', roof: ROOFS[i], sign: step.house, width: 2.3, depth: 2, height: 1.6 })
        stage.scene.add(house.group)
        const front = new THREE.Vector3(Math.cos(angle) * (radius - 2.2), 0.08, Math.sin(angle) * (radius - 2.2))
        return { house, front }
      })
      mergeStatic(stage.scene)
      const jasoos = createJasoos({ scale: 1.25 })
      jasoos.group.position.set(0, 0.08, 0)
      stage.scene.add(jasoos.group)

      stage.start((t, dt) => {
        const { activeIndex: active, doneCount: done } = stateRef.current
        houses.forEach(({ house }, i) => {
          const finished = i < done
          house.glassMat.emissive.set(finished ? '#ffbf3f' : i === active ? '#7fd6ff' : '#000000')
          house.glassMat.emissiveIntensity = finished ? 0.8 : i === active ? 0.5 + Math.sin(t * 5) * 0.3 : 0
        })
        const target = houses[Math.min(Math.max(active, 0), houses.length - 1)]?.front
        if (target) stepToward(jasoos, target, dt, reducedMotion ? 100 : 3.6)
        jasoos.update(t, dt)
      })
    } catch (error) {
      console.warn('Blindspot: analyzing town unavailable, showing the step list only.', error)
      stage?.dispose()
      setFailed(true)
      return undefined
    }
    return () => stage?.dispose()
  }, [failed, reducedMotion])

  if (failed) return null
  return <div className="analyzing-canvas" ref={hostRef} aria-hidden="true" />
}
