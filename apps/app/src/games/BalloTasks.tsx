import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { BalloTask } from '@giochi/engine';
import { T, tap } from '../ui/kit';
import { sfx } from '../ui/sound';
import { colors } from '../ui/theme';

/** I compiti della festa, da 5-10 secondi: il seme arriva dal server, le regole del compito stanno qui. */

function seeded(seed: number) {
  let x = seed | 1;
  return () => {
    x = (x + 0x6d2b79f5) | 0;
    let t = Math.imul(x ^ (x >>> 15), x | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffled<A>(items: A[], rand: () => number) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const box = { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 } as const;
const big = (size: number, bg: string) => ({ width: size, height: size, borderRadius: size * 0.24, borderWidth: 3, borderColor: colors.line, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }) as const;

function Maschere({ seed, width, onDone }: { seed: number; width: number; onDone: () => void }) {
  const order = useMemo(() => shuffled([1, 2, 3, 4, 5, 6], seeded(seed)), [seed]);
  const [next, setNext] = useState(1);
  const size = Math.floor((width - 16) / 3);
  return (
    <View style={box}>
      {order.map((n) => {
        const done = n < next;
        return (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={`Maschera ${n}`}
            disabled={done}
            onPress={() => {
              tap();
              if (n !== next) return setNext(1);
              sfx('pick');
              if (n === 6) onDone();
              setNext(n + 1);
            }}
            style={big(size, done ? colors.surface : colors.accent)}
          >
            <T size={13} color={done ? colors.dim : colors.onAccent}>
              🎭
            </T>
            <T size={24} weight="900" color={done ? colors.dim : colors.onAccent}>
              {n}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

const SEQ_COLORS = [
  { id: 'magenta', bg: '#FF2E88', mark: '♥' },
  { id: 'giallo', bg: '#FFE14D', mark: '★' },
  { id: 'turchese', bg: '#19D3C5', mark: '◆' },
  { id: 'bianco', bg: '#FFFDF6', mark: '●' },
];

function Colori({ seed, width, onDone }: { seed: number; width: number; onDone: () => void }) {
  const seq = useMemo(() => {
    const r = seeded(seed);
    return Array.from({ length: 4 }, () => Math.floor(r() * 4));
  }, [seed]);
  // Prima si guarda la sequenza (showing è il passo), poi si ripete.
  const [showing, setShowing] = useState(0);
  const [lit, setLit] = useState<number | null>(null);
  const [got, setGot] = useState(0);
  const playing = showing < seq.length;
  useEffect(() => {
    if (!playing) return;
    setLit(seq[showing]);
    const off = setTimeout(() => setLit(null), 480);
    const on = setTimeout(() => setShowing((i) => i + 1), 640);
    return () => {
      clearTimeout(off);
      clearTimeout(on);
    };
  }, [showing, playing]); // eslint-disable-line react-hooks/exhaustive-deps
  const size = Math.floor((width - 8) / 2.4);
  return (
    <View style={{ gap: 8 }}>
      <T size={13} weight="800" center color={playing ? colors.accent : colors.text}>
        {playing ? 'Guarda…' : `Ripeti: ${got} di ${seq.length}`}
      </T>
      <View style={box}>
        {SEQ_COLORS.map((c, i) => (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            accessibilityLabel={`Colore ${c.id}`}
            accessibilityState={{ disabled: playing }}
            disabled={playing}
            onPress={() => {
              tap();
              if (seq[got] !== i) {
                setGot(0);
                setShowing(0);
                return;
              }
              sfx('pick');
              if (got + 1 === seq.length) onDone();
              setGot(got + 1);
            }}
            style={[big(size, c.bg), { opacity: lit === null ? (playing ? 0.45 : 1) : lit === i ? 1 : 0.25 }, lit === i && { borderColor: colors.text, borderWidth: 5 }]}
          >
            <T size={26} weight="900" color={colors.onAccent}>
              {c.mark}
            </T>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Vino({ seed, width, onDone }: { seed: number; width: number; onDone: () => void }) {
  const target = useMemo(() => 45 + Math.floor(seeded(seed)() * 40), [seed]);
  const BAND = 6;
  const [level, setLevel] = useState(0);
  const [missed, setMissed] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const value = useRef(0);
  useEffect(() => () => void (timer.current && clearInterval(timer.current)), []);
  const start = () => {
    setMissed(false);
    timer.current = setInterval(() => {
      value.current = Math.min(100, value.current + 1.1);
      setLevel(value.current);
    }, 30);
  };
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (Math.abs(value.current - target) <= BAND) {
      sfx('pick');
      return onDone();
    }
    if (value.current > 0) setMissed(true);
    value.current = 0;
    setLevel(0);
  };
  const h = Math.min(170, width * 0.55);
  return (
    <View style={{ gap: 8, alignItems: 'center' }}>
      <View accessibilityLabel={`Vino ${Math.round(level)}, tacca ${target}`} style={{ width: 100, height: h, borderWidth: 3, borderColor: colors.line, borderRadius: 14, backgroundColor: '#FFFDF6', overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${level}%`, backgroundColor: colors.accent2 }} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: `${target - BAND}%`, height: `${BAND * 2}%`, borderTopWidth: 3, borderBottomWidth: 3, borderColor: colors.line, backgroundColor: 'rgba(255,225,77,0.55)' }} />
      </View>
      <T size={13} weight="800" center color={missed ? colors.danger : colors.text}>
        {missed ? 'Fuori dalla tacca: riprova' : 'Fermati sulla tacca gialla'}
      </T>
      <Pressable accessibilityRole="button" accessibilityLabel="Versa" onPressIn={start} onPressOut={stop} style={({ pressed }) => [big(84, pressed ? colors.accent2 : colors.accent), { width: Math.min(width, 240), height: 56, borderRadius: 18 }]}>
        <T size={16} weight="900" color={colors.onAccent}>
          🍷 Tieni premuto
        </T>
      </Pressable>
    </View>
  );
}

function Candele({ width, onDone }: { width: number; onDone: () => void }) {
  const [lit, setLit] = useState<number[]>([]);
  const size = Math.floor((width - 16) / 3);
  return (
    <View style={box}>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const on = lit.includes(i);
        return (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={on ? 'Candela accesa' : 'Candela spenta'}
            disabled={on}
            onPress={() => {
              tap();
              sfx('pick');
              const next = [...lit, i];
              setLit(next);
              if (next.length === 6) onDone();
            }}
            style={big(size, on ? colors.accent : colors.surface2)}
          >
            <T size={26} weight="900">{on ? '🔥' : '🕯️'}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

const TITLES: Record<BalloTask['kind'], string> = {
  maschere: 'Tocca le maschere in ordine',
  colori: 'Ricorda i colori',
  vino: 'Versa il vino',
  candele: 'Accendi tutte le candele',
};

/** Il compito di adesso. Cambia `task.n` e ne arriva uno nuovo. */
export function BalloTaskCard({ task, width, onDone }: { task: BalloTask; width: number; onDone: () => void }) {
  const [sent, setSent] = useState(false);
  const done = () => {
    if (sent) return;
    setSent(true);
    onDone();
  };
  const inner = width - 28;
  return (
    <View style={{ width, gap: 10, padding: 11, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 3, borderColor: colors.line }}>
      <T size={17} weight="900" center>
        {TITLES[task.kind]}
      </T>
      {task.kind === 'maschere' && <Maschere seed={task.seed} width={inner} onDone={done} />}
      {task.kind === 'colori' && <Colori seed={task.seed} width={inner} onDone={done} />}
      {task.kind === 'vino' && <Vino seed={task.seed} width={inner} onDone={done} />}
      {task.kind === 'candele' && <Candele width={inner} onDone={done} />}
    </View>
  );
}
