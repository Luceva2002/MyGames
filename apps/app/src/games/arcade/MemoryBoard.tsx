import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { MEMORY_FACES, type MemoryMove, type MemoryView } from '@giochi/engine';
import { MENU_GAP, TableSeat, useFit, useSharedScreen, type BoardProps } from '../common';
import { TableBg } from '../../ui/tables';
import { T, tap } from '../../ui/kit';
import { CharacterAvatar, avatarBg } from '../../ui/avatars';
import { sfx } from '../../ui/sound';
import { useReducedMotion } from '../../ui/settings';
import { colors, seatColor } from '../../ui/theme';
import { Hud, useRecord } from './kit';
import { BackFace } from '../../ui/suits';

/** Memory dei mostrini: venti carte coperte, si girano a due a due. */
const MISS_SHOW_MS = 1200;

export function MemoryBoard({ view, me, names, myTurn, onMove }: BoardProps<MemoryView, MemoryMove>) {
  const { box, onLayout } = useFit();
  const solo = view.players === 1;
  const { best, submit } = useRecord('memory', true);
  const finished = view.taken.every((t) => t !== null);
  const shared = useSharedScreen();

  // Le due carte sbagliate restano scoperte un attimo, poi si ricoprono da sole.
  const [hideMiss, setHideMiss] = useState(false);
  useEffect(() => {
    setHideMiss(false);
    if (!view.miss) return;
    sfx('hover');
    const t = setTimeout(() => setHideMiss(true), MISS_SHOW_MS);
    return () => clearTimeout(t);
  }, [view.flips]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastMatch = useRef(view.match?.n ?? 0);
  useEffect(() => {
    if (view.match && view.match.n !== lastMatch.current) sfx('capture');
    lastMatch.current = view.match?.n ?? 0;
  }, [view.match?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (finished && solo) submit(view.moves);
  }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  // Griglia 4×5 sul telefono in verticale, 5×4 quando c'è più larghezza che altezza.
  const wide = box.w > box.h * 1.1;
  const cols = wide ? 5 : 4;
  const rows = wide ? 4 : 5;
  const gap = 8;
  const cw = Math.max(40, Math.min((box.w - gap * (cols - 1)) / cols, ((box.h - gap * (rows - 1)) / rows) * 0.8, 130));
  const ch = cw * 1.25;

  return (
    <TableBg table="teal">
      <View style={{ flex: 1, paddingTop: solo ? 64 : 8, paddingHorizontal: 10, paddingBottom: 12, gap: 10 }}>
        {solo ? (
          <Hud score={view.moves} label={view.moves === 1 ? 'mossa' : 'mosse'} best={best} extra={`${view.pairs[0]}/10 coppie`} style={{ top: 8, left: 8 }} />
        ) : (
          <View style={{ flexDirection: 'row', gap: 6, paddingRight: MENU_GAP }}>
            {names.map((n, i) => (
              <TableSeat key={i} compact info={{ seat: i, name: i === me && !shared ? 'Tu' : n, active: !finished && view.turn === i, score: view.pairs[i], scoreLabel: 'coppie' }} />
            ))}
          </View>
        )}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} onLayout={onLayout}>
          <View style={{ width: cols * cw + (cols - 1) * gap, flexDirection: 'row', flexWrap: 'wrap', gap }}>
            {view.faces.map((face, i) => {
              const missed = !!view.miss?.includes(i);
              const shown = face !== null && !(missed && hideMiss);
              const owner = view.taken[i];
              return (
                <MemoryCard
                  key={i}
                  face={shown ? face : null}
                  owner={owner}
                  solo={solo}
                  justMatched={!!view.match && view.match.cards.includes(i) && view.match.n === view.moves}
                  missed={missed && !hideMiss}
                  w={cw}
                  h={ch}
                  disabled={!myTurn || owner !== null || view.open.includes(i)}
                  onPress={() => {
                    tap();
                    onMove({ flip: i });
                  }}
                />
              );
            })}
          </View>
        </View>
        {!solo && !finished && (
          <T size={14} weight="800" color="#fff" center>
            {myTurn && !shared ? (view.open.length ? 'Gira la seconda carta' : 'Tocca a te: gira due carte') : `Tocca a ${names[view.turn]}${view.open.length ? ': gira la seconda carta' : ''}`}
          </T>
        )}
      </View>
    </TableBg>
  );
}

function MemoryCard({ face, owner, solo, justMatched, missed, w, h, disabled, onPress }: { face: number | null; owner: number | null; solo: boolean; justMatched: boolean; missed: boolean; w: number; h: number; disabled: boolean; onPress: () => void }) {
  const reduced = useReducedMotion();
  // Si gira stringendosi in orizzontale: a metà giro cambia faccia.
  const [shownFace, setShownFace] = useState(face);
  const sx = useSharedValue(1);
  const sc = useSharedValue(1);
  useEffect(() => {
    if (face === shownFace) return;
    if (reduced) {
      setShownFace(face);
      return;
    }
    sx.value = withSequence(withTiming(0, { duration: 120 }), withTiming(1, { duration: 140 }));
    const t = setTimeout(() => setShownFace(face), 120);
    return () => clearTimeout(t);
  }, [face]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!justMatched || reduced) return;
    sc.value = withSequence(withTiming(1, { duration: 260 }), withTiming(1.12, { duration: 140 }), withTiming(1, { duration: 160 }));
  }, [justMatched]); // eslint-disable-line react-hooks/exhaustive-deps
  const anim = useAnimatedStyle(() => ({ transform: [{ scaleX: sx.value }, { scale: sc.value }] }));
  const id = shownFace !== null ? MEMORY_FACES[shownFace] : null;
  const border = owner !== null && !solo ? seatColor(owner) : missed ? colors.accent2 : colors.line;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={id ? `Carta scoperta: ${id}` : 'Carta coperta'} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ transform: [{ translateY: pressed && !disabled ? 2 : 0 }] })}>
      <Animated.View
        style={[
          { width: w, height: h, borderRadius: Math.max(10, w * 0.14), borderWidth: 1.5, borderColor: border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: `0px 6px 16px rgba(0,0,0,0.35)` },
          id ? { backgroundColor: avatarBg(id) } : { backgroundColor: colors.accent2 },
          owner !== null && { opacity: 0.85 },
          anim,
        ]}
      >
        {id ? (
          <CharacterAvatar id={id} size={w * 0.82} />
        ) : (
            /* Dorso: lo stesso delle carte da gioco, a pois con Bobo. */
            <BackFace w={w} h={h} />
        )}
      </Animated.View>
    </Pressable>
  );
}
