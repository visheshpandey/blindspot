import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useReducedMotion, webglAvailable } from '../hooks/a11y'
import { labelSprite, mat, outline } from './townKit'

const TIER = { Primary: '#3f7fb8', Institutional: '#7a5cc2', Secondary: '#e0a52a', Unverified: '#c0524a' }

/** Sources as beads on a slowly turning double helix; rungs join sources that share text. */
export default function DnaHelix({ sources, dna }) {
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
      const camera = new THREE.PerspectiveCamera(36, host.clientWidth / host.clientHeight, 0.1, 100)
      camera.position.set(0, 0.2, 15)
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setSize(host.clientWidth, host.clientHeight)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.domElement.setAttribute('aria-hidden', 'true')
      host.appendChild(renderer.domElement)
      scene.add(new THREE.HemisphereLight('#ffffff', '#c9d7ff', 2.2))
      const key = new THREE.DirectionalLight('#fff4d6', 2)
      key.position.set(4, 6, 8)
      scene.add(key)

      const helix = new THREE.Group()
      scene.add(helix)
      // Two backbone strands.
      const strand = (phase, color) => {
        const pts = []
        for (let i = 0; i <= 120; i += 1) {
          const t = i / 120
          const a = t * Math.PI * 4 + phase
          pts.push(new THREE.Vector3(Math.cos(a) * 1.6, (t - 0.5) * 7, Math.sin(a) * 1.6))
        }
        const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.07, 8), mat(color))
        helix.add(tube)
      }
      strand(0, '#1f2340')
      strand(Math.PI, '#2ec4b6')

      // Readable sources become beads spaced along the helix, alternating strands.
      const readable = sources.filter((s) => s.state !== 'Blocked')
      const pos = {}
      readable.forEach((s, i) => {
        const t = readable.length === 1 ? 0.5 : 0.12 + (0.76 * i) / (readable.length - 1)
        const a = t * Math.PI * 4 + (i % 2 ? Math.PI : 0)
        const p = new THREE.Vector3(Math.cos(a) * 1.6, (t - 0.5) * 7, Math.sin(a) * 1.6)
        pos[s.id] = p
        const bead = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), mat(TIER[s.type] || TIER.Unverified))
        bead.position.copy(p)
        outline(bead, 0.06)
        helix.add(bead)
        const label = labelSprite(s.id, { bg: '#ffffff', width: 160, height: 110, font: 64 })
        label.scale.set(0.72, 0.5, 1)
        label.position.copy(p).add(new THREE.Vector3(0, 0.75, 0))
        helix.add(label)
      })
      // Rungs between related sources.
      ;(dna?.pairs || []).filter((p) => p.relation !== 'independent' && pos[p.a] && pos[p.b]).forEach((p) => {
        const a = pos[p.a]
        const b = pos[p.b]
        const len = a.distanceTo(b)
        const copied = p.relation === 'copied'
        const rung = new THREE.Mesh(new THREE.CylinderGeometry(copied ? 0.13 : 0.06, copied ? 0.13 : 0.06, len, 10), mat(copied ? '#ff6b5b' : '#ffd23f'))
        rung.position.copy(a).lerp(b, 0.5)
        rung.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
        if (copied) outline(rung, 0.04)
        helix.add(rung)
      })

      const ro = new ResizeObserver(() => {
        if (!host.clientWidth || !host.clientHeight) return
        camera.aspect = host.clientWidth / host.clientHeight
        camera.updateProjectionMatrix()
        renderer.setSize(host.clientWidth, host.clientHeight)
      })
      ro.observe(host)
      const clock = new THREE.Clock()
      const loop = () => {
        frame = requestAnimationFrame(loop)
        if (document.hidden) return
        if (!reducedMotion) helix.rotation.y = clock.getElapsedTime() * 0.45
        renderer.render(scene, camera)
      }
      helix.rotation.z = -0.35
      loop()
      return () => {
        cancelAnimationFrame(frame)
        ro.disconnect()
        scene.traverse((o) => { if (!o.userData?.isOutline) o.geometry?.dispose?.(); if (o.material?.map) o.material.map.dispose() })
        renderer.dispose()
        renderer.domElement.remove()
      }
    } catch (error) {
      console.warn('Blindspot: DNA helix unavailable.', error)
      renderer?.domElement?.remove()
      setFailed(true)
      return undefined
    }
  }, [failed, reducedMotion, sources, dna])

  if (failed) return null
  return <div className="dna-helix" ref={hostRef} role="img" aria-label="3D helix of the sources; red rungs join sources that copy each other." />
}
