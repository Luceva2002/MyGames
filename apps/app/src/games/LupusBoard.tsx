import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { ROLES, type LupusMove, type LupusView, type NightPrompt, type RoleId, type Seat } from '@giochi/engine';
import type { BoardProps } from './common';
import { Button, focusRing, Panel, PlayerTag, Row, T, tap } from '../ui/kit';
import { useIsTv, useReducedMotion } from '../ui/settings';
import { sfx } from '../ui/sound';
import { FlyIn } from '../ui/motion';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { TableBg } from '../ui/tables';
import { colors, MIN_TOUCH, radius, seatColor } from '../ui/theme';

/** Carte dei ruoli in stile tarocchi semplici, nei colori dell'app (Higgsfield, originali in design-proposte/raw7/lupus). */
const CARD: Record<RoleId | 'retro', ImageSourcePropType> = {
  lupo: require('../../assets/lupus/lupo.jpg'),
  villico: require('../../assets/lupus/villico.jpg'),
  veggente: require('../../assets/lupus/veggente.jpg'),
  medium: require('../../assets/lupus/medium.jpg'),
  guardia: require('../../assets/lupus/guardia.jpg'),
  indemoniato: require('../../assets/lupus/indemoniato.jpg'),
  gufo: require('../../assets/lupus/gufo.jpg'),
  criceto: require('../../assets/lupus/criceto.jpg'),
  massone: require('../../assets/lupus/massone.jpg'),
  retro: require('../../assets/lupus/retro.jpg'),
};

const CAUSE: Record<string, string> = { lupi: 'sbranato dai Lupi', veggente: 'ucciso dallo sguardo della Veggente', rogo: 'mandato al rogo' };

function RoleCard({ role, width }: { role: RoleId | 'retro'; width: number }) {
  return <Image source={CARD[role]} style={{ width, height: width * 1.5, borderRadius: radius.m }} accessibilityLabel={role === 'retro' ? 'Carta coperta' : `Carta del ruolo ${ROLES[role].name}`} />;
}

/**
 * La carta del ruolo che si gira: parte coperta, ruota su se stessa, a metà giro mostra il ruolo
 * e atterra con un rimbalzo, un lampo di luce e un suono. Col movimento ridotto appare e basta.
 */
function FlipRole({ role, width }: { role: RoleId; width: number }) {
  const reduced = useReducedMotion();
  const [front, setFront] = useState(reduced);
  const turn = useSharedValue(reduced ? 1 : 0);
  const glow = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    sfx('scopa');
    turn.value = withTiming(0.5, { duration: 260, easing: Easing.in(Easing.quad) }, (done) => {
      if (!done) return;
      runOnJS(setFront)(true);
      turn.value = withSpring(1, { damping: 9, stiffness: 140 });
      glow.value = withSequence(withTiming(1, { duration: 160 }), withTiming(0, { duration: 900 }));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const card = useAnimatedStyle(() => {
    const deg = turn.value <= 0.5 ? turn.value * 180 : (1 - turn.value) * 180;
    const lift = 1 + Math.sin(Math.min(turn.value, 1) * Math.PI) * 0.18;
    return { transform: [{ perspective: 800 }, { rotateY: `${deg}deg` }, { scale: lift }] };
  });
  const ring = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: 0.6 + (1 - glow.value) * 0.9 + glow.value * 0.4 }] }));
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: width * 1.5, height: width * 1.5, borderRadius: width, backgroundColor: role === 'lupo' ? '#FF2E8866' : '#FFE14D66', boxShadow: `0px 0px 60px ${role === 'lupo' ? colors.accent2 : colors.accent}` }, ring]} />
      <Animated.View style={card}>
        <RoleCard role={front ? role : 'retro'} width={width} />
      </Animated.View>
    </View>
  );
}

