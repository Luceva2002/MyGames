import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { arcadeRng, type ArcadeMove, type ArcadeView } from '@giochi/engine';
import { useFit, usePaused, type BoardProps } from '../common';
import { TableBg } from '../../ui/tables';
import { sfx } from '../../ui/sound';
import { type Dir, Hud, NO_SELECT, StartCard, swipeDir, useKeys, useRecord } from './kit';

/**
 * Snake (id serpentina): un serpente verde che avanza da solo su una griglia; le mele rosse lo allungano, quella d'oro vale cinque.
 * Si guida scorrendo il dito; sbattere contro il bordo o contro se stesso fa finire la partita.
 * Disegnato come l'icona, nello stile Inchiostro: contorno nero e colori veri.
 */
const COLS = 12;
const INK = '#141414';
const SNAKE = '#4FA663';
const BELLY = '#8BCB7A';
const APPLE = '#DB3A45';
const GOLD = '#F2BD4D';
const LEAF = '#4FA663';
const STEM = '#7A4A26';
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
    food: { x: 10, y: mid },
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
      g.food = freeCell();
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
          <View style={{ width: cell * COLS + 6, height: cell * ROWS + 6, borderRadius: 12, borderWidth: 3, borderColor: g.crash ? APPLE : INK, backgroundColor: '#201F21', overflow: 'hidden' }}>
            <Svg width={cell * COLS} height={cell * ROWS} style={{ margin: 0 }} pointerEvents="none">
              {/* Prato appena accennato a scacchi. */}
              {Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => ((r + c) % 2 ? null : <Rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} fill="#FFFFFF" opacity={0.035} />)))}
              <Apple x={g.food.x} y={g.food.y} cell={cell} color={APPLE} />
              {g.gold && !goldBlink && <Apple x={g.gold.x} y={g.gold.y} cell={cell} color={GOLD} />}
              {/* Una copia nuova a ogni passo: il corpo cambia sul posto e il React Compiler terrebbe il disegno vecchio. */}
              <Snake body={g.body.map(([x, y]) => [x, y] as [number, number])} cell={cell} dir={g.dir} dead={g.crash} />
            </Svg>
          </View>
        </View>
      </View>
      {!started && active && (
        <StartCard title="Snake" lines={['Scorri col dito per girare: su, giù, sinistra, destra.', 'Sul computer: frecce o W A S D.']} onStart={() => setStarted(true)} />
      )}
    </TableBg>
  );
}

/** Il serpente: un tubo verde col contorno nero che passa per il centro delle caselle, la pancia a puntini e la testa con gli occhi. */
function Snake({ body, cell, dir, dead }: { body: [number, number][]; cell: number; dir: Dir; dead: boolean }) {
  const c = (v: number) => v * cell + cell / 2;
  const d = body.map(([x, y], i) => `${i ? 'L' : 'M'}${c(x)} ${c(y)}`).join(' ');
  const w = cell * 0.66;
  const line = Math.max(2, cell * 0.1);
  const [hx, hy] = body[0];
  const [dx, dy] = STEP[dir];
  const ox = -dy, oy = dx; // di lato rispetto alla direzione
  const eye = (k: 1 | -1) => ({ x: c(hx) + dx * cell * 0.12 + ox * k * cell * 0.2, y: c(hy) + dy * cell * 0.12 + oy * k * cell * 0.2 });
  const tip = { x: c(hx) + dx * cell * 0.42, y: c(hy) + dy * cell * 0.42 };
  return (
    <G>
      {body.length > 1 && <Path d={d} stroke={INK} strokeWidth={w + line * 2} strokeLinecap="round" strokeLinejoin="round" fill="none" />}
      {body.length > 1 && <Path d={d} stroke={SNAKE} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />}
      {body.slice(1).map(([x, y], i) => (i % 2 ? null : <Circle key={i} cx={c(x)} cy={c(y)} r={cell * 0.1} fill={BELLY} />))}
      {!dead && <Path d={`M${tip.x} ${tip.y} l${dx * cell * 0.22} ${dy * cell * 0.22}`} stroke={APPLE} strokeWidth={Math.max(1.5, cell * 0.08)} strokeLinecap="round" />}
      <Circle cx={c(hx)} cy={c(hy)} r={cell * 0.46} fill={SNAKE} stroke={INK} strokeWidth={line} />
      {([1, -1] as const).map((k) => {
        const e = eye(k);
        return dead ? (
          <Path key={k} d={`M${e.x - cell * 0.09} ${e.y - cell * 0.09} L${e.x + cell * 0.09} ${e.y + cell * 0.09} M${e.x + cell * 0.09} ${e.y - cell * 0.09} L${e.x - cell * 0.09} ${e.y + cell * 0.09}`} stroke={INK} strokeWidth={Math.max(1.5, cell * 0.07)} strokeLinecap="round" />
        ) : (
          <G key={k}>
            <Circle cx={e.x} cy={e.y} r={cell * 0.13} fill="#FFFFFF" stroke={INK} strokeWidth={Math.max(1, cell * 0.05)} />
            <Circle cx={e.x + dx * cell * 0.04} cy={e.y + dy * cell * 0.04} r={cell * 0.065} fill={INK} />
          </G>
        );
      })}
    </G>
  );
}

/** Una mela col contorno nero, la foglia e il picciolo: rossa normale, gialla quella d'oro. */
function Apple({ x, y, cell, color }: { x: number; y: number; cell: number; color: string }) {
  const cx = x * cell + cell / 2;
  const cy = y * cell + cell * 0.56;
  const r = cell * 0.32;
  const line = Math.max(1.5, cell * 0.08);
  return (
    <G>
      <Path d={`M${cx} ${cy - r * 0.9} Q${cx + r * 0.1} ${cy - r * 1.5} ${cx + r * 0.35} ${cy - r * 1.6}`} stroke={STEM} strokeWidth={line} strokeLinecap="round" fill="none" />
      <Ellipse cx={cx + r * 0.6} cy={cy - r * 1.25} rx={r * 0.45} ry={r * 0.24} fill={LEAF} stroke={INK} strokeWidth={line * 0.7} transform={`rotate(-25 ${cx + r * 0.6} ${cy - r * 1.25})`} />
      <Circle cx={cx} cy={cy} r={r} fill={color} stroke={INK} strokeWidth={line} />
      <Circle cx={cx - r * 0.38} cy={cy - r * 0.35} r={r * 0.2} fill="#FFFFFF" opacity={0.7} />
    </G>
  );
}
