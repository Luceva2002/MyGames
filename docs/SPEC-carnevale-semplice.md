# Stile "Carnevale semplice" per Tavolata

Scelto da Luca il 17/10/2026. Proposta visiva completa: https://claude.ai/artifact/PR4Yv6o4gfQwZBmvif9TVp
Il nome dell'app resta **Tavolata** per ora: "Matto" è proposto ma non deciso, quindi non rinominare nulla.

Le immagini usate dall'app sono in `apps/app/assets/`.

## 1. Token (apps/app/src/ui/theme.ts)

| token | valore | uso |
|---|---|---|
| bg | `#2A0E5C` | fondo dell'app |
| surface | `#3A1680` | pannelli, schede |
| surface2 | `#4A22A0` | pannelli secondari, input |
| brand | `#6B2BD9` | viola delle illustrazioni, header, hero |
| line | `#12052B` | contorni spessi (3 px) e ombre piene |
| text | `#FFFFFF` | testo principale |
| muted | `#D9CCF5` | testo secondario (contrasto ≥ 4.5:1 su bg) |
| accent | `#FFE14D` | bottone primario, turno, selezione (testo sopra: `#12052B`) |
| accent2 | `#FF2E88` | badge valore carte, punti, "+1 scopa!" |
| accent3 | `#19D3C5` | solo per distinguere i bot |
| felt | velluto viola, vedi tavolo |

- I colori dei giocatori restano Okabe-Ito con simbolo (regola P-ID): non sostituirli con la palette.
- Mai testo bianco su giallo (era il problema della scheda gioco): sul giallo il testo è `#12052B`.

## 2. Font (expo-font + @expo-google-fonts)
- Titoli, punteggi, cartelli del turno: **Bagel Fat One**.
- Testi e bottoni: **Nunito** 500/800.
- Il wordmark "Tavolata" in home: Bagel Fat One giallo `#FFE14D` con ombra piena `#12052B` 0 5px 0.

## 3. Forme e componenti
- Bottoni, schede, tessere gioco: bordo 3 px `#12052B`, ombra piena verso il basso (0 6px 0 `#12052B`, niente blur), raggio 26.
- Premuto: l'ombra scende a 0 2px e l'elemento scende di 4 px (feedback < 100 ms).
- Tessere della home: copertina quadrata + nome in Bagel Fat One + "2-4 · carte". Hover/focus: su di 4 px e ruotata di -1°.
- Hero home: `pronti/images/hero.jpg` (metà sinistra vuota per il titolo) + wordmark + sottotitolo "Metti la maschera, prendi il telefono: si gioca!".

## 4. Carte (stile alla Balatro, le carte vere restano quelle)
- Cornice: carta crema `#FFFDF6`, bordo 3 px `#12052B`, ombra 0 5px 0 + ombra morbida, raggio ~10% della larghezza.
- Valore: bollino magenta `#FF2E88` con il numero in Bagel Fat One bianco, che **esce dal bordo** in alto a sinistra (non copre più i semi).
- A riposo le carte sul tavolo dondolano leggermente (±1.2°, 3 s, sfasate); spento con riduzione movimento.
- Carta selezionata: si alza del 14% e prende un contorno giallo 4 px.
- Retri: `pronti/cards/back-it.jpg` (arlecchino magenta/giallo), `back-fr.jpg` (turchese/viola), `back-uno.jpg` (nero e giallo).
- Correzioni: la descrizione di Scopa dice "carte napoletane" ma il mazzo è piacentino; l'asso di denari ha il cerchio centrale bianco vuoto.

## 5. Tavolo
- Un solo tavolo per tutti i giochi di carte: `pronti/tables/carnevale.jpg` (velluto viola con bordo dorato, decorazioni solo ai bordi).
- Sulla TV: carte larghe almeno il 9% dello schermo, posti dei giocatori (simbolo/avatar, nome, punti) dentro il margine del 5%, un solo cartello "Tocca a …" in alto al centro (oggi compare due volte).

