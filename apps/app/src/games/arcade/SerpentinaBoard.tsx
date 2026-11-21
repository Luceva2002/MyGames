import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import { arcadeRng, type ArcadeMove, type ArcadeView } from '@giochi/engine';
import { useFit, usePaused, type BoardProps } from '../common';
import { TableBg } from '../../ui/tables';
import { T } from '../../ui/kit';
import { sfx } from '../../ui/sound';
import { colors } from '../../ui/theme';
import { type Dir, Hud, NO_SELECT, StartCard, swipeDir, useKeys, useRecord } from './kit';

/**
 * Serpentina: una stella filante che avanza da sola su una griglia; i confetti la allungano.
 * Si guida scorrendo il dito; sbattere contro il bordo o contro se stessa fa finire la partita.
 */
const COLS = 12;
const STRIPES = ['#FF4F8B', '#FFC933', '#2EC4B6', '#B57BFF'];
const CONFETTI = ['#FF4F8B', '#FFC933', '#2EC4B6', '#FFFFFF', '#B57BFF', '#FF9F1C'];
const STEP: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
const GOLD_MS = 6000;

export function SerpentinaBoard({ view, myTurn, onMove }: BoardProps<ArcadeView, ArcadeMove>) {
  return <Game key={view.seed} seed={view.seed} active={myTurn && !view.over} onMove={onMove} />;
}

function Game({ seed, active, onMove }: { seed: number; active: boolean; onMove: (m: ArcadeMove) => void }) {
  const { box, onLayout } = useFit();
  // Le righe seguono la forma dello schermo, così il campo lo riempie; si fissano alla prima misura.
  const [rows, setRows] = useState(0);
  useEffect(() => {
    if (!rows && box.w > 0 && box.h > 0) setRows(Math.max(12, Math.min(26, Math.floor(((box.h - 8) / (box.w - 8)) * COLS))));
  }, [box.w, box.h]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={{ flex: 1 }}>
      <TableBg table="teal">
        <View style={{ flex: 1, paddingTop: 64, paddingHorizontal: 8, paddingBottom: 8 }}>
          <View style={{ flex: 1 }} onLayout={onLayout} />
        </View>
      </TableBg>
      {rows > 0 && (
        <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
          <Field seed={seed} active={active} onMove={onMove} ROWS={rows} />
        </View>
      )}
    </View>
  );
}

