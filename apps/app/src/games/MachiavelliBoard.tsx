import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { checkMeld, NO_WILD, type Card, type MachiavelliMove, type MachiavelliView } from '@giochi/engine';
import { Banner, Opponents, PlayerBadge, seatsFrom, turnText, useCardWidth, type BoardProps } from './common';
import { MeldRow, MultiHand } from './RummyParts';
import { DeckPile } from '../ui/cards';
import { DropZone, type DragPayload } from '../ui/drag';
import { Button, Row, T } from '../ui/kit';
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
  const handWidth = useCardWidth(10, 60);
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

  return (
    <View style={{ flex: 1 }}>
      <Opponents>
        {seatsFrom(view.players, me).map((seat) => (
          <PlayerBadge key={seat} seat={seat} isMe={seat === me} name={names[seat]} active={view.turn === seat} cards={view.handCounts[seat]} deck="fr" score={view.handCounts[seat]} scoreLabel="in mano" />
        ))}
      </Opponents>
      <TableBg table="green" rounded style={{ marginHorizontal: 8 }}>
      <DropZone id="table" style={{ flex: 1 }} radius={16} accepts={(p) => editable && fromDrag(p)} onDrop={dropTo('new')}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 8, gap: 8, flexDirection: 'row', flexWrap: 'wrap' }}>
          <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <DeckPile count={view.stockCount} width={36} deck="fr" />
            <T size={13} color="#ffffffcc" style={{ flex: 1 }}>
              {editable ? 'Trascina le carte (dalla mano o dal tavolo) su un gruppo o in uno spazio libero; o selezionale e tocca un gruppo.' : view.last ? `${names[(view.turn + view.players - 1) % view.players]} ${view.last}` : ''}
            </T>
          </View>
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
          {groups.length === 0 && <T color="#ffffff66">Tavolo vuoto: cala la prima combinazione.</T>}
        </ScrollView>
      </DropZone>
      </TableBg>
      <Banner text={turnText(myTurn, names, view.turn, me)} tone={myTurn ? 'turn' : 'info'} />
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
    </View>
  );
}
