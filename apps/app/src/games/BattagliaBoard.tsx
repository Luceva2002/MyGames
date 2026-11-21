import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { NAVALE_FLEET, NAVALE_SIZE, randomFleet, shipCells, shipFits, type NavaleMove, type NavaleSea, type NavaleView, type Seat, type Ship } from '@giochi/engine';
import { EventSticker, MyCorner, TableTop, useFit, type BoardProps, type SeatInfo } from './common';
import { Button, T, tap } from '../ui/kit';
import { sfx } from '../ui/sound';
import { TableBg } from '../ui/tables';
import { colors, font } from '../ui/theme';

const WATER = '#202228';
const SHIP = '#FFFDF6';
const LETTERS = 'ABCDEFGHIJ';
/** Quanto resta in vista il risultato di un colpo prima di passare all'altra griglia. */
const LOOK_MS = 1200;

const NO_SEA: NavaleSea = { misses: [], hits: [], sunk: [] };

/** Lo spazio per lettere e numeri ai bordi della griglia: ci deve stare anche il 10. */
const edgeOf = (cell: number) => Math.max(17, Math.round(cell * 0.55));
/** Le caselle più grandi che stanno in uno spazio w×h, bordi compresi. */
const fit = (w: number, h: number) => Math.max(8, Math.floor((Math.min(w, h) - 6 - edgeOf(Math.min(w, h) / NAVALE_SIZE)) / NAVALE_SIZE));

/** Una griglia di mare: le navi che si possono vedere, i colpi ricevuti e il tocco, se si può sparare o piazzare. */
function Sea({ cell, labels, sea, ships, lastCell, onPress, can, active }: {
  cell: number;
  labels: boolean;
  sea: NavaleSea;
  /** Navi da disegnare intere: le mie, o tutte a fine partita. */
  ships?: Ship[] | null;
  lastCell?: number | null;
  onPress?: (c: number) => void;
  /** Questa casella si può toccare? */
  can?: (c: number) => boolean;
  /** È la griglia su cui si gioca adesso. */
  active?: boolean;
}) {
  const edge = labels ? edgeOf(cell) : 0;
  // Testo vero e non <T>: sullo schermo condiviso T ingrandisce e il 10 non ci starebbe.
  const labelStyle = { fontFamily: font.bold, fontSize: Math.min(13, Math.max(9, cell * 0.36)), textAlign: 'center', color: active ? colors.onAccent : colors.muted } as const;
  const side = cell * NAVALE_SIZE;
  const miss = new Set(sea.misses);
  const hit = new Set(sea.hits);
  const sunk = new Set(sea.sunk.flatMap(shipCells));
  const drawn = ships ?? sea.sunk;
  return (
    <View style={{ width: side + edge + 6, padding: 3, borderRadius: 10, backgroundColor: active ? colors.accent : colors.line }}>
      {labels && (
        <View style={{ flexDirection: 'row', marginLeft: edge, height: edge }}>
          {LETTERS.split('').map((l) => (
            <Text key={l} numberOfLines={1} style={[labelStyle, { width: cell, lineHeight: edge }]}>
              {l}
            </Text>
          ))}
        </View>
      )}
      <View style={{ flexDirection: 'row' }}>
        {labels && (
          <View style={{ width: edge }}>
            {Array.from({ length: NAVALE_SIZE }, (_, i) => (
              <Text key={i} numberOfLines={1} style={[labelStyle, { height: cell, lineHeight: cell }]}>
                {i + 1}
              </Text>
            ))}
          </View>
        )}
        <View style={{ width: side, height: side, flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.line }}>
          {Array.from({ length: NAVALE_SIZE * NAVALE_SIZE }, (_, c) => {
            const enabled = !!onPress && (can ? can(c) : true);
            return (
              <Pressable
                key={c}
                disabled={!enabled}
                onPress={() => onPress?.(c)}
                accessibilityLabel={`${LETTERS[c % NAVALE_SIZE]}${Math.floor(c / NAVALE_SIZE) + 1}${hit.has(c) ? ', colpito' : miss.has(c) ? ', acqua' : ''}`}
                style={{ width: cell, height: cell, padding: 0.5 }}
              >
                {({ pressed }) => <View style={{ flex: 1, borderRadius: Math.min(3, cell * 0.1), backgroundColor: pressed && enabled ? colors.accent : WATER }} />}
              </Pressable>
            );
          })}
          {drawn.map((s, i) => (
            <View
              key={`${s.x}-${s.y}-${i}`}
              pointerEvents="none"
              style={{ position: 'absolute', left: s.x * cell + 2, top: s.y * cell + 2, width: (s.h ? s.len : 1) * cell - 4, height: (s.h ? 1 : s.len) * cell - 4, borderRadius: cell * 0.4, backgroundColor: SHIP, borderWidth: Math.max(2, cell * 0.08), borderColor: colors.line }}
            />
          ))}
          {sea.misses.map((c) => (
            <View key={`m${c}`} pointerEvents="none" style={{ position: 'absolute', left: (c % NAVALE_SIZE) * cell + cell * 0.32, top: Math.floor(c / NAVALE_SIZE) * cell + cell * 0.32, width: cell * 0.36, height: cell * 0.36, borderRadius: cell, backgroundColor: '#C9B8F0' }} />
          ))}
          {sea.hits.map((c) => (
            <View key={`h${c}`} pointerEvents="none" style={{ position: 'absolute', left: (c % NAVALE_SIZE) * cell + cell * 0.14, top: Math.floor(c / NAVALE_SIZE) * cell + cell * 0.14, width: cell * 0.72, height: cell * 0.72, borderRadius: cell, backgroundColor: sunk.has(c) ? colors.line : colors.accent2, borderWidth: Math.max(1.5, cell * 0.06), borderColor: sunk.has(c) ? colors.accent2 : colors.line, alignItems: 'center', justifyContent: 'center' }}>
              <T size={cell * 0.42} weight="900" color={colors.text} style={{ lineHeight: cell * 0.5 }}>
                ✕
              </T>
            </View>
          ))}
          {lastCell !== null && lastCell !== undefined && (
            <View pointerEvents="none" style={{ position: 'absolute', left: (lastCell % NAVALE_SIZE) * cell - 1, top: Math.floor(lastCell / NAVALE_SIZE) * cell - 1, width: cell + 2, height: cell + 2, borderRadius: 4, borderWidth: 1.5, borderColor: colors.accent }} />
          )}
        </View>
      </View>
    </View>
  );
}