## 6. Bot a figura intera (scelti da Luca)
- I bot sono personaggi della commedia dell'arte e del carnevale, a figura intera, in `pronti/bots/<nome>.png` (sfondo viola).
- Al tavolo: tondo con il personaggio (ritagliato su testa e busto) accanto a nome e punti; nella lobby e nei risultati: figura intera.
- Personaggi e carattere (livello del bot):
  - Arlecchino: furbo, cambia strategia (difficile)
  - Pulcinella: pigro ma fortunato (facile)
  - Colombina: calcola tutto (medio)
  - Balanzone: spiega le regole e sbaglia (imprevedibile)
  - più i nuovi in `pronti/bots/` (brighella, pantalone, capitano, tartaglia, gianduja, meneghino, stenterello, rosaura, giullare, medico, arlecchina, forzuto: 16 file in tutto, già ritagliati uno per file, 336x752, sfondo viola #5B22D6 circa): assegnali a caso o per livello.

## 7. Copertine e icone
- `pronti/games/<id>.jpg` per tutti i 17 giochi, stessi id di `apps/app/assets/games/`. Sfondo per categoria (meta.category), palette scelta da Luca il 17/10 (brand-alt): carte turchese #19D3C5, tavolo viola #6B2BD9, dadi limone #FFE14D, abilita magenta #FF2E88, party notte #12052B. Usare lo stesso colore anche per il chip della categoria in home; gli originali viola sono in `pronti/games-viola/`.
- Icona app: `pronti/images/icon.png` (carta con la mascherina). Logo: `pronti/images/logo.png`.

## 8. Cosa manca ancora
- Logo vettoriale pulito (quello attuale è generato).
- I file grezzi da cui sono nati i pronti/ sono in raw/, raw2/, raw4/: non servono all'app.
- Tavoli dedicati per dama, scacchi, tris, freccette, rigori, biliardo, Yahtzee, Lupus: per ora usare il velluto viola o le immagini attuali.


## 9. Aggiornamento 17/10 mattina: UI di Matto, bot protagonisti (scelte di Luca)
Nome e logo restano **in sospeso**: non rinominare l'app e non cambiare il logo. Wordmark in home: il nome attuale in Bagel Fat One giallo.

**Home (layout Matto)**
- Hero: `pronti/images/hero.jpg` (1600x720, metà sinistra vuota per wordmark + frase "La TV è il tavolo, il telefono è il tuo controller."). Ci sono Pulcinella, Colombina, Giullare e Arlecchina.
- Sotto l'hero, due bottoni grandi affiancati: **Crea una stanza** (giallo, sottotitolo "Questo schermo fa da tavolo") e **Entra con un codice** (bianco/outline, sottotitolo "Il telefono diventa il controller").
- Poi filtri per categoria (chip col colore della categoria) e griglia di tessere: copertina quadrata, nome in Bagel Fat One, "2-4 · carte".

**Partita sulla TV (layout Matto)**
- In alto a sinistra i posti: pillola con avatar (giocatore: colore Okabe-Ito + simbolo; bot: tondo con testa e busto del personaggio), nome, punti. Il turno ha il bordo giallo.
- Un solo cartello "Tocca a …" in alto al centro.
- Carte sul tavolo grandi (almeno 9% della larghezza), con bollino del valore magenta fuori dall'angolo e leggero dondolio.
- Eventi ("+1 scopa!", "Settebello") come adesivo magenta inclinato al centro, 1.2 s.
- Mazzo in basso a sinistra con il numero di carte rimaste.

**Bot protagonisti (8)**: sprite trasparenti già scontornati in `pronti/bots-trasparenti/<nome>.png` (RGBA, ritagliati al personaggio). Usare questi al posto di tutti gli altri; gli altri 8 personaggi in `pronti/bots/` restano solo di scorta.
| bot | carattere | livello |
|---|---|---|
| Pulcinella | pigro ma fortunato | facile |
| Colombina | calcola tutto | medio |
| Giullare | gioca per lo spettacolo, rischia | imprevedibile |
| Arlecchina | veloce e sfacciata | medio |
| Arlecchino | elegante, ti legge le carte in faccia | difficile |
| Pantalone | avaro, non spreca mai una carta buona | difficile |
| Medico | silenzioso, aspetta il momento giusto | medio |
| Forzuto | tutto istinto, gioca forte | facile |
- Nella lobby e nei risultati: figura intera. Al tavolo: tondo con testa e busto.
