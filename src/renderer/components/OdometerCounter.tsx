import { useEffect, useRef } from 'react';
import { motion, useSpring, useTransform, type MotionValue } from 'motion/react';

interface OdometerCounterProps {
  value: number;
  label: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-4xl',
} as const;

const digitHeight: Record<string, number> = {
  sm: 28,
  md: 32,
  lg: 48,
};

function getColorForValue(value: number): string {
  if (value >= 100_000) return '#ef4444';
  if (value >= 10_000) return '#f97316';
  if (value >= 1_000) return '#fbbf24';
  return '#e6edf3';
}

function formatWithCommas(n: number): string {
  return n.toLocaleString('en-US');
}

function Digit({ digit, height }: { digit: MotionValue<number>; height: number }) {
  const y = useTransform(digit, (v) => -v * height);

  return (
    <div className="relative overflow-hidden" style={{ height, width: '0.65em' }}>
      <motion.div className="absolute left-0 top-0" style={{ y }}>
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className="flex items-center justify-center"
            style={{ height }}
          >
            {i}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function AnimatedDigit({ target, height }: { target: number; height: number }) {
  const spring = useSpring(0, { stiffness: 200, damping: 30 });

  useEffect(() => {
    spring.set(target);
  }, [target, spring]);

  return <Digit digit={spring} height={height} />;
}

export default function OdometerCounter({ value, label, color, size = 'md' }: OdometerCounterProps) {
  const formatted = formatWithCommas(value);
  const resolvedColor = color ?? getColorForValue(value);
  const h = digitHeight[size];
  const prevFormattedRef = useRef(formatted);

  // Track previous to keep stable digit array
  useEffect(() => {
    prevFormattedRef.current = formatted;
  }, [formatted]);

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">
        {label}
      </span>
      <div
        className={`led-text flex items-center font-mono ${sizeClasses[size]}`}
        style={{ color: resolvedColor }}
      >
        {formatted.split('').map((ch, i) => {
          if (ch === ',') {
            return (
              <span key={`sep-${i}`} className="mx-[1px]" style={{ lineHeight: `${h}px` }}>
                ,
              </span>
            );
          }
          return <AnimatedDigit key={`d-${formatted.length}-${i}`} target={Number(ch)} height={h} />;
        })}
      </div>
    </div>
  );
}
