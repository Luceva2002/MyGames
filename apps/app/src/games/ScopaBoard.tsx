import { useEffect, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { captureOptions, teamOf, type Card, type ScopaMove, type ScopaView, type Seat } from '@giochi/engine';
import { Banner, MyCorner, EventSticker, Felt, Hand, othersOf, Slot, TableTop, type SeatInfo, useCardWidth, type BoardProps } from './common';
import { CardsSummaryTable, teamLabel } from './summary';
import { DeckPile, PlayingCard } from '../ui/cards';
import { DropZone, type DragPayload } from '../ui/drag';
import { Anchor, FlyIn, handAnchor, HOLD_MS, TRAVEL_MS } from '../ui/motion';
import { sfx } from '../ui/sound';
import { Button, T } from '../ui/kit';
import { TableBg } from '../ui/tables';
import { colors } from '../ui/theme';

export function ScopaBoard({ view, me, names, myTurn, onMove }: BoardProps<ScopaView, ScopaMove>) {
  const [selected, setSelected] = useState<string | null>(null);
  const { width: screenW, height: screenH } = useWindowDimensions();
  // Sugli schermi grandi le carte crescono: a 76 punti in mezzo a un panno di un metro sparivano.
  const large = Math.min(screenW, screenH * 1.6) >= 1200;
  const handWidth = useCardWidth(3, large ? 150 : 100);
  // Sul telefono il mazzo sta sul bordo sinistro: le carte in tavola gli lasciano posto.
  const narrow = screenW < 600;
  const tableWidth = useCardWidth(Math.max(view.table.length, 5), large ? 120 : 76);
  useEffect(() => setSelected(null), [view.turn, view.phase]);

  const card = view.hand.find((c) => c.id === selected);
  const options = card ? captureOptions(view.table, card) : [];
  const highlighted = new Set(options.flat().map((c) => c.id));
  const teams = view.teamScores.length;
  // Trascinando una carta si illuminano le prese possibili; se ce n'è più d'una si sceglie coi bottoni.
  const keepSel = useRef(false);
  const dealt = useRef(false);
  useEffect(() => void (dealt.current = true), []);
  // Presa e scopa si sentono, non solo si vedono.
  const playKey = view.lastPlay ? `${view.lastPlay.seat}-${view.lastPlay.card.id}` : null;
  useEffect(() => {
    if (view.lastPlay?.scopa) sfx('scopa');
    else if (view.lastPlay?.taken.length) sfx('capture');
  }, [playKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Una presa resta in tavola un momento: la carta giocata arriva accanto a quelle che prende, si
  // vede cosa si porta via, poi tutte insieme vanno verso chi ha preso.
  const before = useRef(view.table);
  const held = useRef<{ key: string | null; cards: Card[] }>({ key: null, cards: [] });
  if (playKey !== held.current.key) {
    held.current = { key: playKey, cards: view.lastPlay?.taken.length ? [...before.current, view.lastPlay.card] : [] };
  }
  const [released, setReleased] = useState<string | null>(null);
  useEffect(() => {
    before.current = view.table;
  }, [view.table]);
  useEffect(() => {
    if (!held.current.cards.length) return;
    const t = setTimeout(() => setReleased(playKey), view.lastPlay?.seat === me ? 700 : HOLD_MS + TRAVEL_MS + 650);
    return () => clearTimeout(t);
  }, [playKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const holding = held.current.cards.length > 0 && released !== playKey;
  const shown = holding ? held.current.cards : view.table;
  const taken = new Set(holding ? view.lastPlay?.taken.map((c) => c.id) : []);
  const dropCard = (cardId: string, target?: string) => {
    const c = view.hand.find((x) => x.id === cardId);
    if (!c) return false;
    const opts = captureOptions(view.table, c);
    const fit = target ? opts.filter((o) => o.some((x) => x.id === target)) : opts;
    if (!opts.length) return void onMove({ type: 'play', card: c.id });
    if (fit.length === 1) return void onMove({ type: 'play', card: c.id, take: fit[0].map((x) => x.id) });
    keepSel.current = true;
    setSelected(c.id);
    return false;
  };
  const canTake = (p: DragPayload, target: string) => {
    const c = p.kind === 'hand' ? view.hand.find((x) => x.id === p.ids[0]) : undefined;
    return !!c && captureOptions(view.table, c).some((o) => o.some((x) => x.id === target));
  };

  if (view.phase !== 'play' && view.report) {
    return (
      <View style={{ flex: 1, padding: 16, gap: 16, justifyContent: 'center' }}>
        <T size={24} weight="900" center>
          {view.phase === 'over' ? 'Partita finita' : 'Fine della mano'}
        </T>
        <CardsSummaryTable
          columns={Array.from({ length: teams }, (_, t) => teamLabel(t, view.players, names))}
          rows={[
            ['Carte', view.report.map((r) => String(r.cards))],
            ['Denari', view.report.map((r) => String(r.denari))],
            ['Settebello', view.report.map((r) => (r.settebello ? '✓' : ''))],
            ['Primiera', view.report.map((r) => String(r.primiera))],
            ['Scope', view.report.map((r) => String(r.scope))],
            ['Punti mano', view.report.map((r) => `+${r.points}`)],
            ['Totale', view.teamScores.map(String)],
          ]}
        />
        {view.phase === 'handEnd' &&
          (myTurn ? <Button label="Prossima mano" onPress={() => onMove({ type: 'next' })} /> : <Banner text={`${names[0]} dà le carte…`} />)}
      </View>
    );
  }

  const last = view.lastPlay;
  // Ogni posto: punti della squadra, prese e scope; gli avversari stanno dall'altro lato del tavolo.
  const info = (seat: Seat): SeatInfo => ({
    seat,
    name: names[seat] + (view.players === 4 && me !== null && seat !== me && teamOf(seat, 4) === teamOf(me, 4) ? ' 🤝' : ''),
    active: view.turn === seat,
    cards: view.handCounts[seat],
    score: view.teamScores[teamOf(seat, view.players)],
    scoreLabel: `punti · prese ${view.capturedCounts[seat]}${view.scope[seat] ? ` · 🧹${view.scope[seat]}` : ''}`,
  });
  return (
    <TableBg table="morbido">
      <DropZone id="table" style={{ flex: 1 }} radius={22} inset={-10} accepts={(p) => myTurn && p.kind === 'hand'} onDrop={(p) => dropCard(p.ids[0])}>
      <Felt>
        <TableTop seats={othersOf(view.players, me).map(info)} />
        <View style={{ flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', gap: 10, paddingLeft: narrow && me !== null ? 66 : 0 }}>
        <View style={{ position: 'absolute', left: 0, top: '50%', marginTop: -70, zIndex: 10 }}>
          <Slot width={me === null ? 74 : 60} label={`MAZZO · ${view.deckCount}`} ratio={1.85}>
            <Anchor id="deck">{view.deckCount > 0 ? <DeckPile count={view.deckCount} width={me === null ? 68 : 54} /> : null}</Anchor>
          </Slot>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, maxWidth: 6 * (tableWidth + 8) }}>
          {shown.map((c, i) => {
            const mover = view.lastPlay?.card.id === c.id ? view.lastPlay.seat : null;
            return (
              <FlyIn
                key={c.id}
                from={!dealt.current ? 'above' : mover === me ? 'below' : 'none'}
                fromAnchor={!dealt.current ? 'deck' : mover !== null && mover !== me ? handAnchor(mover) : undefined}
                delay={dealt.current ? 0 : 300 + i * 120}
                leave={view.lastPlay?.seat === me ? 'down' : 'up'}
                sound={dealt.current ? 'card' : 'deal'}
              >
                <DropZone id={`t-${c.id}`} radius={10} inset={4} accepts={(p) => !holding && myTurn && canTake(p, c.id)} onDrop={(p) => dropCard(p.ids[0], c.id)}>
                  <PlayingCard card={c} width={tableWidth} selected={highlighted.has(c.id) || taken.has(c.id)} dimmed={!!card && options.length > 0 && !highlighted.has(c.id)} />
                </DropZone>
              </FlyIn>
            );
          })}
          {shown.length === 0 && <T color="#ffffff99">Tavolo vuoto</T>}
        </View>
        </View>
      </Felt>
      </DropZone>
      <EventSticker
        eventKey={last ? `${last.seat}-${last.card.id}` : null}
        text={last?.scopa ? '+1 scopa!' : last && [last.card, ...last.taken].some((c) => c.suit === 'd' && c.rank === 7) && last.taken.length ? 'Settebello!' : null}
      />
      <MyCorner info={me === null ? null : info(me)} />
      {me !== null && (
        <>
          <Hand
            cards={view.hand}
            width={handWidth}
            selected={selected}
            onPress={myTurn ? (c) => (c.id === selected ? setSelected(null) : dropCard(c.id)) : undefined}
            drag={myTurn ? (c) => ({ kind: 'hand', ids: [c.id] }) : undefined}
            onLift={(c, lifted) => {
              if (lifted) setSelected(c.id);
              else if (!keepSel.current) setSelected(null);
              keepSel.current = false;
            }}
          />
          <View style={{ minHeight: 44, padding: 4, gap: 8, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
            {card &&
              options.length > 1 &&
              options.map((opt) => (
                <Button
                  key={opt.map((c) => c.id).join()}
                  small
                  label={`Prendi ${opt.map((c) => c.rank).join(' + ')}${opt.length === view.table.length ? ' 🧹' : ''}`}
                  onPress={() => onMove({ type: 'play', card: card.id, take: opt.map((c) => c.id) })}
                />
              ))}
            {!card && myTurn && <T color={colors.muted}>Tocca una carta per giocarla</T>}
          </View>
        </>
      )}
    </TableBg>
  );
}
