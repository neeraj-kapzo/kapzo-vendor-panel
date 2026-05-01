'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Download, ZoomIn, ZoomOut, RotateCcw, FileText, Maximize2, Minimize2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface PrescriptionViewerProps {
  url:     string
  orderId: string
  onClose: () => void
}

export function PrescriptionViewer({ url, orderId, onClose }: PrescriptionViewerProps) {
  const isPdf = url.toLowerCase().includes('.pdf')
  const [zoom, setZoom]   = useState(1)
  const [rotate, setRotate] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (fullscreen) setFullscreen(false)
      else onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [fullscreen, onClose])

  const zoomIn  = () => setZoom((z) => Math.min(3, parseFloat((z + 0.25).toFixed(2))))
  const zoomOut = () => setZoom((z) => Math.max(0.25, parseFloat((z - 0.25).toFixed(2))))
  const reset   = () => { setZoom(1); setRotate(0) }

  if (!mounted) return null

  return createPortal(
    <>
      {/* Backdrop — portal avoids transformed ancestors (e.g. order slide-over) trapping fixed */}
      <div
        className="fixed inset-0 z-[80] bg-[#022135]/75 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className={cn(
          'fixed z-[81] bg-white flex flex-col overflow-hidden shadow-2xl',
          'transition-[inset,border-radius] duration-200 ease-out',
          fullscreen
            ? 'inset-0 rounded-none'
            : 'inset-4 sm:inset-8 rounded-2xl'
        )}
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Header ── */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#21A053]/10 flex items-center justify-center">
              <FileText size={15} className="text-[#21A053]" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#022135]">Prescription</p>
              <p className="text-[10px] text-slate-400 font-medium">
                Order #{orderId.slice(-6).toUpperCase()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Zoom controls — images only */}
            {!isPdf && (
              <>
                <button
                  onClick={zoomOut}
                  disabled={zoom <= 0.25}
                  title="Zoom out"
                  className="p-2 rounded-xl text-slate-400 hover:text-[#022135] hover:bg-slate-100 transition-colors disabled:opacity-30"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="text-xs font-semibold text-slate-500 w-10 text-center tabular-nums select-none">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={zoomIn}
                  disabled={zoom >= 3}
                  title="Zoom in"
                  className="p-2 rounded-xl text-slate-400 hover:text-[#022135] hover:bg-slate-100 transition-colors disabled:opacity-30"
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  onClick={() => setRotate((r) => (r + 90) % 360)}
                  title="Rotate 90°"
                  className="p-2 rounded-xl text-slate-400 hover:text-[#022135] hover:bg-slate-100 transition-colors"
                >
                  <RotateCcw size={16} />
                </button>
                <button
                  onClick={reset}
                  title="Reset view"
                  className={cn(
                    'px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-colors',
                    zoom !== 1 || rotate !== 0
                      ? 'text-[#21A053] bg-[#21A053]/8 hover:bg-[#21A053]/15'
                      : 'text-slate-300 cursor-default'
                  )}
                >
                  Reset
                </button>

                <div className="w-px h-5 bg-slate-200 mx-1" />
              </>
            )}

            <button
              type="button"
              onClick={() => setFullscreen((f) => !f)}
              title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              className="p-2 rounded-xl text-slate-400 hover:text-[#022135] hover:bg-slate-100 transition-colors"
            >
              {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* Download */}
            <a
              href={url}
              download
              target="_blank"
              rel="noopener noreferrer"
              title="Download prescription"
              className="p-2 rounded-xl text-slate-400 hover:text-[#00326F] hover:bg-slate-100 transition-colors"
            >
              <Download size={16} />
            </a>

            {/* Close */}
            <button
              onClick={onClose}
              title="Close"
              className="p-2 rounded-xl text-slate-400 hover:text-[#022135] hover:bg-slate-100 transition-colors ml-0.5"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Prescription content ── */}
        <div className="flex-1 overflow-auto bg-slate-100 flex items-start justify-center p-6">
          {isPdf ? (
            <iframe
              src={url}
              title="Prescription PDF"
              className="w-full h-full min-h-[400px] rounded-xl border border-slate-200 bg-white"
            />
          ) : (
            <div
              className="transition-transform duration-200 origin-top"
              style={{ transform: `scale(${zoom}) rotate(${rotate}deg)` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="Prescription"
                className="max-w-full rounded-xl shadow-lg border border-slate-200 bg-white"
                draggable={false}
              />
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  )
}
