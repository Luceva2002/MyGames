import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { BRISCOLA_POINTS, cardName, IT_SUIT_NAMES, teamOf, type BriscolaMove, type BriscolaView, type Card, type Seat, type TresetteMove, type TresetteView } from '@giochi/engine';
import { Banner, MyCorner, EventSticker, Felt, Hand, MyBar, othersOf, Slot, TableTop, turnText, type SeatInfo, useCardWidth, type BoardProps } from './common';
import { CardsSummaryTable, teamLabel } from './summary';
import { DeckPile, PlayingCard } from '../ui/cards';
import { DropZone, type DragPayload } from '../ui/drag';
import { FlyIn } from '../ui/motion';
import { sfx } from '../ui/sound';
import { Button, Row, SeatDot, T } from '../ui/kit';
import { colors, seatColor } from '../ui/theme';

/** Dove siede ogni giocatore attorno al tavolo, visto da chi gioca: io in basso, poi in senso antiorario. */
function seatSpot(k: number, n: number): 'bottom' | 'top' | 'left' | 'right' {
  if (k === 0) return 'bottom';
  if (n === 2) return 'top';
  if (n === 3) return k === 1 ? 'right' : 'left';
  return (['bottom', 'right', 'top', 'left'] as const)[k];
}

/**
 * Il tavolo della presa: un posto tratteggiato per ogni giocatore, nella sua posizione. La carta
 * giocata entra nel posto di chi l'ha giocata; a presa chiusa si accende il posto di chi vince.
 */
