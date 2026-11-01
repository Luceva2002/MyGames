import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import { arcadeRng, type ArcadeMove, type ArcadeView } from '@giochi/engine';
import { useFit, usePaused, type BoardProps } from '../common';
import { TableBg } from '../../ui/tables';
import { T, tap } from '../../ui/kit';
import { sfx } from '../../ui/sound';
import { colors } from '../../ui/theme';
import { Hud, NO_SELECT, PadButton, StartCard, useKeys, useRecord } from './kit';

/**
 * Coriandoli: pezzi che cadono in una vasca 10×18. Oltre ai sette pezzi da quattro ogni tanto
 * arriva un coriandolo piccolo da tre. Le righe piene esplodono; più righe insieme valgono di più.
 */
const W = 10;
const H = 18;

type Shape = number[][];
interface PieceDef {
  shape: Shape;
  color: string;
}

const PIECES: PieceDef[] = [
  { shape: [[1, 1, 1, 1]], color: '#19D3C5' },
  { shape: [[1, 1], [1, 1]], color: '#FFE14D' },
  { shape: [[0, 1, 0], [1, 1, 1]], color: '#B57BFF' },
  { shape: [[1, 0, 0], [1, 1, 1]], color: '#56B4E9' },
  { shape: [[0, 0, 1], [1, 1, 1]], color: '#FF9F1C' },
  { shape: [[0, 1, 1], [1, 1, 0]], color: '#7CF0B0' },
  { shape: [[1, 1, 0], [0, 1, 1]], color: '#FF2E88' },
];
/** I coriandoli piccoli, da tre. */
const SMALL: PieceDef[] = [
  { shape: [[1, 1, 1]], color: '#FFFFFF' },
  { shape: [[1, 0], [1, 1]], color: '#FFFFFF' },
];

interface Active {
  def: PieceDef;
  shape: Shape;
  x: number;
  y: number;
}

const rotate = (s: Shape): Shape => s[0].map((_, c) => s.map((row) => row[c]).reverse());
const LINE_POINTS = [0, 100, 300, 500, 800];

export function CoriandoliBoard({ view, myTurn, onMove }: BoardProps<ArcadeView, ArcadeMove>) {
  return <Game key={view.seed} seed={view.seed} active={myTurn && !view.over} onMove={onMove} />;
}

