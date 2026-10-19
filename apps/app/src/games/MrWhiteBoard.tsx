import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { usePathname } from 'expo-router';
import Animated, { Easing, FadeIn, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { MRWHITE_ROLES, type MrWhiteMove, type MrWhiteView, type Seat } from '@giochi/engine';
import type { BoardProps } from './common';
import { Button, focusRing, Panel, PlayerTag, Row, T, tap } from '../ui/kit';
import { useIsTv, useReducedMotion } from '../ui/settings';
import { sfx } from '../ui/sound';
import { TableBg } from '../ui/tables';
import { colors, MIN_TOUCH, OUTLINE, radius, seatColor, shadow } from '../ui/theme';

const CARD_W = 220;

/** Il biglietto con la parola: bianco come Mr. White, col dorso viola a punti interrogativi. */
function WordCard({ word, white, back, width = CARD_W, label = 'La tua parola' }: { word: string | null; white: boolean; back?: boolean; width?: number; label?: string }) {
  if (back) {
    return (
      <View style={[styles.card, { width, height: width * 1.4, backgroundColor: colors.brand }]} accessibilityLabel="Biglietto coperto">
        <T size={width * 0.36} weight="900" color={colors.accent}>
          ?
        </T>
        <T size={14} weight="800" color={colors.muted}>
          Tocca per girarlo
        </T>
      </View>
    );
  }
  return (
    <View style={[styles.card, { width, height: width * 1.4, backgroundColor: white ? '#FFFFFF' : colors.accent }]} accessibilityLabel={white ? 'Sei Mr. White, non hai nessuna parola' : `La tua parola è ${word}`}>
      {white ? (
        <>
          <T size={width * 0.3} center>
            🕵️
          </T>
          <T size={26} weight="900" color={colors.onAccent} center>
            Mr. White
          </T>
          <T size={15} weight="700" color={colors.onAccent} center>
            Non hai nessuna parola
          </T>
        </>
      ) : (
        <>
          <T size={14} weight="800" color={colors.onAccent}>
            {label}
          </T>
          <T size={(word && word.length > 11 ? 26 : 34) * (width / CARD_W)} weight="900" color={colors.onAccent} center>
            {word}
          </T>
        </>
      )}
    </View>
  );
}

/** Il biglietto si gira con un mezzo giro secco, senza rimbalzi; col movimento ridotto appare e basta. */
function FlipWord({ word, white }: { word: string | null; white: boolean }) {
  const reduced = useReducedMotion();
  const [front, setFront] = useState(reduced);
  const turn = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    sfx('scopa');
    turn.value = withTiming(0.5, { duration: 110, easing: Easing.in(Easing.quad) }, (done) => {
      if (!done) return;
      runOnJS(setFront)(true);
      turn.value = withTiming(1, { duration: 110, easing: Easing.out(Easing.quad) });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const style = useAnimatedStyle(() => {
    const deg = turn.value <= 0.5 ? turn.value * 180 : (1 - turn.value) * 180;
    return { transform: [{ perspective: 800 }, { rotateY: `${deg}deg` }] };
  });
  return (
    <Animated.View style={style}>
      <WordCard word={word} white={white} back={!front} />
    </Animated.View>
  );
}

/** Griglia di giocatori con conferma in due passi, per non eliminare qualcuno con un tocco sbagliato. */
function ChoiceGrid({ options, names, confirmLabel, onConfirm }: { options: Seat[]; names: string[]; confirmLabel: string; onConfirm: (target: Seat) => void }) {
  const [sel, setSel] = useState<Seat | null>(null);
  useEffect(() => setSel(null), [options.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
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
      </View>
      <Button label={sel === null ? 'Scegli qualcuno' : confirmLabel.replace('{x}', names[sel])} disabled={sel === null} onPress={() => sel !== null && onConfirm(sel)} />
    </View>
  );
}

function Toggle({ label, hint, value, disabled, onChange }: { label: string; hint: string; value: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => {
        tap();
        onChange(!value);
      }}
      style={(state) => [styles.toggle, { opacity: disabled ? 0.5 : 1 }, focusRing((state as { focused?: boolean }).focused ?? false)]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <T size={17} weight="800">
          {label}
        </T>
        <T size={14} color={colors.muted}>
          {hint}
        </T>
      </View>
      <View style={[styles.switch, value && { backgroundColor: colors.accent3 }]}>
        <View style={[styles.knob, value && { alignSelf: 'flex-end' }]} />
      </View>
    </Pressable>
  );
}

const roleName = (r: keyof typeof MRWHITE_ROLES) => MRWHITE_ROLES[r].name;

export function MrWhiteBoard({ view, me, names, myTurn, onMove }: BoardProps<MrWhiteView, MrWhiteMove>) {
  const tv = useIsTv() || me === null;
  // Sullo stesso dispositivo c'è un solo telefono che gira: si vota a voce e si tocca una volta.
  const local = !usePathname().startsWith('/room');
  const [undercover, setUndercover] = useState(view.undercoverCount > 0);
  const [revealed, setRevealed] = useState(false);
  const [peek, setPeek] = useState(false);
  const [guess, setGuess] = useState('');
  useEffect(() => setRevealed(false), [me]);
  const total = view.players.length;
  const alive = view.players.flatMap((p, i) => (p.alive ? [i] : []));
  const ended = view.phase === 'ended';
  // Telefono condiviso appoggiato sul tavolo (o TV): si mostra il tavolo, mai la parola di qualcuno.
  const table = tv || (view.shared && view.phase !== 'reveal' && !(view.phase === 'guess' && myTurn));

  // ---------- Notizie: chi è uscito e com'è andata ----------
  const out = view.lastOut;
  const news = out && (view.phase === 'clues' || view.phase === 'guess' || ended) && (
    <Panel style={{ alignSelf: 'stretch', alignItems: 'center' }}>
      <T size={18} weight="900" center>
        {out.random ? '🎲 Ancora parità: la sorte elimina ' : '❌ Eliminato: '}
        {names[out.seat]}
      </T>
      <T size={16} weight="800" center color={out.role === 'civile' ? colors.danger : colors.success}>
        {out.role === 'civile' ? 'Era un civile innocente…' : out.role === 'undercover' ? 'Era l’Undercover!' : 'Era Mr. White!'}
      </T>
      {view.guess && view.guess.seat === out.seat && (
        <T size={16} center>
          {names[out.seat]} ha provato con «{view.guess.word}»: {view.guess.correct ? 'giusto!' : 'sbagliato.'}
        </T>
      )}
    </Panel>
  );

  const roster = (
    <View style={styles.roster}>
      {view.players.map((p, i) => (p.alive && (view.phase === 'clues' || (view.phase === 'vote' && view.shared)) ? null : (
        <View key={i} style={[styles.rosterItem, !p.alive && { opacity: 0.55 }, { borderColor: p.alive ? seatColor(i) : colors.line }]}>
          <PlayerTag seat={i} name={names[i]} size={14} suffix={p.alive ? '' : ' ❌'} />
          {p.role && (
            <T size={12} color={p.role === 'civile' ? colors.muted : colors.accent} weight="800">
              {roleName(p.role)}
            </T>
          )}
          {view.phase === 'reveal' && (
            <T size={12} color={p.seen ? colors.success : colors.dim} weight="800">
              {p.seen ? '✓ ha visto' : '… deve guardare'}
            </T>
          )}
          {view.phase === 'vote' && !view.shared && p.alive && (
            <T size={12} color={p.hasVoted ? colors.success : colors.dim} weight="800">
              {p.hasVoted ? '✓ ha votato' : '… sta votando'}
            </T>
          )}
        </View>
      )))}
    </View>
  );

  const order = view.order.length > 0 && view.phase === 'clues' && (
    <Panel style={{ alignSelf: 'stretch' }}>
      <T size={18} weight="900">
        🗣️ Giro {view.round}: un indizio a testa
      </T>
      <T color={colors.muted}>Dite a voce una parola o una frase breve sulla parola segreta, senza dirla. In quest’ordine:</T>
      <View style={{ gap: 6 }}>
        {view.order.map((p, i) => (
          <Row key={p} gap={10}>
            <View style={[styles.num, i === 0 && { backgroundColor: colors.accent }]}>
              <T size={14} weight="900" color={i === 0 ? colors.onAccent : colors.text}>
                {i + 1}
              </T>
            </View>
            <PlayerTag seat={p} name={names[p]} size={16} suffix={i === 0 ? ' · comincia' : ''} />
          </Row>
        ))}
      </View>
    </Panel>
  );

  // ---------- Preparazione: chi apre la partita sceglie se giocare con l'Undercover ----------
  if (view.phase === 'setup') {
    return (
      <TableBg table="night" scrim={0.8}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.page}>
          <T size={28} weight="900" center>
            🕵️ Mr. White
          </T>
          {myTurn ? (
            <Panel style={{ alignSelf: 'stretch' }}>
              <T size={18} weight="900">
                Come giocate?
              </T>
              <Toggle
                label="Con l’Undercover"
                hint={view.undercoverCount > 0 ? `${view.undercoverCount === 1 ? 'Uno di voi riceve' : 'Due di voi ricevono'} una parola simile ma diversa, senza saperlo.` : 'Servono almeno 5 giocatori.'}
                value={undercover && view.undercoverCount > 0}
                disabled={view.undercoverCount === 0}
                onChange={setUndercover}
              />
              <T size={14} color={colors.muted}>
                {local ? 'Vi passate il telefono per guardare la parola, poi votate a voce e toccate chi eliminare.' : 'Ognuno guarda la parola e vota sul suo telefono.'}
              </T>
              <Button label="Distribuisci le parole" icon="🃏" onPress={() => onMove({ type: 'setup', undercover, shared: local })} />
            </Panel>
          ) : (
            <T size={18} center color={colors.muted}>
              {names[0]} sta preparando la partita…
            </T>
          )}
          {roster}
        </ScrollView>
      </TableBg>
    );
  }

  // ---------- Schermo condiviso (TV o telefono sul tavolo): mai parole segrete ----------
  if (table) {
    return (
      <TableBg table="night" scrim={0.8}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.page}>
          {view.phase === 'reveal' && (
            <T size={26} weight="900" center>
              🃏 Guardate la vostra parola: pronti {view.seenCount} su {total}
            </T>
          )}
          {news}
          {view.phase === 'guess' && out && (
            <Panel style={{ alignSelf: 'stretch', alignItems: 'center' }}>
              <T size={20} weight="900" center>
                🤔 {names[out.seat]} prova a indovinare la parola…
              </T>
              <T center color={colors.muted}>
                Se ci azzecca, vince da solo.
              </T>
            </Panel>
          )}
          {ended && view.words && <EndWords words={view.words} undercover={view.undercover} />}
          {order}
          {view.phase === 'clues' && myTurn && <Button label="Tutti hanno parlato: votiamo" icon="🗳️" onPress={() => onMove({ type: 'toVote' })} style={{ alignSelf: 'stretch' }} />}
          {view.phase === 'vote' && (
            <Panel style={{ alignSelf: 'stretch' }}>
              <T size={20} weight="900">
                🗳️ Chi eliminate?
              </T>
              {view.shared ? (
                <>
                  <T color={colors.muted}>Discutete e decidete insieme a voce, poi toccate chi esce dal gioco.</T>
                  {myTurn && <ChoiceGrid options={alive} names={names} confirmLabel="Elimina {x}" onConfirm={(target) => onMove({ type: 'eliminate', target })} />}
                </>
              ) : (
                <T color={colors.muted}>{view.runoff ? 'Parità! Si rivota solo fra i pari merito.' : 'Ognuno vota in segreto sul suo telefono.'}</T>
              )}
            </Panel>
          )}
          {roster}
        </ScrollView>
      </TableBg>
    );
  }

  const me_ = me!;
  const meAlive = view.players[me_].alive;

  // ---------- Telefono in mano: guarda la parola ----------
  if (view.phase === 'reveal') {
    return (
      <TableBg table="night" scrim={0.8}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.page}>
          {!myTurn ? (
            <>
              <T size={22} weight="900" center>
                ✓ Parola vista
              </T>
              <T center color={colors.muted}>
                Aspetta gli altri: pronti {view.seenCount} su {total}.
              </T>
              {roster}
            </>
          ) : revealed ? (
            <>
              <FlipWord word={view.myWord} white={view.iAmMrWhite} />
              <Animated.View entering={FadeIn.duration(150).delay(220)} style={{ gap: 8, alignItems: 'center' }}>
                <T center size={16}>
                  {view.iAmMrWhite ? 'Ascolta bene gli indizi degli altri e inventane uno credibile. Se ti scoprono puoi ancora vincere indovinando la parola.' : 'Ricordatela e non dirla a nessuno: al tuo turno darai un indizio.'}
                </T>
              </Animated.View>
              <View style={{ flex: 1 }} />
              <Button label={view.shared ? 'Ho visto, nascondi e passa' : 'Ho visto, nascondi'} onPress={() => onMove({ type: 'seen' })} style={{ alignSelf: 'stretch' }} />
            </>
          ) : (
            <>
              <Pressable accessibilityRole="button" accessibilityLabel="Gira il biglietto e scopri la tua parola" onPress={() => setRevealed(true)}>
                <WordCard word={null} white={false} back />
              </Pressable>
              <View style={styles.notice}>
                <T size={17} weight="800" center>
                  🤫 {names[me_]}, assicurati che nessuno guardi
                </T>
              </View>
              <View style={{ flex: 1 }} />
              <Button label="Scopri la mia parola" onPress={() => setRevealed(true)} style={{ alignSelf: 'stretch' }} />
            </>
          )}
        </ScrollView>
      </TableBg>
    );
  }

  // ---------- Mr. White scoperto: ultima occasione ----------
  if (view.phase === 'guess' && myTurn) {
    return (
      <TableBg table="night" scrim={0.8}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <T size={26} weight="900" center>
            🕵️ {view.shared ? `${names[me_]} era Mr. White!` : 'Ti hanno scoperto!'}
          </T>
          <Panel style={{ alignSelf: 'stretch' }}>
            <T size={18} weight="900">
              Qual è la parola dei civili?
            </T>
            <T color={colors.muted}>Se la indovini vinci tu, da solo. Hai un solo tentativo.</T>
            <TextInput
              value={guess}
              onChangeText={setGuess}
              placeholder="Scrivi la parola"
              placeholderTextColor={colors.dim}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={40}
              style={styles.input}
              accessibilityLabel="La parola dei civili"
              onSubmitEditing={() => guess.trim() && onMove({ type: 'guess', word: guess })}
            />
            <Button label="Indovina" icon="🎯" disabled={!guess.trim()} onPress={() => onMove({ type: 'guess', word: guess })} />
          </Panel>
        </ScrollView>
      </TableBg>
    );
  }

  // ---------- Ognuno sul suo telefono ----------
  return (
    <TableBg table="night" scrim={0.8}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.page}>
        <Row style={{ justifyContent: 'space-between', alignSelf: 'stretch' }}>
          <T size={18} weight="900">
            {ended ? '🏁 Fine' : `🕵️ Giro ${view.round}`}
          </T>
          {!ended && (
            <Pressable accessibilityRole="button" accessibilityLabel="Mostra la mia parola" onPress={() => setPeek((v) => !v)} style={styles.chip}>
              <T size={14} weight="800">
                {peek ? (view.iAmMrWhite ? '🕵️ Sei Mr. White' : `🃏 ${view.myWord}`) : '🃏 La mia parola'}
              </T>
            </Pressable>
          )}
        </Row>
        {news}
        {ended && view.words && <EndWords words={view.words} undercover={view.undercover} />}
        {view.phase === 'guess' && out && (
          <T size={18} weight="800" center>
            🤔 {names[out.seat]} prova a indovinare la parola…
          </T>
        )}
        {!meAlive && !ended && (
          <Panel style={{ alignSelf: 'stretch' }}>
            <T size={18} weight="900">
              ❌ Sei fuori dal gioco
            </T>
            <T color={colors.muted}>Guarda come va a finire, senza aiutare nessuno!</T>
          </Panel>
        )}
        {order}
        {view.phase === 'clues' && (myTurn ? <Button label="Tutti hanno parlato: votiamo" icon="🗳️" onPress={() => onMove({ type: 'toVote' })} style={{ alignSelf: 'stretch' }} /> : <T center color={colors.muted}>Quando avete finito, {names[view.order[0]]} apre il voto.</T>)}
        {view.phase === 'vote' && meAlive && (
          <Panel style={{ alignSelf: 'stretch' }}>
            <T size={20} weight="900">
              🗳️ {view.runoff ? 'Ballottaggio' : 'Chi eliminate?'}
            </T>
            <T color={colors.muted}>{view.runoff ? 'Parità! Si rivota solo fra i pari merito.' : 'Vota in segreto. In parità si rivota fra i pari merito.'}</T>
            {myTurn ? (
              <ChoiceGrid options={view.candidates.filter((p) => p !== me_)} names={names} confirmLabel="Voto: {x}" onConfirm={(target) => onMove({ type: 'vote', target })} />
            ) : (
              <T weight="800" color={view.myVote !== undefined ? colors.success : colors.muted}>
                {view.myVote !== undefined ? `✓ Hai votato ${names[view.myVote]}. Aspetta gli altri.` : 'Nel ballottaggio votano gli altri.'}
              </T>
            )}
          </Panel>
        )}
        {roster}
      </ScrollView>
    </TableBg>
  );
}

