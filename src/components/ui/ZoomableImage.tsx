import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Maximize2, 
  Minimize2, 
  RotateCcw, 
  RefreshCw,
  Move
} from 'lucide-react';

interface ZoomableImageProps {
  src: string;
  alt?: string;
  className?: string;
  maxZoom?: number;
  minZoom?: number;
  initialZoom?: number;
  showControls?: boolean;
  containerClassName?: string;
}

export const ZoomableImage: React.FC<ZoomableImageProps> = ({
  src,
  alt = 'Image preview',
  className = '',
  maxZoom = 4,
  minZoom = 1,
  initialZoom = 1,
  showControls = true,
  containerClassName = ''
}) => {
  const [scale, setScale] = useState(initialZoom);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset zoom & pan when image src changes
  useEffect(() => {
    setScale(initialZoom);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, [src, initialZoom]);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.5, maxZoom));
  };

  const handleZoomOut = () => {
    setScale(prev => {
      const next = Math.max(prev - 0.5, minZoom);
      if (next === 1) {
        setPosition({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const handleReset = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (scale > 1) {
      handleReset();
    } else {
      setScale(2.5);
    }
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey || scale > 1 || Math.abs(e.deltaY) > 0) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.25 : -0.25;
      setScale(prev => {
        const next = Math.min(Math.max(prev + delta, minZoom), maxZoom);
        if (next === 1) {
          setPosition({ x: 0, y: 0 });
        }
        return next;
      });
    }
  };

  // Mouse Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile
  const touchStartRef = useRef<{ dist: number; x: number; y: number }>({ dist: 0, x: 0, y: 0 });

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartRef.current = { dist, x: 0, y: 0 };
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (touchStartRef.current.dist > 0) {
        const factor = dist / touchStartRef.current.dist;
        setScale(prev => Math.min(Math.max(prev * factor, minZoom), maxZoom));
      }
      touchStartRef.current.dist = dist;
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    touchStartRef.current.dist = 0;
  };

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full flex items-center justify-center overflow-hidden select-none group/zoom ${containerClassName}`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in' }}
    >
      {/* Target Image with transforms */}
      <div 
        className="w-full h-full flex items-center justify-center transition-transform duration-75 ease-out"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`
        }}
      >
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          onDoubleClick={handleDoubleClick}
          draggable={false}
          className={`max-w-full max-h-full object-contain pointer-events-auto transition-all ${className}`}
        />
      </div>

      {/* Floating Zoom & Manipulation Toolbar */}
      {showControls && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 sm:gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-950/80 backdrop-blur-md border border-slate-800 text-white shadow-2xl transition-opacity duration-200 opacity-90 group-hover/zoom:opacity-100">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= minZoom}
            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors"
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          {/* Scale Indicator */}
          <button
            type="button"
            onClick={handleReset}
            className="px-2 py-0.5 rounded-lg text-xs font-mono font-bold text-amber-400 hover:bg-slate-800 transition-colors"
            title="Click to reset zoom"
          >
            {Math.round(scale * 100)}%
          </button>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= maxZoom}
            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-4 bg-slate-800 mx-0.5" />

          <button
            type="button"
            onClick={handleRotate}
            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Rotate 90° Clockwise"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {scale > 1 && (
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 rounded-xl text-slate-300 hover:text-amber-400 hover:bg-slate-800 transition-colors"
              title="Reset Zoom & Pan"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Helper Pill when zoomed */}
      {scale > 1 && (
        <div className="absolute top-3 left-3 z-20 pointer-events-none px-2.5 py-1 rounded-xl bg-slate-950/70 border border-slate-800 text-[10px] font-medium text-slate-300 backdrop-blur-sm flex items-center gap-1.5">
          <Move className="w-3 h-3 text-amber-400 animate-pulse" />
          <span>Drag to pan image</span>
        </div>
      )}
    </div>
  );
};