function Game({ seed, active, onMove }: { seed: number; active: boolean; onMove: (m: ArcadeMove) => void }) {
  const paused = usePaused();
  const { best, submit } = useRecord('coriandoli');
  const { box, onLayout } = useFit();
  const [started, setStarted] = useState(false);
  const [, setFrame] = useState(0);
  const redraw = () => setFrame((f) => f + 1);

  const rnd = useMemo(() => arcadeRng(seed), [seed]);
  const g = useRef({
    grid: Array.from({ length: H }, () => Array<string | null>(W).fill(null)),
    bag: [] as number[],
    piece: null as Active | null,
    next: null as PieceDef | null,
    score: 0,
    lines: 0,
    level: 1,
    over: false,
    flash: [] as number[],
    sinceSmall: 0,
  }).current;

  const draw = (): PieceDef => {
    g.sinceSmall++;
    if (g.sinceSmall > 6 && rnd() < 0.12) {
      g.sinceSmall = 0;
      return SMALL[Math.floor(rnd() * SMALL.length)];
    }
    if (!g.bag.length) {
      g.bag = [0, 1, 2, 3, 4, 5, 6];
      for (let i = g.bag.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [g.bag[i], g.bag[j]] = [g.bag[j], g.bag[i]];
      }
    }
    return PIECES[g.bag.pop()!];
  };

  const fits = (shape: Shape, x: number, y: number) =>
    shape.every((row, r) => row.every((v, c) => !v || (x + c >= 0 && x + c < W && y + r < H && (y + r < 0 || !g.grid[y + r][x + c]))));

  const finish = () => {
    if (g.over) return;
    g.over = true;
    redraw();
    const record = submit(g.score);
    setTimeout(() => onMove({ type: 'end', score: g.score, record, note: `${g.lines} ${g.lines === 1 ? 'riga' : 'righe'}, livello ${g.level}` }), 700);
  };

  const spawn = () => {
    const def = g.next ?? draw();
    g.next = draw();
    const shape = def.shape;
    const p: Active = { def, shape, x: Math.floor((W - shape[0].length) / 2), y: -shape.length + 1 };
    if (!fits(shape, p.x, p.y)) {
      g.piece = null;
      finish();
      return;
    }
    g.piece = p;
  };

  const lock = () => {
    const p = g.piece;
    if (!p) return;
    let out = false;
    p.shape.forEach((row, r) =>
      row.forEach((v, c) => {
        if (!v) return;
        if (p.y + r < 0) out = true;
        else g.grid[p.y + r][p.x + c] = p.def.color;
      }),
    );
    g.piece = null;
    if (out) return finish();
    const full = g.grid.flatMap((row, r) => (row.every(Boolean) ? [r] : []));
    if (full.length) {
      g.flash = full;
      sfx(full.length >= 3 ? 'scopa' : 'capture');
      redraw();
      setTimeout(() => {
        g.grid = [...Array.from({ length: full.length }, () => Array<string | null>(W).fill(null)), ...g.grid.filter((_, r) => !full.includes(r))];
        g.flash = [];
        g.lines += full.length;
        g.score += LINE_POINTS[Math.min(4, full.length)] * g.level;
        g.level = 1 + Math.floor(g.lines / 8);
        spawn();
        redraw();
      }, 260);
      return;
    }
    sfx('card');
    spawn();
  };

  const move = (dx: number) => {
    const p = g.piece;
    if (!p || g.flash.length) return;
    if (fits(p.shape, p.x + dx, p.y)) {
      p.x += dx;
      redraw();
    }
  };
  const turn = () => {
    const p = g.piece;
    if (!p || g.flash.length) return;
    const shape = rotate(p.shape);
    for (const k of [0, -1, 1, -2, 2]) {
      if (fits(shape, p.x + k, p.y)) {
        p.shape = shape;
        p.x += k;
        redraw();
        return;
      }
    }
  };
  const step = () => {
    const p = g.piece;
    if (!p || g.flash.length || g.over) return;
    if (fits(p.shape, p.x, p.y + 1)) p.y++;
    else lock();
    redraw();
  };
  const drop = () => {
    const p = g.piece;
    if (!p || g.flash.length) return;
    let n = 0;
    while (fits(p.shape, p.x, p.y + 1)) {
      p.y++;
      n++;
    }
    g.score += n * 2;
    lock();
    redraw();
  };

  const running = started && active && !paused && !g.over;
  useEffect(() => {
    if (!running) return;
    if (!g.piece && !g.flash.length) spawn();
    const ms = Math.max(90, 720 - (g.level - 1) * 65);
    const t = setInterval(step, ms);
    return () => clearInterval(t);
  }, [running, g.level]); // eslint-disable-line react-hooks/exhaustive-deps

  useKeys((k) => {
    if (!running) return;
    if (k === 'ArrowLeft') move(-1);
    else if (k === 'ArrowRight') move(1);
    else if (k === 'ArrowUp' || k === 'x') turn();
    else if (k === 'ArrowDown') {
      g.score += 1;
      step();
    } else if (k === ' ') drop();
    else return false;
    return true;
  }, running);

  // Sul pozzo: tocco a sinistra/destra sposta, al centro gira; trascinando si sposta di più caselle, giù fa cadere.
  const cell = Math.floor(Math.max(8, Math.min((box.w - 8) / W, (box.h - 8) / H)));
  const runningRef = useRef(running);
  runningRef.current = running;
  const pan = useRef({ x: 0, moved: 0, dropped: false });
  const responder = useMemo(
    () =>
      PanResponder.create({
        onPanResponderTerminationRequest: () => false,
        onStartShouldSetPanResponder: () => runningRef.current,
        onMoveShouldSetPanResponder: () => runningRef.current,
        onPanResponderGrant: () => {
          pan.current = { x: 0, moved: 0, dropped: false };
        },
        onPanResponderMove: (_, gs) => {
          if (pan.current.dropped) return;
          if (gs.dy > 70 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5) {
            pan.current.dropped = true;
            drop();
            return;
          }
          const want = Math.round(gs.dx / Math.max(18, cell));
          while (pan.current.moved < want) {
            move(1);
            pan.current.moved++;
          }
          while (pan.current.moved > want) {
            move(-1);
            pan.current.moved--;
          }
        },
        onPanResponderRelease: (e, gs) => {
          if (pan.current.dropped || pan.current.moved !== 0 || Math.abs(gs.dx) > 10 || Math.abs(gs.dy) > 10) return;
          const x = e.nativeEvent.locationX;
          const wellW = cell * W;
          if (x < wellW * 0.3) move(-1);
          else if (x > wellW * 0.7) move(1);
          else turn();
        },
      }),
    [cell], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // La sagoma dove cadrà il pezzo.
  let ghostY = g.piece?.y ?? 0;
  if (g.piece) while (fits(g.piece.shape, g.piece.x, ghostY + 1)) ghostY++;

  const cells: { r: number; c: number; color: string; ghost?: boolean }[] = [];
  g.grid.forEach((row, r) => row.forEach((color, c) => color && cells.push({ r, c, color })));
  if (g.piece) {
    const p = g.piece;
    p.shape.forEach((row, r) =>
      row.forEach((v, c) => {
        if (!v) return;
        if (ghostY + r >= 0 && ghostY !== p.y) cells.push({ r: ghostY + r, c: p.x + c, color: p.def.color, ghost: true });
        if (p.y + r >= 0) cells.push({ r: p.y + r, c: p.x + c, color: p.def.color });
      }),
    );
  }

  return (
    <TableBg table="teal">
      <View style={{ flex: 1, paddingTop: 64, paddingHorizontal: 8, paddingBottom: 8, gap: 8 }}>
        <Hud score={g.score} best={best} extra={`liv. ${g.level} · ${g.lines} righe`} style={{ top: 8, left: 8 }} />
        <View pointerEvents="none" style={{ position: 'absolute', top: 4, right: 64 }}>
          {g.next && <NextPiece def={g.next} />}
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} onLayout={onLayout}>
          <View {...responder.panHandlers} style={{ ...NO_SELECT, width: cell * W + 6, height: cell * H + 6, borderRadius: 10, borderWidth: 3, borderColor: colors.line, backgroundColor: 'rgba(18,5,43,0.72)', overflow: 'hidden' }}>
            {/* Righe guida leggere, per mirare. */}
            {Array.from({ length: W - 1 }, (_, i) => (
              <View key={i} pointerEvents="none" style={{ position: 'absolute', left: (i + 1) * cell, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.05)' }} />
            ))}
            {cells.map((k, i) => (
              <Block key={i} x={k.c * cell} y={k.r * cell} size={cell} color={k.color} ghost={k.ghost} flash={g.flash.includes(k.r) && !k.ghost} />
            ))}
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 14, paddingBottom: 4 }}>
          <PadButton icon="◀" label="Sinistra" onPressIn={() => running && (tap(), move(-1))} />
          <PadButton icon="⟳" label="Gira" onPressIn={() => running && (tap(), turn())} color={colors.accent2} />
          <PadButton icon="▶" label="Destra" onPressIn={() => running && (tap(), move(1))} />
          <PadButton icon="⤓" label="Fai cadere" onPressIn={() => running && (tap(), drop())} color={colors.accent} />
        </View>
      </View>
      {!started && active && (
        <StartCard
          title="Coriandoli"
          lines={['Tocca a sinistra o a destra del pozzo per spostare, al centro per girare.', 'Trascina in giù per far cadere. Sul computer: frecce e spazio.']}
          onStart={() => setStarted(true)}
        />
      )}
    </TableBg>
  );
}

