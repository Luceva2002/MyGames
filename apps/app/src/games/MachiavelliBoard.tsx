import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { checkMeld, NO_WILD, type Card, type MachiavelliMove, type MachiavelliView , type Seat } from '@giochi/engine';
import { MyCorner, othersOf, Slot, TableTop, turnText, useCardWidth, type BoardProps, type SeatInfo } from './common';
import { CardTable, MeldRow, MultiHand } from './RummyParts';
import { DeckPile } from '../ui/cards';
import { DropZone, type DragPayload } from '../ui/drag';
import { Button, Row, T, tap } from '../ui/kit';
import { Anchor } from '../ui/motion';
import { TableBg } from '../ui/tables';
import { colors } from '../ui/theme';

/**
 * Il tavolo si modifica in una bozza locale: sposti carte fra i gruppi (anche quelli già in tavola)
 * e alla fine confermi. Il server controlla che tutto sia valido.
 */
export function MachiavelliBoard({ view, me, names, myTurn, onMove }: BoardProps<MachiavelliView, MachiavelliMove>) {
  const initial = useMemo(() => view.table.map((m) => m.cards.map((c) => c.id)), [view.table]);
  const [groups, setGroups] = useState<string[][]>(initial);
  const [hand, setHand] = useState<string[]>(view.hand.map((c) => c.id));
  const [selected, setSelected] = useState<string[]>([]);
  const handWidth = useCardWidth(10, 70);
  const reset = () => {
    setGroups(initial);
    setHand(view.hand.map((c) => c.id));
    setSelected([]);
  };
  useEffect(reset, [view.table, view.hand, view.turn]); // eslint-disable-line react-hooks/exhaustive-deps

  const byId = useMemo(() => new Map<string, Card>([...view.table.flatMap((m) => m.cards), ...view.hand].map((c) => [c.id, c])), [view.table, view.hand]);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const handOrigin = new Set(view.hand.map((c) => c.id));
  const changed = hand.length !== view.hand.length || JSON.stringify(groups) !== JSON.stringify(initial);
  const editable = myTurn;

  const moveSelectedTo = (target: number | 'new' | 'hand') => moveTo(selected, target);
  const moveTo = (ids: string[], target: number | 'new' | 'hand') => {
    const moving = target === 'hand' ? ids.filter((id) => handOrigin.has(id)) : ids;
    if (!moving.length) return;
    let next = groups.map((g) => g.filter((id) => !moving.includes(id)));
    if (target === 'new') next.push(moving);
    else if (target !== 'hand') next[target] = [...next[target], ...moving];
    next = next.filter((g) => g.length);
    setGroups(next);
    setHand((h) => (target === 'hand' ? [...h.filter((id) => !moving.includes(id)), ...moving] : h.filter((id) => !moving.includes(id))));
    setSelected([]);
  };

  // Trascinando: una carta scelta porta con sé tutte le scelte, sia dalla mano sia dal tavolo.
  const dragTable = (id: string): DragPayload | null => (editable ? { kind: 'table', ids: selected.includes(id) ? selected : [id] } : null);
  const fromDrag = (p: DragPayload) => p.kind === 'hand' || p.kind === 'table';
  const dropTo = (target: number | 'new' | 'hand') => (p: DragPayload) => moveTo(p.ids, target);

  const meldOf = (g: string[]) => checkMeld(g.map((id) => byId.get(id)!), NO_WILD);
  const allValid = groups.every((g) => meldOf(g));

  const canDraw = editable && !changed;
  // Il suggerimento sta nel cartello del turno, non più in una barra sopra il tavolo.
  const hint = editable
    ? changed
      ? 'Tavolo modificato: Conferma o Annulla'
      : 'Tocca a te: cala combinazioni o pesca dal mazzo'
    : view.last
      ? `${names[(view.turn + view.players - 1) % view.players]} ${view.last} · ${turnText(myTurn, names, view.turn, me)}`
      : turnText(myTurn, names, view.turn, me);

  const info = (seat: Seat): SeatInfo => ({ seat, name: names[seat], active: view.turn === seat, cards: view.handCounts[seat], deck: 'fr', score: view.handCounts[seat], scoreLabel: 'carte da calare' });
  return (
    <TableBg table="teal">
      <CardTable
        me={me === null ? null : info(me)}
        top={<TableTop corner={false} seats={othersOf(view.players, me).map(info)} />}
        count={1}
        piles={(pileW) =>
          <Pressable
            disabled={!canDraw}
            onPress={() => {
              tap();
              onMove({ type: 'draw' });
            }}
            accessibilityRole="button"
            accessibilityLabel="Mazzo: tocca per pescare una carta e passare"
          >
            <Slot width={pileW + 6} ratio={1.45} label={canDraw ? 'PESCA' : `MAZZO · ${view.stockCount}`} glow={canDraw ? colors.accent : undefined}>
              <Anchor id="deck">
                    <DeckPile count={view.stockCount} width={pileW} deck="fr" />
                  </Anchor>
            </Slot>
          </Pressable>
        }
      >
        <DropZone id="table" style={{ flex: 1 }} radius={16} accepts={(p) => editable && fromDrag(p)} onDrop={dropTo('new')}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10, gap: 10, flexDirection: 'row', flexWrap: 'wrap' }}>
            {groups.map((g, i) => {
              const m = meldOf(g);
              return (
                <MeldRow
                  key={i}
                  cards={m ? m.cards : g.map((id) => byId.get(id)!)}
                  width={me === null ? 48 : 36}
                  invalid={!m}
                  active={editable && selected.length > 0}
                  selected={selected}
                  onPress={editable && selected.length ? () => moveSelectedTo(i) : undefined}
                  onCardPress={editable ? toggle : undefined}
                  dropId={`g-${i}`}
                  accepts={(p) => editable && fromDrag(p) && !p.ids.every((id) => g.includes(id))}
                  onDrop={dropTo(i)}
                  dragCard={dragTable}
                />
              );
            })}
            {groups.length === 0 && (
              <View style={{ flex: 1, minHeight: 100, alignItems: 'center', justifyContent: 'center' }}>
                <T color="#ffffff88">Tavolo vuoto: cala la prima combinazione o pesca dal mazzo.</T>
              </View>
            )}
          </ScrollView>
        </DropZone>
      </CardTable>
      {me !== null && (
        <>
          <MultiHand
            cards={hand.map((id) => byId.get(id)!).filter(Boolean)}
            selected={selected}
            onToggle={editable ? toggle : undefined}
            width={handWidth}
            draggable={editable}
            dropHere={{ accepts: (p) => editable && p.kind === 'table' && p.ids.some((id) => handOrigin.has(id) && !hand.includes(id)), onDrop: dropTo('hand') }}
          />
          {editable && (
            <Row gap={8} wrap style={{ justifyContent: 'center', padding: 8 }}>
              {selected.length > 0 && <Button small label="Nuovo gruppo" onPress={() => moveSelectedTo('new')} />}
              {selected.some((id) => handOrigin.has(id) && !hand.includes(id)) && <Button small kind="ghost" color={colors.text} label="Rimetti in mano" onPress={() => moveSelectedTo('hand')} />}
              {changed && <Button small kind="ghost" color={colors.muted} label="Annulla" onPress={reset} />}
              {changed && <Button small color={colors.success} label="Conferma" disabled={!allValid || hand.length === view.hand.length} onPress={() => onMove({ type: 'commit', groups })} />}
              {!changed && <Button small kind="ghost" color={colors.text} label="Pesca e passa" onPress={() => onMove({ type: 'draw' })} />}
            </Row>
          )}
        </>
      )}
      <MyCorner wideOnly info={me === null ? null : info(me)} note={myTurn ? hint : undefined} />
    </TableBg>
  );
}
