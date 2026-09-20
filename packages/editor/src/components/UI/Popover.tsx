import { useLayoutEffect, useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type Placement = 'auto' | 'bottom' | 'top' | 'left' | 'right';

interface PopoverProps {
  anchor: HTMLElement | null;
  open: boolean;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
  placement?: Placement;
}

export default function Popover({
  anchor,
  open,
  children,
  onClose,
  className = '',
  placement = 'auto',
}: PopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!open || !anchor) return;

    const update = () => {
      if (!popoverRef.current || !anchor) return;
      const rect = anchor.getBoundingClientRect();
      const pw = popoverRef.current.offsetWidth;
      const ph = popoverRef.current.offsetHeight;
      const gap = 8;
      const margin = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let chosenPlacement = placement;
      if (placement === 'auto') {
        const spaces = {
          bottom: vh - rect.bottom - margin,
          top: rect.top - margin,
          left: rect.left - margin,
          right: vw - rect.right - margin,
        };
        const order = ['bottom', 'top', 'left', 'right'] as const;
        chosenPlacement = order.reduce(
          (best, dir) => (spaces[dir] > spaces[best] ? dir : best),
          'bottom' as const,
        );
      }

      let left = 0;
      let top = 0;
      if (chosenPlacement === 'bottom') {
        left = rect.left;
        top = rect.bottom + gap;
        if (left + pw > vw - margin) left = Math.max(margin, vw - pw - margin);
      } else if (chosenPlacement === 'top') {
        left = rect.left;
        top = rect.top - ph - gap;
        if (left + pw > vw - margin) left = Math.max(margin, vw - pw - margin);
      } else if (chosenPlacement === 'left') {
        top = rect.top;
        left = rect.left - pw - gap;
        if (top + ph > vh - margin) top = Math.max(margin, vh - ph - margin);
      } else if (chosenPlacement === 'right') {
        top = rect.top;
        left = rect.right + gap;
        if (top + ph > vh - margin) top = Math.max(margin, vh - ph - margin);
      }

      setPos({ left, top });
    };

    update();
    const raf = requestAnimationFrame(update);

    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchor, open, placement]);

  useEffect(() => {
    if (!open || !onClose) return;
    const handle = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        anchor &&
        !anchor.contains(target)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open, onClose, anchor]);

  if (!open) return null;

  return createPortal(
    <div
      ref={popoverRef}
      className={`fixed z-[9999] ${className}`}
      style={{ left: pos.left, top: pos.top }}
    >
      {children}
    </div>,
    document.body
  );
}
