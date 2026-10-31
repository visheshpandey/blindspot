import { Component } from 'react'
import { Home, RefreshCw } from 'lucide-react'
import { reportError } from '../../utils/logger'

const CHUNK_FAILED = /dynamically imported module|Loading chunk|Importing a module script failed/i

/**
 * Catches a render crash and shows a way out instead of a blank screen.
 * `scope` names the place in logs. `resetKey` clears the error when it changes (e.g. when the route changes).
 * A failed lazy chunk (flaky network while loading a 3D scene) offers Reload, since retrying a render can't fix it.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    reportError(this.props.scope || 'page', error, info?.componentStack)
  }

  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const chunkFailed = CHUNK_FAILED.test(String(error?.message || error))
    return <div className="crash-screen" role="alert">
      <b>{chunkFailed ? "A part of the page didn't load." : 'Something went wrong on this page.'}</b>
      <p>{chunkFailed ? 'Check your connection and reload. Your cases and saved findings are safe.' : 'Your cases and saved findings are safe. You can go back and try again.'}</p>
      {chunkFailed
        ? <button className="primary-button" onClick={() => window.location.reload()}><RefreshCw size={15} aria-hidden="true" /> Reload</button>
        : <button className="primary-button" onClick={() => { this.setState({ error: null }); window.location.hash = '#/' }}><Home size={15} aria-hidden="true" /> Back to overview</button>}
    </div>
  }
}
