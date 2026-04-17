import { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react'

function fmtTime(s) {
  if (!isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const AudioPlayer = forwardRef(function AudioPlayer({ src, onSnapshot }, ref) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [scrubbing, setScrubbing] = useState(false)
  const rafRef = useRef(null)

  useImperativeHandle(ref, () => ({
    get currentTime() { return audioRef.current?.currentTime || 0 },
    get paused() { return audioRef.current?.paused ?? true },
    get isScrubbing() { return scrubbing },
    play() { audioRef.current?.play(); setPlaying(true) },
    pause() { audioRef.current?.pause(); setPlaying(false) },
  }))

  useEffect(() => {
    const a = audioRef.current
    if (!a || !src) return
    a.src = src; a.load()
    setPlaying(false); setCurrentTime(0)
    return () => { a.pause(); a.src = '' }
  }, [src])

  useEffect(() => {
    function tick() {
      if (audioRef.current) setCurrentTime(audioRef.current.currentTime)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  function toggle() {
    const a = audioRef.current; if (!a) return
    if (a.paused) { a.play(); setPlaying(true) } else { a.pause(); setPlaying(false) }
  }

  function scrubTo(e) {
    const a = audioRef.current; if (!a || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    a.currentTime = pct * duration
  }

  function onScrubStart(e) { setScrubbing(true); scrubTo(e) }
  function onScrubMove(e) { if (scrubbing) scrubTo(e) }
  function onScrubEnd() { setScrubbing(false) }

  function onMeta() { setDuration(audioRef.current?.duration || 0) }
  function onEnded() { setPlaying(false) }

  if (!src) return null

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="audio-player">
      <audio ref={audioRef} onLoadedMetadata={onMeta} onEnded={onEnded} />
      <button className="ap-play" onClick={toggle}>{playing ? '❚❚' : '▶'}</button>
      <span className="ap-time">{fmtTime(currentTime)}</span>
      <div className="ap-scrub"
        onMouseDown={onScrubStart} onMouseMove={onScrubMove} onMouseUp={onScrubEnd} onMouseLeave={onScrubEnd}>
        <div className="ap-track" />
        <div className="ap-progress" style={{ width: `${pct}%` }} />
        <div className="ap-head" style={{ left: `${pct}%` }} />
      </div>
      <span className="ap-time">{fmtTime(duration)}</span>
      {onSnapshot && <button className="ap-snapshot" onClick={onSnapshot} title="Snapshot at current time">📷</button>}
    </div>
  )
})

export default AudioPlayer