function Block({ x, y, size, color, ghost, flash }: { x: number; y: number; size: number; color: string; ghost?: boolean; flash?: boolean }) {
  if (ghost) return <View pointerEvents="none" style={{ position: 'absolute', left: x + 2, top: y + 2, width: size - 4, height: size - 4, borderRadius: 4, borderWidth: 2, borderColor: color, opacity: 0.45 }} />;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: Math.max(3, size * 0.18), backgroundColor: flash ? '#FFFFFF' : color, borderWidth: 2, borderColor: colors.line, transform: flash ? [{ scale: 1.08 }] : undefined }}
    >
      {!flash && <View style={{ position: 'absolute', left: 2, top: 2, width: size * 0.32, height: size * 0.2, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' }} />}
    </View>
  );
}

function NextPiece({ def }: { def: PieceDef }) {
  const s = 12;
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <T size={11} weight="800" color="#fff">
        Prossimo
      </T>
      <View style={{ padding: 5, borderRadius: 10, backgroundColor: 'rgba(18,5,43,0.78)', borderWidth: 2, borderColor: colors.line }}>
        <View style={{ width: def.shape[0].length * s, height: def.shape.length * s }}>
          {def.shape.flatMap((row, r) => row.map((v, c) => (v ? <Block key={`${r}${c}`} x={c * s} y={r * s} size={s} color={def.color} /> : null)))}
        </View>
      </View>
    </View>
  );
}