/** Testo delle informazioni notturne (il motore usa codici per non mescolare nomi e regole). */
function infoText(prompt: NightPrompt, names: string[], teammates: Seat[]): string {
  if (prompt.kind === 'choose') {
    if (prompt.info?.startsWith('branco:')) return `Il tuo branco: ${prompt.info.slice(7).split(',').map((s) => names[Number(s)]).join(', ')}.`;
    return prompt.info ?? '';
  }
  if (prompt.kind === 'info' && prompt.text.startsWith('rogo:')) {
    const [, seat, wolf] = prompt.text.split(':');
    return `${names[Number(seat)]} ${wolf === '1' ? 'ERA un Lupo.' : 'NON era un Lupo.'}`;
  }
  if (prompt.kind === 'info' && prompt.text === 'loggia') return teammates.length ? `I tuoi fratelli: ${teammates.map((s) => names[s]).join(', ')}.` : 'Sei l’ultimo della loggia.';
  return prompt.text;
}

/** Griglia di giocatori da scegliere, con conferma in due passi per evitare tocchi sbagliati (V-IN-4). */
function ChoiceGrid({ options, names, allowNone, confirmLabel, onConfirm }: {
  options: Seat[];
  names: string[];
  allowNone?: string;
  confirmLabel: string;
  onConfirm: (target: Seat | null) => void;
}) {
  const [sel, setSel] = useState<Seat | null | undefined>(undefined);
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((p) => (
          <Pressable
            key={p}
            accessibilityRole="radio"
            accessibilityState={{ selected: sel === p }}
            accessibilityLabel={names[p]}
            onPress={() => {
              tap();
              setSel(p);
            }}
            style={(state) => [styles.choice, sel === p && { borderColor: colors.accent, backgroundColor: colors.surface2 }, focusRing((state as { focused?: boolean }).focused ?? false)]}
          >
            <PlayerTag seat={p} name={names[p]} size={16} suffix={sel === p ? '  ✓' : ''} />
          </Pressable>
        ))}
        {allowNone && (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: sel === null }}
            onPress={() => {
              tap();
              setSel(null);
            }}
            style={(state) => [styles.choice, sel === null && { borderColor: colors.accent, backgroundColor: colors.surface2 }, focusRing((state as { focused?: boolean }).focused ?? false)]}
          >
            <T size={16} weight="800">
              {allowNone}
              {sel === null ? '  ✓' : ''}
            </T>
          </Pressable>
        )}
      </View>
      <Button label={sel === undefined ? 'Scegli qualcuno' : sel === null ? confirmLabel.replace('{x}', allowNone ?? 'nessuno') : confirmLabel.replace('{x}', names[sel])} disabled={sel === undefined} onPress={() => sel !== undefined && onConfirm(sel)} />
    </View>
  );
}