function EndWords({ words, undercover }: { words: { civile: string; undercover: string }; undercover: boolean }) {
  return (
    <Row gap={12} wrap style={{ justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <WordCard word={words.civile} white={false} width={140} label="Civili" />
      </View>
      {undercover && (
        <View style={{ alignItems: 'center', gap: 6 }}>
          <WordCard word={words.undercover} white={false} width={140} label="Undercover" />
        </View>
      )}
    </Row>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 16, alignItems: 'center', flexGrow: 1, width: '100%', maxWidth: 640, alignSelf: 'center' },
  card: { borderRadius: radius.l, borderWidth: OUTLINE, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 14, ...shadow(6) },
  choice: { minHeight: MIN_TOUCH + 4, minWidth: 140, paddingHorizontal: 14, justifyContent: 'center', borderRadius: radius.m, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface },
  roster: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  rosterItem: { padding: 8, borderRadius: radius.m, borderWidth: 2, backgroundColor: colors.surface, minWidth: 120, gap: 2 },
  notice: { backgroundColor: '#12052BE6', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 2, borderColor: colors.accent },
  chip: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.surface2 },
  num: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.line },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: MIN_TOUCH + 8, padding: 12, borderRadius: radius.m, backgroundColor: colors.surface2, borderWidth: 2, borderColor: colors.line },
  switch: { width: 54, height: 32, borderRadius: 16, backgroundColor: colors.line, padding: 3, justifyContent: 'center' },
  knob: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff' },
  input: { minHeight: 52, backgroundColor: colors.surface2, color: colors.text, borderRadius: radius.s, paddingHorizontal: 14, fontSize: 20, fontWeight: '700', borderWidth: 2, borderColor: colors.line },
});
