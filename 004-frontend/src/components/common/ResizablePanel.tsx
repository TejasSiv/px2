import React, { useState, useRef, useCallback, useEffect } from 'react';

interface ResizablePanelProps {
  children: React.ReactNode;
  minHeight?: number;
  maxHeight?: number;
  initialHeight?: number;
  onHeightChange?: (height: number) => void;
  className?: string;
  disabled?: boolean;
}

const ResizablePanel: React.FC<ResizablePanelProps> = ({
  children,
  minHeight = 200,
  maxHeight = 800,
  initialHeight = 400,
  onHeightChange,
  className = '',
  disabled = false
}) => {
  const [height, setHeight] = useState(initialHeight);
  const [isResizing, setIsResizing] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number>(0);
  const startHeight = useRef<number>(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    
    e.preventDefault();
    setIsResizing(true);
    startY.current = e.clientY;
    startHeight.current = height;
    
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, [height, disabled]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const deltaY = e.clientY - startY.current;
    const newHeight = Math.min(
      Math.max(startHeight.current + deltaY, minHeight),
      maxHeight
    );
    
    setHeight(newHeight);
    onHeightChange?.(newHeight);
  }, [isResizing, minHeight, maxHeight, onHeightChange]);

  const handleMouseUp = useCallback(() => {
    if (!isResizing) return;
    
    setIsResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [isResizing]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;
    
    const step = e.shiftKey ? 50 : 10;
    let newHeight = height;
    
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      newHeight = Math.max(height - step, minHeight);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      newHeight = Math.min(height + step, maxHeight);
    } else if (e.key === 'Home') {
      e.preventDefault();
      newHeight = minHeight;
    } else if (e.key === 'End') {
      e.preventDefault();
      newHeight = maxHeight;
    }
    
    if (newHeight !== height) {
      setHeight(newHeight);
      onHeightChange?.(newHeight);
    }
  }, [height, minHeight, maxHeight, disabled, onHeightChange]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Show resize hint on first mount
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(true), 1000);
    const hideTimer = setTimeout(() => setShowHint(false), 4000);
    return () => {
      clearTimeout(timer);
      clearTimeout(hideTimer);
    };
  }, []);

  return (
    <div 
      ref={panelRef}
      className={`relative border border-dark-border rounded-lg bg-dark-secondary overflow-hidden ${className}`}
      style={{ height: `${height}px` }}
    >
      {/* Panel Content */}
      <div className="h-full w-full">
        {children}
      </div>
      
      {/* Resize Handle */}
      {!disabled && (
        <div
          className={`
            absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize
            hover:bg-status-active/20 transition-all duration-200
            ${isResizing ? 'bg-status-active/30' : showHint ? 'bg-status-active/10' : 'bg-transparent hover:bg-dark-hover/50'}
            group flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-status-active/50
          `}
          onMouseDown={handleMouseDown}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="separator"
          aria-orientation="horizontal"
          aria-label={`Resize panel. Current height: ${height}px. Range: ${minHeight}px to ${maxHeight}px. Use arrow keys to adjust, Shift+arrows for larger steps.`}
          title={`Drag to resize panel (${minHeight}px - ${maxHeight}px). Keyboard: ↑↓ arrows, Shift+arrows for 50px steps, Home/End for min/max`}
        >
          {/* Drag Handle Bar */}
          <div className={`
            h-1 rounded-full transition-all duration-200 relative
            ${isResizing 
              ? 'w-16 bg-status-active shadow-lg' 
              : 'w-12 bg-text-muted/40 group-hover:bg-status-active/70 group-hover:w-16'
            }
          `}>
            {/* Animated dots for better visual feedback */}
            <div className={`
              absolute inset-0 flex items-center justify-center gap-0.5 transition-opacity
              ${isResizing ? 'opacity-0' : 'opacity-100 group-hover:opacity-0'}
            `}>
              {[0, 1, 2].map((dot) => (
                <div
                  key={dot}
                  className="w-0.5 h-0.5 bg-current rounded-full"
                />
              ))}
            </div>
          </div>
          
          {/* Resize Indicator Text */}
          {isResizing && (
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 
                          bg-dark-tertiary text-text-primary text-xs px-2 py-1 rounded 
                          border border-dark-border shadow-lg whitespace-nowrap">
              {height}px
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ResizablePanel;