function TrickTable({ players, plays, names, width, winner, me, turn }: { players: number; plays: { seat: Seat; card: Card }[]; names: string[]; width: number; winner?: Seat; me: Seat | null; turn: Seat }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const gap = 10;
  const label = 18;
  // Carte grandi quanto lo spazio permette: tre colonne in larghezza, due righe in altezza.
  const cw = box.w ? Math.min(width, (box.w - gap * 2) / 3, (box.h - gap - label * 2) / (2 * 1.8)) : 0;
  const ch = cw * 1.8;
  const W = cw * 3 + gap * 2;
  const H = (ch + label) * 2 + gap;
  const base = me ?? 0;
  const pos = (spot: ReturnType<typeof seatSpot>) =>
    spot === 'bottom' ? { left: (W - cw) / 2, top: H - ch - label } : spot === 'top' ? { left: (W - cw) / 2, top: 0 } : spot === 'left' ? { left: 0, top: (H - ch - label) / 2 } : { left: W - cw, top: (H - ch - label) / 2 };
  return (
    <View style={{ flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {cw > 20 && (
        <View style={{ width: W, height: H }}>
          {Array.from({ length: players }, (_, seat) => {
            const k = (seat - base + players) % players;
            const play = plays.find((p) => p.seat === seat);
            const glow = winner === seat ? colors.accent : winner === undefined && turn === seat && !play ? seatColor(seat) : undefined;
            return (
              <Slot
                key={seat}
                width={cw}
                glow={glow}
                style={{ position: 'absolute', ...pos(seatSpot(k, players)) }}
                label={
                  <Row gap={4}>
                    <SeatDot seat={seat} size={8} />
                    <T size={11} weight="800" color={winner === seat ? colors.accent : '#ffffffdd'} lines={1}>
                      {seat === me ? 'Tu' : names[seat]}
                    </T>
                  </Row>
                }
              >
                {play && (
                  <FlyIn key={play.card.id} from={winner !== undefined ? 'none' : seat === me ? 'below' : 'above'} leave={winner === undefined ? undefined : winner === me ? 'down' : 'up'} sound={winner === undefined ? 'card' : undefined}>
                    <View style={{ opacity: winner !== undefined && winner !== seat ? 0.55 : 1 }}>
                      <PlayingCard card={play.card} width={cw - 6} selected={winner === seat} />
                    </View>
                  </FlyIn>
                )}
              </Slot>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** Il tavolo come zona dove lasciare la carta giocata. */
function TableDrop({ enabled, onCard, children }: { enabled: boolean; onCard: (id: string) => void; children: React.ReactNode }) {
  return (
    <DropZone id="table" style={{ flex: 1 }} radius={22} inset={-10} accepts={(p: DragPayload) => enabled && p.kind === 'hand'} onDrop={(p) => onCard(p.ids[0])}>
      {children}
    </DropZone>
  );
}

const dragFromHand = (c: Card): DragPayload => ({ kind: 'hand', ids: [c.id] });

/**
 * La presa in corso, oppure quella appena chiusa con chi l'ha vinta. È sempre lo stesso gruppo di
 * carte, così quando parte la presa nuova le vecchie volano via verso chi le ha prese.
 */
function TrickArea({ view, names, width, me }: { view: { players: number; turn: Seat; trick: { seat: Seat; card: Card }[]; lastTrick: { plays: { seat: Seat; card: Card }[]; winner: Seat } | null }; names: string[]; width: number; me: Seat | null }) {
  const last = view.trick.length === 0 ? view.lastTrick : null;
  const lastKey = last ? `${last.winner}-${last.plays[0]?.card.id}` : null;
  useEffect(() => {
    if (last && last.winner === me) sfx('capture');
  }, [lastKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <TrickTable players={view.players} turn={view.turn} plays={last ? last.plays : view.trick} names={names} width={width} winner={last?.winner} me={me} />
      <T size={14} color="#ffffffcc" style={{ opacity: last ? 1 : 0 }}>
        {last ? `Ha preso ${names[last.winner]}` : ' '}
      </T>
    </>
  );
}

function partnerMark(players: number, me: Seat | null, seat: Seat) {
  return players === 4 && me !== null && teamOf(seat, 4) === teamOf(me, 4) ? ' 🤝' : '';
}

export function BriscolaBoard({ view, me, names, myTurn, onMove }: BoardProps<BriscolaView, BriscolaMove>) {
  const handWidth = useCardWidth(3, 100);
  const trickWidth = useCardWidth(5, 80);
  const binfo = (seat: Seat): SeatInfo => ({ seat, name: names[seat] + partnerMark(view.players, me, seat), active: view.turn === seat, cards: view.handCounts[seat], score: view.capturedPoints[seat], scoreLabel: 'punti' });
  return (
    <View style={{ flex: 1 }}>
      <TableDrop enabled={myTurn} onCard={(id) => onMove({ card: id })}>
      <Felt>
        <TableTop seats={othersOf(view.players, me).map(binfo)} />
        <Row style={{ position: 'absolute', top: '4.5%', right: '4.5%', alignItems: 'flex-start', zIndex: 10 }} gap={10}>
          <Slot width={me === null ? 74 : 60} label={`MAZZO · ${Math.max(0, view.deckCount - 1)}`} ratio={1.85}>
            {view.deckCount > 1 ? <DeckPile count={view.deckCount - 1} width={me === null ? 68 : 54} /> : null}
          </Slot>
          <Slot width={me === null ? 74 : 60} label="BRISCOLA" ratio={1.85} glow={colors.accent}>
            {view.deckCount > 0 ? <PlayingCard card={view.trump} width={me === null ? 68 : 54} /> : null}
          </Slot>
        </Row>
        {view.teamPoints ? (
          <CardsSummaryTable
            columns={view.teamPoints.map((_, t) => teamLabel(t, view.players, names))}
            rows={[['Punti', view.teamPoints.map(String)]]}
          />
        ) : (
          <TrickArea view={view} names={names} width={trickWidth} me={me} />
        )}
        <MyCorner info={me === null ? null : binfo(me)} style={{ right: '4.5%', bottom: '7%' }} />
      </Felt>
      </TableDrop>
      <EventSticker eventKey={view.lastTrick ? `${view.lastTrick.winner}-${view.lastTrick.plays[0].card.id}` : null} text={briscolaSticker(view, me, names)} />
      {me !== null && <Hand cards={view.hand} width={handWidth} onPress={myTurn ? (c) => onMove({ card: c.id }) : undefined} drag={myTurn ? dragFromHand : undefined} />}
      <View style={{ height: 12 }} />
    </View>
  );
}

export function TresetteBoard({ view, me, names, myTurn, onMove }: BoardProps<TresetteView, TresetteMove>) {
  const handWidth = useCardWidth(Math.max(view.hand.length, 5), 80);
  const trickWidth = useCardWidth(5, 76);
  const teams = view.teamScores.length;
  const tinfo = (seat: Seat): SeatInfo => ({ seat, name: names[seat] + partnerMark(view.players, me, seat), active: view.turn === seat, cards: view.handCounts[seat], score: view.teamScores[teamOf(seat, view.players)], scoreLabel: 'punti' });
  if (view.phase !== 'play') {
    return (
      <View style={{ flex: 1, padding: 16, gap: 16, justifyContent: 'center' }}>
        <T size={24} weight="900" center>
          {view.phase === 'over' ? 'Partita finita' : 'Fine della mano'}
        </T>
        <CardsSummaryTable
          columns={Array.from({ length: teams }, (_, t) => teamLabel(t, view.players, names))}
          rows={[
            ['Punti mano', (view.handPoints ?? []).map((p) => `+${p}`)],
            ['Totale', view.teamScores.map(String)],
          ]}
        />
        {view.phase === 'handEnd' && (myTurn ? <Button label="Prossima mano" onPress={() => onMove({ type: 'next' })} /> : <Banner text={`${names[0]} dà le carte…`} />)}
      </View>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <TableDrop enabled={myTurn} onCard={(id) => onMove({ type: 'play', card: id })}>
      <Felt>
        <TableTop seats={othersOf(view.players, me).map(tinfo)} />
        {view.deckCount > 0 && (
          <View style={{ position: 'absolute', top: '4.5%', right: '4.5%', zIndex: 10 }}>
            <Slot width={me === null ? 74 : 60} label={`MAZZO · ${view.deckCount}`} ratio={1.85}>
              <DeckPile count={view.deckCount} width={me === null ? 68 : 54} />
            </Slot>
          </View>
        )}
        <TrickArea view={view} names={names} width={trickWidth} me={me} />
        {view.lastDraw.length > 0 && view.players === 2 && (
          <T size={13} color="#ffffffaa" center>
            Pescate: {view.lastDraw.map((d) => `${names[d.seat]} ${cardName(d.card)}`).join(', ')}
          </T>
        )}
        <MyCorner info={me === null ? null : tinfo(me)} style={{ right: '4.5%', bottom: '7%' }} />
      </Felt>
      </TableDrop>
      {me !== null && <Hand cards={view.hand} width={handWidth} playable={myTurn ? view.playable : undefined} onPress={myTurn ? (c) => onMove({ type: 'play', card: c.id }) : undefined} drag={myTurn ? dragFromHand : undefined} />}
      <View style={{ height: 12 }} />
    </View>
  );
}

/** Una presa ricca (dieci punti o più) si festeggia col cartello e i punti. */
function briscolaSticker(view: BriscolaView, me: Seat | null, names: string[]): string | null {
  const t = view.lastTrick;
  if (!t || view.trick.length) return null;
  const pts = t.plays.reduce((sum, p) => sum + (BRISCOLA_POINTS[p.card.rank] ?? 0), 0);
  if (pts < 10) return null;
  return `${t.winner === me ? 'Che presa!' : names[t.winner]} +${pts}`;
}
