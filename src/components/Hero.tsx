"use client";

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import type { HeroSlide } from '../lib/api'

const AUTOPLAY_MS = 4500
const SWIPE_THRESHOLD = 60

interface HeroProps {
  slides: HeroSlide[]
}

function Hero({ slides }: HeroProps) {
  const [index, setIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    if (isPaused || slides.length <= 1) return
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length)
    }, AUTOPLAY_MS)
    return () => clearInterval(timer)
  }, [isPaused, slides.length])

  if (slides.length === 0) return null

  const handlePanEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    if (info.offset.x <= -SWIPE_THRESHOLD) {
      setIndex((i) => (i + 1) % slides.length)
    } else if (info.offset.x >= SWIPE_THRESHOLD) {
      setIndex((i) => (i - 1 + slides.length) % slides.length)
    }
  }

  const slide = slides[index]

  return (
    <section className="relative px-3 pt-8 sm:px-6 sm:pt-10">
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.25rem] border border-sand-100 shadow-[0_30px_60px_-25px_rgba(138,84,39,0.35)] sm:rounded-[3rem]"
      >
        <motion.div
          className="relative h-[300px] touch-pan-y sm:h-[420px] md:h-[460px]"
          onPanStart={() => setIsPaused(true)}
          onPanEnd={handlePanEnd}
        >
          <AnimatePresence>
            <motion.img
              key={slide.id}
              src={slide.image}
              alt=""
              draggable={false}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: 'easeInOut' }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </AnimatePresence>
        </motion.div>

        {/* dots */}
        <div className="absolute inset-x-0 bottom-5 flex items-center justify-center gap-2 sm:bottom-7">
          {slides.map((s, i) => (
            <button
              key={s.id}
              aria-label={`رفتن به تصویر ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === index ? 'w-7 bg-white' : 'w-2 bg-white/60 hover:bg-white/85'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

export default Hero
