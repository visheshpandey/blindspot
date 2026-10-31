import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useReducedMotion, webglAvailable } from '../hooks/a11y'
import { createJasoos } from './JasoosJr'

/** A small live 3D Jasoos Jr. for page headers: sways, blinks, and jumps in surprise every few seconds. */
export default function MascotBadge({ size = 150 }) {
  const hostRef = useRef(null)
  const reducedMotion = useReducedMotion()
  const [failed, setFailed] = useState(() => !webglAvailable())

  useEffect(() => {
    if (failed || !hostRef.current) return undefined
    const host = hostRef.current
    let renderer
    let frame = 0
    try {
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
      camera.position.set(0, 1.25, 5.2)
      camera.lookAt(0, 1.05, 0)
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setSize(size, size)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.domElement.setAttribute('aria-hidden', 'true')
      host.appendChild(renderer.domElement)
      scene.add(new THREE.HemisphereLight('#ffffff', '#ffd9a8', 2.4))
      const key = new THREE.DirectionalLight('#fff4d6', 2.2)
      key.position.set(3, 5, 4)
      scene.add(key)
      const jasoos = createJasoos({ scale: 1 })
      scene.add(jasoos.group)
      const clock = new THREE.Clock()
      let nextGasp = 2.5
      const loop = () => {
        frame = requestAnimationFrame(loop)
        if (document.hidden) return
        const dt = Math.min(clock.getDelta(), 0.05)
        const t = clock.elapsedTime
        if (!reducedMotion) {
          jasoos.group.rotation.y = Math.sin(t * 0.9) * 0.45
          if (t > nextGasp) { jasoos.setPose('gasp'); nextGasp = t + 5.5 }
        }
        jasoos.update(reducedMotion ? 0 : t, dt)
        renderer.render(scene, camera)
      }
      loop()
      return () => {
        cancelAnimationFrame(frame)
        renderer.dispose()
        renderer.domElement.remove()
      }
    } catch (error) {
      console.warn('Blindspot: mascot badge unavailable.', error)
      renderer?.domElement?.remove()
      setFailed(true)
      return undefined
    }
  }, [failed, reducedMotion, size])

  if (failed) return null
  return <div className="mascot-badge" ref={hostRef} style={{ width: size, height: size }} />
}
