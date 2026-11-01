import type { ComponentType } from 'react';
import type { BoardProps } from './common';
import { TrisBoard } from './TrisBoard';
import { ScopaBoard } from './ScopaBoard';
import { BriscolaBoard, TresetteBoard } from './TrickBoards';
import { SetteBoard } from './SetteBoard';
import { UnoBoard } from './UnoBoard';
import { DamaBoard, ScacchiBoard } from './BoardGames';
import { YahtzeeBoard } from './YahtzeeBoard';
import { SolitarioBoard } from './SolitarioBoard';
import { Scala40Board } from './Scala40Board';
import { BurracoBoard } from './BurracoBoard';
import { MachiavelliBoard } from './MachiavelliBoard';
import { FreccetteBoard } from './FreccetteBoard';
import { BiliardoBoard } from './BiliardoBoard';
import { LupusBoard } from './LupusBoard';
import { MrWhiteBoard } from './MrWhiteBoard';
import { MosaicoBoard } from './MosaicoBoard';
import { PuntiLineeBoard } from './PuntiLineeBoard';
import { ColorWarsBoard } from './ColorWarsBoard';
import { BattagliaBoard } from './BattagliaBoard';
import { BalloBoard } from './BalloBoard';
import { CoriandoliBoard } from './arcade/CoriandoliBoard';
import { SerpentinaBoard } from './arcade/SerpentinaBoard';
import { SudokuBoard } from './arcade/SudokuBoard';
import { RaddoppiaBoard } from './arcade/RaddoppiaBoard';
import { FruttaBoard } from './arcade/FruttaBoard';
import { RazzoBoard } from './arcade/RazzoBoard';
import { MemoryBoard } from './arcade/MemoryBoard';

/** Interfaccia di ogni gioco giocabile: riceve la vista del giocatore e manda le mosse. */
export const BOARDS: Record<string, ComponentType<BoardProps>> = {
  tris: TrisBoard,
  scopa: ScopaBoard,
  briscola: BriscolaBoard,
  tresette: TresetteBoard,
  setteemezzo: SetteBoard,
  uno: UnoBoard,
  dama: DamaBoard,
  scacchi: ScacchiBoard,
  yahtzee: YahtzeeBoard,
  solitario: SolitarioBoard,
  scala40: Scala40Board,
  burraco: BurracoBoard,
  machiavelli: MachiavelliBoard,
  freccette: FreccetteBoard,
  biliardo: BiliardoBoard,
  lupus: LupusBoard,
  mrwhite: MrWhiteBoard,
  mosaico: MosaicoBoard,
  puntielinee: PuntiLineeBoard,
  colorwars: ColorWarsBoard,
  battaglia: BattagliaBoard,
  ballo: BalloBoard,
  coriandoli: CoriandoliBoard,
  serpentina: SerpentinaBoard,
  sudoku: SudokuBoard,
  raddoppia: RaddoppiaBoard,
  frutta: FruttaBoard,
  razzo: RazzoBoard,
  memory: MemoryBoard,};
