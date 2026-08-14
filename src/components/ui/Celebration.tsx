import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import clsx from 'clsx';

export type CelebrationKind = 'added' | 'settled';

interface CelebrationOptions {
  kind?: CelebrationKind;
  message?: string;
}

interface CelebrationEvent {
  id: number;
  kind: CelebrationKind;
  message: string;
}

interface CelebrationContextValue {
  celebrate: (options?: CelebrationOptions) => void;
}

const CelebrationContext = createContext<CelebrationContextValue | null>(null);

const PARTICLES = [
  { x: -72, y: -28, size: 7, delay: 0, color: '#9b8cff' },
  { x: -54, y: -55, size: 5, delay: 25, color: '#38bdf8' },
  { x: -26, y: -68, size: 6, delay: 55, color: '#34d399' },
  { x: 4, y: -73, size: 5, delay: 20, color: '#fbbf24' },
  { x: 35, y: -64, size: 7, delay: 60, color: '#9b8cff' },
  { x: 64, y: -42, size: 5, delay: 35, color: '#38bdf8' },
  { x: 78, y: -10, size: 6, delay: 80, color: '#34d399' },
  { x: 54, y: 18, size: 5, delay: 20, color: '#fbbf24' },
  { x: 26, y: 28, size: 6, delay: 70, color: '#9b8cff' },
  { x: -12, y: 30, size: 5, delay: 35, color: '#38bdf8' },
  { x: -43, y: 20, size: 7, delay: 65, color: '#34d399' },
  { x: -68, y: 2, size: 5, delay: 15, color: '#fbbf24' },
] as const;

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [event, setEvent] = useState<CelebrationEvent | null>(null);
  const nextId = useRef(1);
  const timeout = useRef<number | undefined>();

  const celebrate = useCallback((options: CelebrationOptions = {}) => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const kind = options.kind ?? 'added';
    const id = nextId.current++;
    const message = options.message ?? (kind === 'settled' ? 'All settled' : 'Added');

    window.clearTimeout(timeout.current);
    setEvent({ id, kind, message });
    timeout.current = window.setTimeout(() => {
      setEvent((current) => (current?.id === id ? null : current));
    }, 1900);
  }, []);

  const value = useMemo(() => ({ celebrate }), [celebrate]);

  return (
    <CelebrationContext.Provider value={value}>
      {children}
      {event && typeof document !== 'undefined'
        ? createPortal(<Celebration event={event} />, document.body)
        : null}
    </CelebrationContext.Provider>
  );
}

function Celebration({ event }: { event: CelebrationEvent }) {
  const visibleParticles = event.kind === 'settled' ? PARTICLES : PARTICLES.filter((_, index) => index % 2 === 0);

  return (
    <div className="celebration-wrap" aria-hidden="true">
      <div className={clsx('celebration-pill', event.kind === 'settled' && 'celebration-settled')}>
        {visibleParticles.map((particle, index) => (
          <span
            key={`${event.id}-${index}`}
            className="celebration-particle"
            style={
              {
                '--particle-x': `${particle.x}px`,
                '--particle-y': `${particle.y}px`,
                '--particle-size': `${particle.size}px`,
                '--particle-delay': `${particle.delay}ms`,
                '--particle-color': particle.color,
              } as CSSProperties
            }
          />
        ))}
        <span className="celebration-icon"><Check size={16} strokeWidth={2.8} /></span>
        <span>{event.message}</span>
      </div>
    </div>
  );
}

export function useCelebration(): CelebrationContextValue {
  const value = useContext(CelebrationContext);
  if (!value) throw new Error('useCelebration must be used inside <CelebrationProvider>');
  return value;
}
