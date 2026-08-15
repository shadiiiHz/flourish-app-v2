"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

function MarqueeText({ text, className }: { text: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    const measure = () => {
      const overflow = textEl.scrollWidth - container.clientWidth;
      if (overflow <= 1) {
        setDistance(0);
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const textRect = textEl.getBoundingClientRect();
      const overflowsLeft = containerRect.left - textRect.left;
      const overflowsRight = textRect.right - containerRect.right;
      const direction = overflowsLeft > overflowsRight ? 1 : -1;
      // Shift by the text's full width so it scrolls completely past the
      // edge it exits from before the loop resets (the reset then happens
      // while nothing is visible, instead of snapping mid-sentence).
      setDistance(direction * textRect.width);
    };

    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(container);
    resizeObserver.observe(textEl);
    return () => resizeObserver.disconnect();
  }, [text]);

  const duration = Math.max(Math.abs(distance) / 26, 5);

  return (
    <div ref={containerRef} className={`overflow-hidden whitespace-nowrap ${className ?? ""}`}>
      <span
        ref={textRef}
        className="inline-block"
        style={
          distance !== 0
            ? ({
                "--marquee-distance": `${distance}px`,
                animation: `marquee-text ${duration}s linear infinite`,
              } as CSSProperties)
            : undefined
        }
      >
        {text}
      </span>
    </div>
  );
}

export default MarqueeText;
