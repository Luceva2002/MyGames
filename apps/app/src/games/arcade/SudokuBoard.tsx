import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SUDOKU_HINTS, SUDOKU_LEVELS, SUDOKU_MAX_ERRORS, type SudokuMove, type SudokuView } from '@giochi/engine';
import { useFit, usePaused, type BoardProps } from '../common';
import { TableBg } from '../../ui/tables';
import { Button, T, tap } from '../../ui/kit';
import { sfx } from '../../ui/sound';
import { colors } from '../../ui/theme';
import { Hud, useKeys } from './kit';

/** Sudoku: griglia, tastierino dei numeri, matita per i promemoria e tre aiuti. */
const box = (i: number) => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3);
const related = (a: number, b: number) => Math.floor(a / 9) === Math.floor(b / 9) || a % 9 === b % 9 || box(a) === box(b);

function clock(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function SudokuBoard({ view, myTurn, onMove }: BoardProps<SudokuView, SudokuMove>) {
  const paused = usePaused();
  const { box: fit, onLayout } = useFit();
  const [sel, setSel] = useState<number | null>(null);
  const [pencil, setPencil] = useState(false);
  const [notes, setNotes] = useState<Record<number, number[]>>({});
  const [elapsed, setElapsed] = useState(0);
  const [flash, setFlash] = useState<{ cell: number; value: number } | null>(null);
  const active = myTurn && !view.over && view.level !== null;

  // Il cronometro gira solo mentre si gioca davvero.
  useEffect(() => {
    if (!active || paused) return;
    const t = setInterval(() => setElapsed((e) => e + 1000), 1000);
    return () => clearInterval(t);
  }, [active, paused]);

  // Numero sbagliato: lampeggia rosso nella casella e poi sparisce.
  const lastWrong = useRef(0);
  useEffect(() => {
    if (!view.wrong || view.wrong.n === lastWrong.current) return;
    lastWrong.current = view.wrong.n;
    setFlash({ cell: view.wrong.cell, value: view.wrong.value });
    sfx('pocket');
    const t = setTimeout(() => setFlash(null), 900);
    return () => clearTimeout(t);
  }, [view.wrong?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  // Numero giusto: via dai promemoria della sua riga, colonna e riquadro.
  const lastFilled = useRef(0);
  useEffect(() => {
    const f = view.filled;
    if (!f || f.n === lastFilled.current) return;
    lastFilled.current = f.n;
    sfx('card');
    const v = view.values[f.cell];
    setNotes((all) => {
      const next: Record<number, number[]> = {};
      for (const [k, list] of Object.entries(all)) {
        const i = Number(k);
        if (i === f.cell) continue;
        next[i] = related(i, f.cell) ? list.filter((n) => n !== v) : list;
      }
      return next;
    });
  }, [view.filled?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  const editable = (i: number) => !view.given[i] && !view.values[i];
  const press = (n: number) => {
    if (!active || sel === null || !editable(sel)) return;
    tap();
    if (pencil) {
      setNotes((all) => {
        const list = all[sel] ?? [];
        return { ...all, [sel]: list.includes(n) ? list.filter((x) => x !== n) : [...list, n].sort() };
      });
      return;
    }
    onMove({ type: 'fill', cell: sel, value: n });
  };
  const erase = () => sel !== null && setNotes((all) => ({ ...all, [sel]: [] }));

  useKeys((k) => {
    if (!active) return false;
    if (/^[1-9]$/.test(k)) press(Number(k));
    else if (k === 'Backspace' || k === 'Delete') erase();
    else if (k === 'n' || k === 'p') setPencil((p) => !p);
    else if (k.startsWith('Arrow')) {
      const s = sel ?? 40;
      const d = k === 'ArrowUp' ? -9 : k === 'ArrowDown' ? 9 : k === 'ArrowLeft' ? -1 : 1;
      setSel(Math.max(0, Math.min(80, s + d)));
    } else return false;
    return true;
  }, active);

  if (view.level === null) {
    return (
      <TableBg table="teal">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <View style={{ width: '100%', maxWidth: 340, gap: 12, padding: 22, borderRadius: 26, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, boxShadow: `0px 6px 16px rgba(0,0,0,0.35)` }}>
            <T size={28} weight="900" center>
              Sudoku
            </T>
            <T size={15} weight="700" color={colors.muted} center>
              Scegli quanto difficile
            </T>
            {SUDOKU_LEVELS.map((l, i) => (
              <Button key={l.id} label={l.label} color={[colors.accent3, colors.accent, colors.accent2][i]} disabled={!myTurn} onPress={() => onMove({ type: 'level', level: l.id })} />
            ))}
          </View>
        </View>
      </TableBg>
    );
  }

  const selValue = sel !== null ? view.values[sel] : 0;
  const counts = Array(10).fill(0);
  view.values.forEach((v) => v && counts[v]++);
  // La griglia è quadrata e lascia posto al tastierino sotto.
  const size = Math.max(240, Math.min(fit.w - 4, fit.h - 4, 560));
  const cs = size / 9;

  return (
    <TableBg table="teal">
      <View style={{ flex: 1, paddingTop: 64, paddingHorizontal: 8, paddingBottom: 10, gap: 10 }}>
        <Hud
          score={clock(elapsed)}
          label={SUDOKU_LEVELS.find((l) => l.id === view.level)?.label.toLowerCase()}
          best={null}
          extra={`${'❤️'.repeat(Math.max(0, SUDOKU_MAX_ERRORS - view.errors))}${'🖤'.repeat(Math.min(SUDOKU_MAX_ERRORS, view.errors))}  errori ${view.errors}/${SUDOKU_MAX_ERRORS}`}
          style={{ top: 8, left: 8 }}
        />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} onLayout={onLayout}>
          <View style={{ width: size, height: size, backgroundColor: '#FFFDF5', borderRadius: 12, borderWidth: 1.5, borderColor: colors.line, overflow: 'hidden', boxShadow: `0px 6px 16px rgba(0,0,0,0.35)` }}>
            {view.values.map((v, i) => {
              const r = Math.floor(i / 9);
              const c = i % 9;
              const isSel = sel === i;
              const near = sel !== null && related(sel, i);
              const same = !!selValue && v === selValue;
              const wrong = flash?.cell === i;
              const bg = isSel ? colors.accent : wrong ? '#FFC2CF' : same ? '#C7F5EF' : near ? '#EFE7FF' : 'transparent';
              const list = notes[i] ?? [];
              return (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityLabel={`Riga ${r + 1}, colonna ${c + 1}${v ? `: ${v}` : ', vuota'}`}
                  onPress={() => setSel(i)}
                  style={{ position: 'absolute', left: c * cs, top: r * cs, width: cs, height: cs, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderRightWidth: c === 8 ? 0 : c % 3 === 2 ? 2.5 : 0.5, borderBottomWidth: r === 8 ? 0 : r % 3 === 2 ? 2.5 : 0.5, borderColor: c % 3 === 2 || r % 3 === 2 ? colors.line : '#BBAEDD' }}
                >
                  {v ? (
                    <T size={cs * 0.56} weight={view.given[i] ? '900' : '800'} color={view.given[i] ? colors.line : '#5B3FE0'} style={{ lineHeight: cs * 0.7 }}>
                      {v}
                    </T>
                  ) : wrong ? (
                    <T size={cs * 0.56} weight="800" color="#D7263D" style={{ lineHeight: cs * 0.7 }}>
                      {flash.value}
                    </T>
                  ) : list.length ? (
                    <View style={{ width: cs, height: cs, flexDirection: 'row', flexWrap: 'wrap' }}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                        <View key={n} style={{ width: cs / 3, height: cs / 3, alignItems: 'center', justifyContent: 'center' }}>
                          {list.includes(n) && (
                            <T size={Math.max(8, cs * 0.24)} weight="800" color="#7A6A9E" style={{ lineHeight: cs * 0.3 }}>
                              {n}
                            </T>
                          )}
                        </View>
                      ))}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={{ alignSelf: 'center', width: '100%', maxWidth: 560, gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 5 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
              const done = counts[n] >= 9;
              return (
                <Pressable
                  key={n}
                  accessibilityRole="button"
                  accessibilityLabel={pencil ? `Promemoria ${n}` : `Scrivi ${n}`}
                  disabled={done}
                  onPress={() => press(n)}
                  style={({ pressed }) => ({ flex: 1, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? 'rgba(13,14,17,0.4)' : pencil ? colors.surface2 : '#FFFDF5', borderWidth: 1.5, borderColor: colors.line, transform: [{ translateY: pressed ? 2 : 0 }], boxShadow: `0px 6px 16px rgba(0,0,0,0.35)` })}
                >
                  <T size={pencil ? 18 : 24} weight="900" color={done ? 'transparent' : pencil ? '#fff' : colors.line}>
                    {n}
                  </T>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Tool icon="✏️" label={pencil ? 'Matita: sì' : 'Matita'} on={pencil} onPress={() => setPencil((p) => !p)} />
            <Tool icon="⌫" label="Cancella" onPress={erase} />
            <Tool
              icon="💡"
              label={`Aiuto (${view.hints})`}
              disabled={!view.hints || !active}
              onPress={() => onMove({ type: 'hint', cell: sel !== null && editable(sel) ? sel : undefined })}
            />
          </View>
          {sel === null && view.moves === 0 && (
            <T size={13} weight="800" color="#fff" center>
              Tocca una casella vuota, poi un numero. Aiuti: {SUDOKU_HINTS}.
            </T>
          )}
        </View>
      </View>
    </TableBg>
  );
}

function Tool({ icon, label, on, disabled, onPress }: { icon: string; label: string; on?: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!on, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({ flex: 1, flexDirection: 'row', gap: 6, height: 46, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.accent : colors.surface, borderWidth: 1.5, borderColor: colors.line, opacity: disabled ? 0.5 : 1, transform: [{ translateY: pressed ? 2 : 0 }], boxShadow: `0px 6px 16px rgba(0,0,0,0.35)` })}
    >
      <T size={16}>{icon}</T>
      <T size={14} weight="800" color={on ? colors.onAccent : '#fff'}>
        {label}
      </T>
    </Pressable>
  );
}
