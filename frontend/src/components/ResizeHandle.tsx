import { useCallback, useRef } from 'react'

interface Props {
  onResize: (deltaX: number) => void
  onResizeEnd: () => void
}

export default function ResizeHandle({ onResize, onResizeEnd }: Props) {
  const startX = useRef(0)
  const dragging = useRef(false)

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const delta = e.clientX - startX.current
    startX.current = e.clientX
    onResize(delta)
  }, [onResize])

  const handleMouseUp = useCallback(() => {
    dragging.current = false
    document.body.classList.remove('select-none', 'cursor-col-resize')
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    onResizeEnd()
  }, [handleMouseMove, onResizeEnd])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    startX.current = e.clientX
    dragging.current = true
    document.body.classList.add('select-none', 'cursor-col-resize')
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [handleMouseMove, handleMouseUp])

  return (
    <div
      onMouseDown={handleMouseDown}
      className="shrink-0 w-1 cursor-col-resize group relative"
    >
      <div className="absolute inset-y-0 -left-0.5 -right-0.5 group-hover:bg-accent/40 transition-colors" />
    </div>
  )
}