export function LupusBoard({ view, me, names, myTurn, onMove }: BoardProps<LupusView, LupusMove>) {
  const tv = useIsTv() || me === null;
  const [revealed, setRevealed] = useState(false);
  const [showRole, setShowRole] = useState(false);
  useEffect(() => setRevealed(false), [me]);
  const alive = view.players.map((p, i) => (p.alive ? i : -1)).filter((i) => i >= 0);
  const night = view.phase === 'night';
  const total = view.players.length;

  const news = (
    <View style={{ gap: 8 }}>
      {view.lastVote && view.phase !== 'day' && (
        <T size={16} weight="700" center>
          🔥 {view.lastVote.target === null ? 'Ieri il villaggio non ha mandato nessuno al rogo.' : `Ieri il villaggio ha mandato al rogo ${names[view.lastVote.target]}${view.players[view.lastVote.target].role ? `, che era ${ROLES[view.players[view.lastVote.target].role!].name}` : ''}.`}
        </T>
      )}
      {view.phase === 'day' && view.morning && (
        <>
          {view.morning.deaths.length === 0 && (
            <T size={18} weight="800" center>
              ☀️ Stanotte non è morto nessuno.
            </T>
          )}
          {view.morning.deaths.map((d) => (
            <T key={d.seat} size={18} weight="800" center>
              ☠️ {names[d.seat]} è stato {CAUSE[d.cause]}
              {view.players[d.seat].role ? `. Era ${ROLES[view.players[d.seat].role!].name}.` : '.'}
            </T>
          ))}
          {view.morning.owl !== null && (
            <T size={16} center color={colors.accent}>
              🦉 Il Gufo accusa {names[view.morning.owl]}.
            </T>
          )}
        </>
      )}
    </View>
  );

  const roster = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
      {view.players.map((p, i) => (
        <View key={i} style={[styles.rosterItem, !p.alive && { opacity: 0.5 }, { borderColor: p.alive ? seatColor(i) : colors.line }]}>
          <PlayerTag seat={i} name={names[i]} size={14} suffix={p.alive ? '' : ' ☠️'} />
          {p.role && (i !== me || !p.alive) && (
            <T size={12} color={colors.muted}>
              {ROLES[p.role].name}
            </T>
          )}
          {view.phase === 'day' && p.alive && (
            <T size={12} color={p.hasVoted ? colors.success : colors.dim} weight="800">
              {p.hasVoted ? '✓ ha votato' : '… sta votando'}
            </T>
          )}
        </View>
      ))}
    </View>
  );

  // ---------- Schermo condiviso: mai ruoli segreti (V-HID-1) ----------
  if (tv) {
    return (
      <TableBg table={night || view.phase === 'reveal' ? 'night' : 'day'} scrim={0.8}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 20, alignItems: 'center' }}>
          <T size={30} weight="900" center>
            {view.phase === 'reveal'
              ? '🃏 Guardate il vostro ruolo sul telefono'
              : night
                ? `🌙 Notte ${view.round}: il villaggio dorme`
                : view.phase === 'day'
                  ? `☀️ Giorno ${view.round}: discutete e votate`
                  : '🏁 Partita finita'}
          </T>
          {view.phase === 'reveal' && (
            <T size={20} color={colors.muted}>
              Pronti: {view.seenCount} su {total}
            </T>
          )}
          {news}
          {roster}
        </ScrollView>
      </TableBg>
    );
  }

  const me_ = me!;
  const myRole = view.myRole!;
  const roleDef = ROLES[myRole];
  const dead = !view.players[me_].alive;

  // ---------- Telefono: ruolo segreto ----------
  if (view.phase === 'reveal') {
    const done = !myTurn;
    return (
      <TableBg table={'night'} scrim={0.8}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.phone}>
          {done ? (
            <>
              <T size={22} weight="900" center>
                ✓ Ruolo visto
              </T>
              <T center color={colors.muted}>
                Aspetta gli altri: pronti {view.seenCount} su {total}.
              </T>
            </>
          ) : revealed ? (
            <>
              <FlipRole role={myRole} width={220} />
              {/* Il nome del ruolo arriva dopo il giro della carta, per non rovinare la sorpresa. */}
              <FlyIn from="none" delay={550} style={{ gap: 8, alignItems: 'center' }}>
                <T size={28} weight="900" center color={myRole === 'lupo' ? colors.accent2 : colors.accent}>
                  Sei {roleDef.name}
                </T>
                <T center>{roleDef.description}</T>
              </FlyIn>
              {view.teammates.length > 0 && (
                <T center weight="800">
                  {myRole === 'lupo' ? 'Il tuo branco' : 'La tua loggia'}: {view.teammates.map((s) => names[s]).join(', ')}
                </T>
              )}
              <View style={{ flex: 1 }} />
              <Button label="Ho visto, nascondi" onPress={() => onMove({ type: 'seen' })} style={{ alignSelf: 'stretch' }} />
            </>
          ) : (
            <>
              <Pressable accessibilityRole="button" accessibilityLabel="Gira la carta e scopri il tuo ruolo" onPress={() => setRevealed(true)}>
                <RoleCard role="retro" width={220} />
              </Pressable>
              <View style={styles.notice}>
                <T size={17} weight="800" center>
                  🤫 Assicurati che nessuno guardi lo schermo
                </T>
              </View>
              <View style={{ flex: 1 }} />
              <Button label="Scopri il mio ruolo" onPress={() => setRevealed(true)} style={{ alignSelf: 'stretch' }} />
            </>
          )}
        </ScrollView>
      </TableBg>
    );
  }

  const roleChip = (
    <Pressable accessibilityRole="button" accessibilityLabel="Mostra il mio ruolo" onPress={() => setShowRole((v) => !v)} style={styles.roleChip}>
      <T size={14} weight="800">
        {showRole ? `🃏 ${roleDef.name}` : '🃏 Il mio ruolo'}
      </T>
    </Pressable>
  );

  return (
    <TableBg table={night ? 'night' : 'day'} scrim={0.8}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.phone}>
        <Row style={{ justifyContent: 'space-between', alignSelf: 'stretch' }}>
          <T size={18} weight="900">
            {night ? `🌙 Notte ${view.round}` : view.phase === 'day' ? `☀️ Giorno ${view.round}` : '🏁 Fine'}
          </T>
          {roleChip}
        </Row>
        {showRole && <RoleCard role={myRole} width={140} />}
        {news}
        {dead && view.phase !== 'ended' && (
          <Panel style={{ alignSelf: 'stretch' }}>
            <T size={18} weight="900">
              ☠️ Sei fuori dal gioco
            </T>
            <T color={colors.muted}>Osserva in silenzio: i morti non parlano!</T>
          </Panel>
        )}
  
        {night && view.prompt && !dead && (
          <Panel style={{ alignSelf: 'stretch' }}>
            <T size={20} weight="900">
              {view.prompt.title}
            </T>
            {view.prompt.kind === 'choose' ? (
              <>
                <T color={colors.muted}>{view.prompt.instruction}</T>
                {infoText(view.prompt, names, view.teammates) ? <T weight="700">{infoText(view.prompt, names, view.teammates)}</T> : null}
                {myTurn ? (
                  <ChoiceGrid options={view.prompt.options} names={names} confirmLabel="Conferma: {x}" onConfirm={(target) => onMove({ type: 'night', target })} />
                ) : (
                  <T weight="800" color={colors.success}>
                    ✓ Scelta fatta. Ora dormi…
                  </T>
                )}
              </>
            ) : (
              <T size={17}>{infoText(view.prompt, names, view.teammates)}</T>
            )}
            {view.visions.length > 0 && (
              <View style={{ gap: 4 }}>
                {view.visions.map((v, i) => (
                  <T key={i} weight="800" color={v.wolf ? colors.danger : colors.success}>
                    {v.wolf ? '🐺' : '🙂'} Notte {v.round}: {names[v.target]} {v.wolf ? 'È un Lupo!' : 'non è un Lupo.'}
                  </T>
                ))}
              </View>
            )}
          </Panel>
        )}
  
        {view.phase === 'day' && !dead && (
          <Panel style={{ alignSelf: 'stretch' }}>
            <T size={20} weight="900">
              🗳️ Chi mandate al rogo?
            </T>
            <T color={colors.muted}>Discutete a voce, poi vota in segreto. In parità non muore nessuno.</T>
            {myTurn ? (
              <ChoiceGrid options={alive.filter((p) => p !== me_)} names={names} allowNone="Nessuno" confirmLabel="Voto: {x}" onConfirm={(target) => onMove({ type: 'vote', target })} />
            ) : (
              <T weight="800" color={colors.success}>
                ✓ Hai votato {view.myVote !== undefined && view.myVote >= 0 ? names[view.myVote] : 'nessuno'}. Aspetta gli altri.
              </T>
            )}
          </Panel>
        )}
        {roster}
      </ScrollView>
    </TableBg>
  );
}

const styles = StyleSheet.create({
  phone: { padding: 16, gap: 16, alignItems: 'center', flexGrow: 1 },
  choice: { minHeight: MIN_TOUCH + 4, minWidth: 140, paddingHorizontal: 14, justifyContent: 'center', borderRadius: radius.m, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface },
  rosterItem: { padding: 8, borderRadius: radius.m, borderWidth: 2, backgroundColor: colors.surface, minWidth: 120, gap: 2 },
  notice: { backgroundColor: '#12052BE6', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 2, borderColor: colors.accent },
  roleChip: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.surface2 },
});
