import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { captureOptions, cardName, teamOf, type ScopaMove, type ScopaView } from '@giochi/engine';
import { Banner, EventSticker, Felt, Hand, Opponents, PlayerBadge, seatsFrom, Slot, turnText, useCardWidth, type BoardProps } from './common';
import { CardsSummaryTable, teamLabel } from './summary';
import { DeckPile, PlayingCard } from '../ui/cards';
import { DropZone, type DragPayload } from '../ui/drag';
import { FlyIn } from '../ui/motion';
import { sfx } from '../ui/sound';
import { Button, Row, T } from '../ui/kit';
import { colors } from '../ui/theme';

export function ScopaBoard({ view, me, names, myTurn, onMove }: BoardProps<ScopaView, ScopaMove>) {
  const [selected, setSelected] = useState<string | null>(null);
  const handWidth = useCardWidth(3, 100);
  const tableWidth = useCardWidth(Math.max(view.table.length, 5), 76);
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
  return (
    <View style={{ flex: 1 }}>
      <Opponents>
        {seatsFrom(view.players, me).map((seat) => (
          <PlayerBadge key={seat} seat={seat} isMe={seat === me} name={names[seat] + (view.players === 4 && me !== null && seat !== me && teamOf(seat, 4) === teamOf(me, 4) ? ' 🤝' : '')} active={view.turn === seat} cards={view.handCounts[seat]} score={view.teamScores[teamOf(seat, view.players)]} scoreLabel={`/ ${view.target}`}>
            <T size={12} color={colors.muted}>
              prese {view.capturedCounts[seat]}
              {view.scope[seat] ? `  🧹${view.scope[seat]}` : ''}
            </T>
          </PlayerBadge>
        ))}
      </Opponents>
      <DropZone id="table" style={{ flex: 1 }} radius={22} inset={-10} accepts={(p) => myTurn && p.kind === 'hand'} onDrop={(p) => dropCard(p.ids[0])}>
      <Felt>
        <View style={{ position: 'absolute', top: 10, left: 12 }}>
          <Slot width={40} label="Mazzo">
            {view.deckCount > 0 ? <DeckPile count={view.deckCount} width={34} /> : null}
          </Slot>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, maxWidth: 6 * (tableWidth + 8) }}>
          {view.table.map((c, i) => (
            <FlyIn key={c.id} from={!dealt.current || view.lastPlay?.seat !== me ? 'above' : 'below'} delay={dealt.current ? 0 : 300 + i * 90} leave={view.turn === me ? 'down' : 'up'} sound={dealt.current ? 'card' : 'deal'}>
              <DropZone id={`t-${c.id}`} radius={10} inset={4} accepts={(p) => myTurn && canTake(p, c.id)} onDrop={(p) => dropCard(p.ids[0], c.id)}>
                <PlayingCard card={c} width={tableWidth} selected={highlighted.has(c.id)} dimmed={!!card && options.length > 0 && !highlighted.has(c.id)} />
              </DropZone>
            </FlyIn>
          ))}
          {view.table.length === 0 && <T color="#ffffff99">Tavolo vuoto</T>}
        </View>
        {last && (
          <T size={14} color="#ffffffcc" center>
            {names[last.seat]} ha giocato {cardName(last.card)}
            {last.taken.length ? ` e preso ${last.taken.length} ${last.taken.length === 1 ? 'carta' : 'carte'}` : ''}
            {last.scopa ? '  🧹 SCOPA!' : ''}
          </T>
        )}
      </Felt>
      </DropZone>
      <EventSticker
        eventKey={last ? `${last.seat}-${last.card.id}` : null}
        text={last?.scopa ? '+1 scopa!' : last && [last.card, ...last.taken].some((c) => c.suit === 'd' && c.rank === 7) && last.taken.length ? 'Settebello!' : null}
      />
      <Banner text={turnText(myTurn, names, view.turn, me)} tone={myTurn ? 'turn' : 'info'} />
      {me !== null && (
        <>
          <Hand
            cards={view.hand}
            width={handWidth}
            selected={selected}
            onPress={myTurn ? (c) => setSelected(c.id === selected ? null : c.id) : undefined}
            drag={myTurn ? (c) => ({ kind: 'hand', ids: [c.id] }) : undefined}
            onLift={(c, lifted) => {
              if (lifted) setSelected(c.id);
              else if (!keepSel.current) setSelected(null);
              keepSel.current = false;
            }}
          />
          <View style={{ minHeight: 64, padding: 8, gap: 8, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
            {card && options.length === 0 && <Button small label="Cala la carta" onPress={() => onMove({ type: 'play', card: card.id })} />}
            {card &&
              options.map((opt) => (
                <Button
                  key={opt.map((c) => c.id).join()}
                  small
                  label={`Prendi ${opt.map((c) => c.rank).join(' + ')}${opt.length === view.table.length ? ' 🧹' : ''}`}
                  onPress={() => onMove({ type: 'play', card: card.id, take: opt.map((c) => c.id) })}
                />
              ))}
            {!card && myTurn && <T color={colors.muted}>Trascina una carta sul tavolo, o toccala</T>}
          </View>
        </>
      )}
    </View>
  );
}
