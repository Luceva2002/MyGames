# Tavolata

La raccolta dei minigiochi di Luca: un'unica app (iOS, Android e sito) con il catalogo dei giochi,
partite sullo stesso dispositivo e stanze con codice in stile Jackbox, dove uno schermo fa da tavolo
e ognuno gioca dal proprio telefono.

## Giochi

| Gioco | Giocatori | Note |
| --- | --- | --- |
| Scopa | 2–4 | in quattro a coppie, si arriva a 11 |
| Briscola | 2–4 | in tre si toglie un due |
| Tresette | 2 o 4 | si arriva a 21, in due si pesca |
| Sette e mezzo | 2–8 | banco a rotazione, fiches |
| Scala 40 | 2–6 | apertura a 40, eliminazione a 101 |
| Burraco | 2 o 4 | pinelle, pozzetti, si arriva a 1005 |
| Machiavelli | 2–5 | il tavolo si rimescola liberamente |
| UNO | 2–10 | |
| Solitario | 1 | Klondike |
| Coriandoli | 1 | pezzi che cadono e righe da svuotare, con i coriandoli piccoli da tre |
| Serpentina | 1 | la stella filante che mangia i confetti |
| Sudoku | 1 | facile, medio o difficile, matita e tre aiuti |
| Raddoppia | 1 | tessere che si uniscono fino a 2048 |
| Taglia la frutta | 1 | un colpo di dito, niente petardi |
| Il razzo di Pulcinella | 1 | tieni premuto per volare, i punti sono i metri |
| Memory | 1–4 | dieci coppie di maschere |
| Dama | 2 | dama italiana |
| Scacchi | 2 | regole complete |
| Yahtzee | 1–6 | |
| Freccette | 1–8 | 301, mirino che ondeggia |
| Biliardo | 2 | palla 8 con fisica vera |
| Tris | 2 | |
| Mosaico | 2–4 | territorio a pezzi di 1–5 quadretti, griglia 14×14, 17×17 o 20×20 |
| Punti e linee | 2–4 | griglia da 4, 5 o 6 punti per lato |
| Color Wars | 2–4 | reazione a catena su griglia 5×5 |
| Battaglia navale | 2 | flotta nascosta sul telefono di ciascuno, mai sulla TV |
| Il Ballo Mascherato | 4–10 | in tempo reale, solo online col proprio telefono: compiti, Traditori, riunioni e voto |
| Lupus | 4–20 | regole e carte dei ruoli dall'app Lupus in Tabula; ruolo segreto sul telefono, mai sulla TV |

Tutti i giochi si possono fare anche contro il computer, tranne quelli a voce e con ruoli segreti come Mr. White e Il Ballo Mascherato.

## Design

Stile "Carnevale semplice" (specifica in `docs/SPEC-carnevale-semplice.md`): viola, giallo e magenta,
font Bagel Fat One e Nunito, contorni spessi con ombre piene, carte alla Balatro col bollino del valore,
velluto viola per i giochi di carte e computer-maschere della commedia dell'arte a figura intera (`assets/bots`).

Il design segue la skill `.claude/skills/game-ui-design` (pattern, errori tipici e regole con ID come `V-TXT-1`).
Design system in `apps/app/src/ui/`: token e palette Okabe-Ito in `theme.ts`, componenti comuni in `kit.tsx`,
impostazioni di accessibilità in `settings.ts` (testo in 3 misure, movimento ridotto, contrasto alto, vibrazione).
Copertine, icona, banner, dorsi delle carte e tavoli da gioco sono generati con Higgsfield
(`apps/app/assets/games`, `assets/images`, `assets/cards/back-*.jpg`, `assets/tables`).

Facce delle carte:
- piacentine: scansione di pubblico dominio delle carte Modiano, [Carte piacentine al completo.jpg](https://commons.wikimedia.org/wiki/File:Carte_piacentine_al_completo.jpg) (Wikimedia Commons);
- francesi: [Vector Playing Cards](https://opengameart.org/content/playing-cards-vector-png) di Byron Knoll, CC0 (asso di picche nella versione semplice);
- UNO: disegnate dal codice, senza grafica ufficiale.

## Come è fatto

```
packages/engine   regole di tutti i giochi in TypeScript, uguali per app e server
  src/cards       mazzi italiano (piacentine), francese e UNO, combinazioni del ramino
  src/physics     fisica deterministica del biliardo
  src/games       un file per gioco
  test            partite simulate e controlli sulle regole
server            stanze con codice (Colyseus): le regole girano qui,
                  ogni telefono riceve solo le sue carte
apps/app          app Expo (Expo Router): catalogo, partite locali, stanze
```

Ogni gioco implementa la stessa interfaccia (`setup`, `activePlayers`, `play`, `view`, `result`, `bot`):
`view(stato, posto)` restituisce solo quello che quel giocatore può vedere, quindi le carte degli altri
non arrivano mai sul tuo telefono. Lo schermo condiviso usa `view(stato, null)`.

## Avviare

```bash
make
```

Installa le dipendenze la prima volta, accende server delle stanze e sito e apre il browser su http://localhost:8081.
Dai telefoni sulla stessa Wi-Fi si entra dall'indirizzo che `make` stampa. Ctrl+C ferma tutto.

Altri comandi: `make telefono` (app su iPhone/Android con Expo Go), `make test`, `make stop`,
`make server` e `make web` per avviarli separati.

Variabili utili (in `apps/app/.env`):

- `EXPO_PUBLIC_SERVER_URL` indirizzo del server delle stanze, es. `wss://stanze.esempio.it`
- `EXPO_PUBLIC_WEB_URL` indirizzo del sito, usato nel QR di invito

Link diretto per provare un gioco contro il computer: `/play/<gioco>?bots=<quanti>`, es. `/play/scopa?bots=1`.

## Test

```bash
npm test
```

Simula centinaia di partite con soli computer per ogni gioco e numero di giocatori e controlla alcune regole
(prese della scopa, arrocco, presa al passo, presa obbligatoria della dama, burraco pulito e sporco…).

## Aggiungere un gioco

1. Scrivi le regole in `packages/engine/src/games/<id>.ts` e aggiungilo a `GAMES` in `catalog.ts`.
2. Disegna il tavolo in `apps/app/src/games/<Nome>Board.tsx` e registralo in `registry.tsx`.
3. `npm test` lo prova subito con il computer.