function Field({ seed, active, onMove, ROWS }: { seed: number; active: boolean; onMove: (m: ArcadeMove) => void; ROWS: number }) {
  const paused = usePaused();
  const { best, submit } = useRecord('serpentina');
  const { box, onLayout } = useFit();
  const [started, setStarted] = useState(false);
  const [, setFrame] = useState(0);
  const rnd = useMemo(() => arcadeRng(seed), [seed]);
  const mid = Math.floor(ROWS / 2);
  const g = useRef({
    body: [
      [4, mid],
      [3, mid],
      [2, mid],
    ] as [number, number][],
    dir: 'right' as Dir,
    queue: [] as Dir[],
    food: { x: 10, y: mid, color: CONFETTI[0] },
    gold: null as { x: number; y: number; left: number } | null,
    eaten: 0,
    score: 0,
    grow: 0,
    over: false,
    crash: false,
  }).current;

  const freeCell = () => {
    for (let k = 0; k < 400; k++) {
      const x = Math.floor(rnd() * COLS);
      const y = Math.floor(rnd() * ROWS);
      if (!g.body.some(([bx, by]) => bx === x && by === y) && !(g.food.x === x && g.food.y === y) && !(g.gold && g.gold.x === x && g.gold.y === y)) return { x, y };
    }
    return { x: 0, y: 0 };
  };

  const finish = () => {
    g.over = true;
    g.crash = true;
    sfx('pocket');
    const record = submit(g.score);
    setTimeout(() => onMove({ type: 'end', score: g.score, record, note: `lunga ${g.body.length}` }), 900);
  };

  const tick = (ms: number) => {
    if (g.over) return;
    const next = g.queue.shift();
    if (next && next !== OPPOSITE[g.dir]) g.dir = next;
    const [dx, dy] = STEP[g.dir];
    const [hx, hy] = g.body[0];
    const head: [number, number] = [hx + dx, hy + dy];
    const tailMoves = g.grow === 0;
    const hitsBody = g.body.slice(0, tailMoves ? -1 : undefined).some(([x, y]) => x === head[0] && y === head[1]);
    if (head[0] < 0 || head[0] >= COLS || head[1] < 0 || head[1] >= ROWS || hitsBody) return finish();
    g.body.unshift(head);
    if (tailMoves) g.body.pop();
    else g.grow--;
    if (head[0] === g.food.x && head[1] === g.food.y) {
      g.score += 1;
      g.eaten++;
      g.grow += 1;
      sfx('pick');
      g.food = { ...freeCell(), color: CONFETTI[g.eaten % CONFETTI.length] };
      if (!g.gold && g.eaten % 6 === 0) g.gold = { ...freeCell(), left: GOLD_MS };
    }
    if (g.gold) {
      if (head[0] === g.gold.x && head[1] === g.gold.y) {
        g.score += 5;
        g.grow += 2;
        g.gold = null;
        sfx('capture');
      } else {
        g.gold.left -= ms;
        if (g.gold.left <= 0) g.gold = null;
      }
    }
  };

  const running = started && active && !paused && !g.over;
  const speed = Math.max(70, 165 - g.eaten * 3);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      tick(speed);
      setFrame((f) => f + 1);
    }, speed);
    return () => clearInterval(t);
  }, [running, speed]); // eslint-disable-line react-hooks/exhaustive-deps

  const turn = (d: Dir) => {
    const last = g.queue[g.queue.length - 1] ?? g.dir;
    if (d === last || d === OPPOSITE[last] || g.queue.length >= 2) return;
    g.queue.push(d);
  };
  useKeys((k) => {
    const map: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
    if (!running || !map[k]) return false;
    turn(map[k]);
    return true;
  }, running);

  // Si scorre ovunque sul tavolo: ogni tratto lungo abbastanza è una svolta, anche senza staccare il dito.
  const origin = useRef({ x: 0, y: 0 });
  const runningRef = useRef(running);
  runningRef.current = running;
  const responder = useMemo(
    () =>
      PanResponder.create({
        onPanResponderTerminationRequest: () => false,
        onStartShouldSetPanResponder: () => runningRef.current,
        onMoveShouldSetPanResponder: () => runningRef.current,
        onPanResponderGrant: () => {
          origin.current = { x: 0, y: 0 };
        },
        onPanResponderMove: (_, gs) => {
          const d = swipeDir(gs.dx - origin.current.x, gs.dy - origin.current.y, 22);
          if (!d) return;
          turn(d);
          origin.current = { x: gs.dx, y: gs.dy };
        },
      }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const cell = Math.floor(Math.max(8, Math.min((box.w - 8) / COLS, (box.h - 8) / ROWS)));
  const goldBlink = g.gold && g.gold.left < 2000 && Math.floor(g.gold.left / 250) % 2 === 0;

  return (
    <TableBg table="teal">
      <View style={[{ flex: 1, paddingTop: 64, paddingHorizontal: 8, paddingBottom: 8 }, NO_SELECT]} {...responder.panHandlers}>
        <Hud score={g.score} best={best} extra={`lunga ${g.body.length}`} style={{ top: 8, left: 8 }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} onLayout={onLayout}>
          <View style={{ width: cell * COLS + 6, height: cell * ROWS + 6, borderRadius: 12, borderWidth: 1.5, borderColor: g.crash ? colors.accent2 : colors.line, backgroundColor: 'rgba(13,14,17,0.72)', overflow: 'hidden' }}>
            {/* Scacchiera appena accennata. */}
            {Array.from({ length: ROWS }, (_, r) =>
              Array.from({ length: COLS }, (_, c) =>
                (r + c) % 2 ? null : <View key={`${r}-${c}`} pointerEvents="none" style={{ position: 'absolute', left: c * cell, top: r * cell, width: cell, height: cell, backgroundColor: 'rgba(255,255,255,0.035)' }} />,
              ),
            )}
            <View pointerEvents="none" style={{ position: 'absolute', left: g.food.x * cell + cell * 0.2, top: g.food.y * cell + cell * 0.2, width: cell * 0.6, height: cell * 0.6, borderRadius: cell * 0.3, backgroundColor: g.food.color, borderWidth: 2, borderColor: colors.line }} />
            {g.gold && !goldBlink && (
              <View pointerEvents="none" style={{ position: 'absolute', left: g.gold.x * cell, top: g.gold.y * cell, width: cell, height: cell, alignItems: 'center', justifyContent: 'center' }}>
                <T size={cell * 0.8} style={{ lineHeight: cell }}>
                  🍬
                </T>
              </View>
            )}
            {g.body.map(([x, y], i) => {
              const head = i === 0;
              const inset = head ? 0 : cell * 0.1;
              return (
                <View
                  key={i}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: x * cell + inset,
                    top: y * cell + inset,
                    width: cell - inset * 2,
                    height: cell - inset * 2,
                    borderRadius: head ? cell * 0.35 : cell * 0.22,
                    backgroundColor: head ? colors.accent : STRIPES[i % STRIPES.length],
                    borderWidth: 2,
                    borderColor: colors.line,
                    zIndex: head ? 2 : 1,
                  }}
                >
                  {head && <Eyes dir={g.dir} size={cell} dead={g.crash} />}
                </View>
              );
            })}
          </View>
        </View>
      </View>
      {!started && active && (
        <StartCard title="Serpentina" lines={['Scorri col dito per girare: su, giù, sinistra, destra.', 'Sul computer: frecce o W A S D.']} onStart={() => setStarted(true)} />
      )}
    </TableBg>
  );
}

function Eyes({ dir, size, dead }: { dir: Dir; size: number; dead: boolean }) {
  const e = Math.max(3, size * 0.2);
  const vertical = dir === 'up' || dir === 'down';
  const pos = (k: 0 | 1) => {
    const a = size * 0.18 + k * size * 0.38;
    const b = dir === 'up' || dir === 'left' ? size * 0.18 : size * 0.42;
    return vertical ? { left: a, top: b } : { left: b, top: a };
  };
  return (
    <>
      {([0, 1] as const).map((k) => (
        <View key={k} style={{ position: 'absolute', ...pos(k), width: e, height: e, borderRadius: e / 2, backgroundColor: dead ? 'transparent' : colors.line, alignItems: 'center', justifyContent: 'center' }}>
          {dead && <T size={e * 1.4} weight="900" color={colors.line} style={{ lineHeight: e * 1.4 }}>×</T>}
        </View>
      ))}
    </>
  );
}