function Title({ children, active }: { children: string; active?: boolean }) {
  return (
    <T size={15} weight="900" center color={active ? colors.accent : colors.text} lines={1}>
      {children}
    </T>
  );
}

/** Lo schieramento: si tocca la griglia per mettere la nave successiva, si tocca una nave per riprenderla. */
function Placement({ onMove }: { onMove: (m: NavaleMove) => void }) {
  const { box, onLayout } = useFit();
  const [ships, setShips] = useState<Ship[]>([]);
  const [h, setH] = useState(true);
  const left = [...NAVALE_FLEET];
  for (const s of ships) left.splice(left.indexOf(s.len), 1);
  const next = left[0];
  const cell = box.w ? fit(box.w, box.h) : 0;
  const press = (c: number) => {
    tap();
    const hitShip = ships.find((s) => shipCells(s).includes(c));
    if (hitShip) return setShips(ships.filter((s) => s !== hitShip));
    if (!next) return;
    const x = c % NAVALE_SIZE;
    const y = Math.floor(c / NAVALE_SIZE);
    // Se la nave uscirebbe dal bordo si tira indietro: basta toccare vicino al punto giusto.
    const ship = { x: h ? Math.min(x, NAVALE_SIZE - next) : x, y: h ? y : Math.min(y, NAVALE_SIZE - next), len: next, h };
    if (shipFits(ships, ship)) {
      sfx('card');
      setShips([...ships, ship]);
    }
  };
  return (
    <>
      <T size={16} weight="900" center style={{ marginTop: 28 }}>
        {next ? `Metti la nave da ${next}` : 'Flotta schierata!'}
      </T>
      <View onLayout={onLayout} style={{ flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
        {cell > 0 && <Sea cell={cell} labels sea={NO_SEA} ships={ships} onPress={press} active />}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, minHeight: 18 }}>
        {left.map((len, i) => (
          <View key={i} style={{ flexDirection: 'row', marginRight: 8 }}>
            {Array.from({ length: len }, (_, k) => (
              <View key={k} style={{ width: 12, height: 12, backgroundColor: i === 0 ? colors.accent : SHIP, borderWidth: 1.5, borderColor: colors.line, borderRadius: 3 }} />
            ))}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Button small kind="ghost" color={colors.text} icon={h ? '↔' : '↕'} label="Ruota" onPress={() => setH(!h)} />
        <Button small kind="ghost" color={colors.text} icon="🎲" label="A caso" onPress={() => setShips(randomFleet(Math.random))} />
        <Button small icon="✓" label="Pronti" disabled={!!next} onPress={() => onMove({ type: 'place', ships })} />
      </View>
    </>
  );
}

export function BattagliaBoard({ view, me, names, myTurn, onMove }: BoardProps<NavaleView, NavaleMove>) {
  const { width, height } = useWindowDimensions();
  const wide = width >= 700 && width > height * 1.1;
  const { box, onLayout } = useFit();
  const over = view.winner !== null;
  const enemy = me === null ? 1 : 1 - me;
  const own = me ?? 0;

  // Dopo un colpo la griglia resta dov'è il tempo di leggere il risultato, poi passa all'altra.
  const wanted = me !== null && view.turn === me ? 'enemy' : 'mine';
  const [focus, setFocus] = useState<'enemy' | 'mine'>(wanted);
  useEffect(() => {
    if (focus === wanted) return;
    const t = setTimeout(() => setFocus(wanted), LOOK_MS);
    return () => clearTimeout(t);
  }, [wanted]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastKey = view.last ? `${view.last.seat}-${view.last.cell}` : null;
  const seenShot = useRef(lastKey);
  useEffect(() => {
    if (lastKey === seenShot.current) return;
    seenShot.current = lastKey;
    sfx(view.last?.outcome === 'acqua' ? 'pick' : 'capture');
  }, [lastKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const info = (seat: Seat): SeatInfo => ({
    seat,
    name: names[seat],
    active: view.phase === 'battle' ? view.turn === seat && !over : !view.ready[seat],
    score: view.phase === 'battle' ? view.seas[1 - seat].sunk.length : seat === me ? undefined : view.ready[seat] ? '✓' : '…',
    scoreLabel: view.phase === 'battle' ? 'affondate' : view.ready[seat] ? 'pronto' : 'schiera',
  });
  const myInfo = me === null ? null : info(me);
  const others = me === null ? [info(0), info(1)] : [info(enemy)];

  if (view.phase === 'place' && me !== null && !view.ready[me]) {
    return (
      <TableBg table="teal">
        <View style={{ flex: 1, padding: 4, gap: 6 }}>
          <TableTop seats={others} />
          <Placement onMove={onMove} />
          <MyCorner info={myInfo} />
        </View>
      </TableBg>
    );
  }

  const shots = over || view.phase === 'battle';
  const shoot = (c: number) => {
    tap();
    onMove({ type: 'shot', cell: c });
  };
  const seaEnemy = view.seas[enemy];
  const seaOwn = view.seas[own];
  const canShoot = myTurn && focus === 'enemy' && !over;
  const fired = new Set([...seaEnemy.misses, ...seaEnemy.hits]);
  const shipsOwn = me !== null ? view.myFleet : view.revealed?.[own] ?? null;
  const shipsEnemy = view.revealed?.[enemy] ?? null;
  const lastOn = (target: Seat) => (view.last && view.last.seat !== target ? view.last.cell : null);

  // Sul telefono una griglia grande (quella su cui si gioca) e l'altra in piccolo; sul computer affiancate.
  const enemyName = me === null ? names[1] : names[enemy];
  const ownName = me === null ? names[0] : 'La tua flotta';
  const big = shots ? focus : 'mine';

  const outcome = view.last?.outcome;
  const sticker = outcome === 'acqua' ? 'Acqua' : outcome === 'colpito' ? 'Colpito!' : outcome === 'affondato' ? 'Affondato!' : null;
  let body = null;
  if (box.w) {
    if (wide || me === null) {
      const c = fit((box.w - 12) / 2, box.h - 26);
      body = (
        <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ gap: 4 }}>
            <Title active={focus === 'mine' && !over}>{ownName}</Title>
            <Sea cell={c} labels sea={seaOwn} ships={shipsOwn} lastCell={lastOn(own)} active={focus === 'mine' && !over && me !== null} />
          </View>
          <View style={{ gap: 4 }}>
            <Title active={focus === 'enemy' && !over}>{me === null ? enemyName : `Flotta di ${enemyName}`}</Title>
            <Sea cell={c} labels sea={seaEnemy} ships={shipsEnemy} lastCell={lastOn(enemy)} onPress={canShoot ? shoot : undefined} can={(n) => !fired.has(n)} active={canShoot} />
          </View>
        </View>
      );
    } else {
      const miniCell = 11;
      const c = fit(box.w, box.h - 22 - 4 - miniCell * NAVALE_SIZE - 26);
      const isEnemyBig = big === 'enemy';
      body = (
        <View style={{ gap: 4, alignItems: 'center' }}>
          <Title active={canShoot || !isEnemyBig}>{isEnemyBig ? `Flotta di ${enemyName}${canShoot ? ': spara!' : ''}` : ownName}</Title>
          <Sea cell={c} labels sea={isEnemyBig ? seaEnemy : seaOwn} ships={isEnemyBig ? shipsEnemy : shipsOwn} lastCell={lastOn(isEnemyBig ? enemy : own)} onPress={canShoot && isEnemyBig ? shoot : undefined} can={(n) => !fired.has(n)} active={canShoot && isEnemyBig} />
          <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Sea cell={miniCell} labels={false} sea={isEnemyBig ? seaOwn : seaEnemy} ships={isEnemyBig ? shipsOwn : shipsEnemy} lastCell={lastOn(isEnemyBig ? own : enemy)} />
            <View style={{ gap: 6, flexShrink: 1 }}>
              <T size={12} weight="800" color={colors.muted}>
                {isEnemyBig ? 'La tua flotta' : `Flotta di ${enemyName}`}
              </T>
              <MyCorner info={myInfo} style={{ alignItems: 'flex-start' }} />
            </View>
          </View>
        </View>
      );
    }
  }

  return (
    <TableBg table="teal">
      <View style={{ flex: 1, padding: 4, gap: 6 }}>
        <TableTop seats={others} />
        {!shots && (
          <T size={15} weight="800" center>
            {me === null ? 'Si schierano le flotte…' : `Flotta schierata: aspetta ${names[enemy]}…`}
          </T>
        )}
        <View onLayout={onLayout} style={{ flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
          {body}
        </View>
        {(wide || me === null) && <MyCorner info={myInfo} style={{ position: 'relative', right: 0, bottom: 0 }} />}
      </View>
      <EventSticker high eventKey={lastKey} text={sticker} />
    </TableBg>
  );
}
