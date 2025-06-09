/*
Sources:
- https://listfist.com/list-of-tetris-levels-by-speed-nes-ntsc-vs-pal
- https://tetris.wiki/Tetris_(NES)
- https://tetris.fandom.com/wiki/Nintendo_Rotation_System
- https://tetris.wiki/Tetris_Guideline
*/

import _ from "lodash";
import { readKey, readLine, waitFor } from "../Functions";
import { getIsPositionInRect, Rect, Size } from "../types";
import { Executable } from "./FileSystem";
import { PC } from "./PC";
import { Screen } from "../Screen";
import { Vector, vectorAdd, vectorEqual, zeroVector } from "../Toolbox/Vector";
import { CgaColors } from "../Color/types";
import { CGA_PALETTE_DICT } from "../Color/cgaPalette";

const msPerFrame = 16.666666666;

interface Level {
  msPerCell: number;
}

const levels: Level[] = [
  { msPerCell: 48 * msPerFrame },
  { msPerCell: 43 * msPerFrame },
  { msPerCell: 38 * msPerFrame },
  { msPerCell: 33 * msPerFrame },
  { msPerCell: 28 * msPerFrame },
  { msPerCell: 23 * msPerFrame },
  { msPerCell: 18 * msPerFrame },
  { msPerCell: 13 * msPerFrame },
  { msPerCell: 8 * msPerFrame },
  { msPerCell: 6 * msPerFrame },
  { msPerCell: 5 * msPerFrame },
  { msPerCell: 5 * msPerFrame },
  { msPerCell: 5 * msPerFrame },
  { msPerCell: 4 * msPerFrame },
  { msPerCell: 4 * msPerFrame },
  { msPerCell: 4 * msPerFrame },
  { msPerCell: 3 * msPerFrame },
  { msPerCell: 3 * msPerFrame },
  { msPerCell: 3 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 1 * msPerFrame },
];

type SignalListener<D> = (data: D) => void;

class Signal<D> {
  private listeners: Array<SignalListener<D>>;
  constructor() {
    this.listeners = [];
  }

  public listen(l: SignalListener<D>) {
    this.listeners.push(l);

    return () => {
      this.listeners = this.listeners.filter(
        (currentListener) => currentListener !== l
      );
    };
  }

  public emit(data: D) {
    for (const l of this.listeners) {
      l(data);
    }
  }
}

const WIDTH = 10;
const HEIGHT = 20;
const CELL_WIDTH = 2;
const CELL_HEIGHT = 1;
const BORDER_SIZE_H = 2;
const BORDER_SIZE_V = 1;
const NUM_CELLS = WIDTH * HEIGHT;
const BOARD_RECT: Rect = { x: 0, y: 0, w: WIDTH, h: HEIGHT };

const DAS_DELAY_LENGTH = 10 * msPerFrame;
const DAS_LENGTH = 2 * msPerFrame;

enum Piece {
  I = "I",
  O = "O",
  J = "J",
  L = "L",
  S = "S",
  T = "T",
  Z = "Z",
}

const sevenBag = [
  Piece.I,
  Piece.O,
  Piece.J,
  Piece.L,
  Piece.S,
  Piece.T,
  Piece.Z,
];

interface PieceDescriptor {
  size: Size;
  rotations: Array<string>;
  spawnPosition: Vector;
  color: string;
}

const pieceDescriptors: Record<Piece, PieceDescriptor> = {
  [Piece.I]: {
    size: { w: 4, h: 4 },
    rotations: [
      "    XXXX        ",
      "  X   X   X   X ",
      "        XXXX    ",
      " X   X   X   X  ",
    ],
    spawnPosition: { x: 3, y: -1 },
    color: CGA_PALETTE_DICT[CgaColors.Cyan],
  },
  [Piece.O]: {
    size: { w: 2, h: 2 },
    rotations: ["XXXX"],
    spawnPosition: { x: 4, y: -1 },
    color: CGA_PALETTE_DICT[CgaColors.Yellow],
  },
  [Piece.J]: {
    size: { w: 3, h: 3 },
    rotations: ["X  XXX   ", " XX X  X ", "   XXX  X", " X  X XX "],
    spawnPosition: { x: 3, y: -1 },
    color: CGA_PALETTE_DICT[CgaColors.Blue],
  },
  [Piece.L]: {
    size: { w: 3, h: 3 },
    rotations: ["  XXXX   ", " X  X  XX", "   XXXX  ", "XX  X  X "],
    spawnPosition: { x: 3, y: -1 },
    color: CGA_PALETTE_DICT[CgaColors.Orange],
  },
  [Piece.S]: {
    size: { w: 3, h: 3 },
    rotations: [" XXXX    ", " X  XX  X", "    XXXX ", "X  XX  X "],
    spawnPosition: { x: 3, y: -1 },
    color: CGA_PALETTE_DICT[CgaColors.Green],
  },
  [Piece.T]: {
    size: { w: 3, h: 3 },
    rotations: [" X XXX   ", " X  XX X ", "   XXX X ", " X XX  X "],
    spawnPosition: { x: 3, y: -1 },
    color: CGA_PALETTE_DICT[CgaColors.Magenta],
  },
  [Piece.Z]: {
    size: { w: 3, h: 3 },
    rotations: ["XX  XX   ", "  X XX X ", "   XX  XX", " X XX X  "],
    spawnPosition: { x: 3, y: -1 },
    color: CGA_PALETTE_DICT[CgaColors.Red],
  },
};

interface Cell {
  filled: boolean;
  color: string;
}

class FallingPiece {
  private descriptor: PieceDescriptor;
  private size: Size;
  private position: Vector;
  private currentRotation: number;
  private grid: string;

  public onPlaced: Signal<void> = new Signal<void>();

  private msPerCell: number;
  private stepCounter: number;

  private direction: Vector;
  private dasDelayCounter: number;
  private dasCounter: number;

  private ctx: Tetris;

  constructor(ctx: Tetris, piece: Piece, level: Level) {
    this.ctx = ctx;
    this.descriptor = pieceDescriptors[piece];
    this.size = { ...this.descriptor.size };
    this.position = { ...this.descriptor.spawnPosition };

    this.currentRotation = 0;
    this.grid = this.descriptor.rotations[this.currentRotation];

    this.msPerCell = level.msPerCell;
    this.stepCounter = this.msPerCell;

    this.direction = { x: 0, y: 0 };
    this.dasDelayCounter = DAS_DELAY_LENGTH;
    this.dasCounter = 0;
  }

  public draw() {
    this.doForEachSquare((boardPosition) => {
      this.ctx.drawSquare(boardPosition, this.descriptor.color);
    });
  }

  private doForEachSquare(fn: (boardPosition: Vector) => void) {
    for (let y = 0; y < this.size.h; y += 1) {
      for (let x = 0; x < this.size.w; x += 1) {
        if (this.grid[y * this.size.w + x] === "X") {
          fn({
            x: this.position.x + x,
            y: this.position.y + y,
          });
        }
      }
    }
  }

  private updateGrid() {
    this.grid = this.descriptor.rotations[this.currentRotation];
  }

  private _rotateRight() {
    this.currentRotation += 1;
    while (this.currentRotation >= this.descriptor.rotations.length) {
      this.currentRotation -= this.descriptor.rotations.length;
    }
    this.updateGrid();
  }

  public rotateRight() {
    this._rotateRight();
    if (this.getIsColliding()) {
      this._rotateLeft();
    }
  }

  private _rotateLeft() {
    this.currentRotation -= 1;
    while (this.currentRotation < 0) {
      this.currentRotation += this.descriptor.rotations.length;
    }
    this.updateGrid();
  }

  public rotateLeft() {
    this._rotateLeft();
    if (this.getIsColliding()) {
      this._rotateRight();
    }
  }

  private getIsCollidingBoardEdges() {
    let isColliding = false;
    // add two rows to the top of the board rect for rotations
    this.doForEachSquare((pos) => {
      isColliding =
        isColliding ||
        !getIsPositionInRect(pos, {
          ...BOARD_RECT,
          y: BOARD_RECT.y - 2,
          h: BOARD_RECT.h + 2,
        });
    });
    return isColliding;
  }

  private getIsCollidingBoard() {
    const board = this.ctx.getBoard();
    let isColliding = false;
    this.doForEachSquare((pos) => {
      isColliding = isColliding || Boolean(board.getCell(pos)?.filled);
    });
    return isColliding;
  }

  private getIsColliding() {
    return this.getIsCollidingBoardEdges() || this.getIsCollidingBoard();
  }

  private moveInDirection() {
    const oldPosition = this.position;
    this.position = vectorAdd(this.position, this.direction);
    if (this.getIsColliding()) {
      this.position = oldPosition;
    }
  }

  public moveDown() {
    this.position.y += 1;
  }

  public step() {
    this.position.y += 1;
    if (this.getIsColliding()) {
      // hit ground
      this.position.y -= 1;
      this.fillIn();
      this.onPlaced.emit();
    }
  }

  private fillIn() {
    const board = this.ctx.getBoard();
    this.doForEachSquare((pos) => {
      board.fillCell(pos, this.descriptor.color);
    });
  }

  public update(dt: number) {
    this.stepCounter -= dt;
    while (this.stepCounter < 0) {
      this.stepCounter += this.msPerCell;
      this.step();
    }

    let moveDt = dt;
    if (this.getIsMoving()) {
      if (this.dasDelayCounter > 0) {
        this.dasDelayCounter = this.dasDelayCounter - moveDt;
      }
      if (this.dasDelayCounter <= 0) {
        moveDt += this.dasDelayCounter;
        this.dasDelayCounter = 0;
        this.dasCounter = Math.max(0, this.dasCounter - moveDt);
        if (this.dasCounter === 0) {
          this.moveInDirection();
          this.dasCounter = DAS_LENGTH;
        }
      }
    } else {
      this.dasDelayCounter = DAS_DELAY_LENGTH;
      this.dasCounter = 0;
    }
  }

  private getIsMoving() {
    return !vectorEqual(this.direction, zeroVector);
  }

  public setDirection(direction: Vector) {
    if (!vectorEqual(this.direction, direction)) {
      this.direction = direction;

      if (!vectorEqual(this.direction, zeroVector)) {
        this.dasDelayCounter = DAS_DELAY_LENGTH;
        this.dasCounter = 0;
        this.moveInDirection();
      }
    }
  }
}

class Board {
  private board: Array<Cell>;

  constructor() {
    this.board = new Array(NUM_CELLS);
    for (let i = 0; i < NUM_CELLS; i += 1) {
      this.board[i] = {
        filled: false,
        color: CGA_PALETTE_DICT[CgaColors.LightGray],
      };
    }
  }

  private getBoardIndexFromBoardPosition(boardPosition: Vector): number {
    return boardPosition.y * WIDTH + boardPosition.x;
  }

  public getCell(pos: Vector): Cell | null {
    const idx = this.getBoardIndexFromBoardPosition(pos);
    if (idx < 0 || idx > this.board.length) return null;
    return this.board[idx];
  }

  public fillCell(pos: Vector, color: string): void {
    this.board[this.getBoardIndexFromBoardPosition(pos)].filled = true;
    this.board[this.getBoardIndexFromBoardPosition(pos)].color = color;
  }
}

export class Tetris implements Executable {
  private pc: PC;
  private board: Board;
  private boardScreenRect: Rect;
  private fallingPiece: FallingPiece | null = null;

  private bag: Array<Piece>;
  private bagIndex: number;

  constructor(pc: PC) {
    this.pc = pc;

    const { screen } = this.pc;

    this.board = new Board();

    const screenSize = screen.getSizeInCharacters();

    this.boardScreenRect = {
      x: Math.floor(
        (screenSize.w - WIDTH * CELL_WIDTH - 2 * BORDER_SIZE_H) / 2
      ),
      y: screenSize.h - HEIGHT * CELL_HEIGHT - 1 * BORDER_SIZE_V,
      w: WIDTH * CELL_WIDTH,
      h: HEIGHT * CELL_HEIGHT,
    };

    this.bag = [...sevenBag];
    this.bagIndex = 0;
    this.shuffleBag();
  }

  private init() {
    const { screen } = this.pc;
    screen.clear();
    screen.displayString(
      { x: 0, y: 0 },
      _.pad("======== P E N G T R I S ========", screen.getSizeInCharacters().w)
    );
  }

  private shuffleBag() {
    this.bag = _.shuffle(this.bag);
    this.bagIndex = 0;
  }

  private getScreenPositionFromBoardPosition(
    boardPosition: Vector
  ): Vector | null {
    if (!getIsPositionInRect(boardPosition, BOARD_RECT)) return null;

    return {
      x: this.boardScreenRect.x + boardPosition.x * CELL_WIDTH,
      y: this.boardScreenRect.y + boardPosition.y * CELL_HEIGHT,
    };
  }

  public drawSquare(boardPosition: Vector, color: string) {
    const { screen } = this.pc;
    const screenPos = this.getScreenPositionFromBoardPosition(boardPosition);
    if (screenPos) {
      screen.setCurrentAttributes({
        ...screen.getCurrentAttributes(),
        bgColor: color,
        fgColor: CGA_PALETTE_DICT[CgaColors.Black],
      });
      screen.displayString(screenPos, "[]");
    }
  }

  private drawBorder() {
    const { screen } = this.pc;
    screen.setCurrentAttributes({
      ...screen.getCurrentAttributes(),
      fgColor: CGA_PALETTE_DICT[CgaColors.LightGray],
      bgColor: CGA_PALETTE_DICT[CgaColors.Black],
    });
    for (
      let y = this.boardScreenRect.y;
      y < this.boardScreenRect.y + HEIGHT * CELL_HEIGHT;
      y += 1
    ) {
      screen.displayString(
        { x: this.boardScreenRect.x - BORDER_SIZE_H, y },
        "\x1Bsb07\x1Bsf00<!\x1Bsf08\x1Bsb00" +
          " .".repeat(WIDTH) +
          "\x1Bsb07\x1Bsf00!>"
      );
    }
    screen.displayString(
      {
        x: this.boardScreenRect.x - BORDER_SIZE_H,
        y: this.boardScreenRect.y + HEIGHT * CELL_HEIGHT,
      },
      "\x1Bsb07\x1Bsf00<!" + "=".repeat(WIDTH * CELL_WIDTH) + "!>"
    );
  }

  private drawBoardPieces() {
    for (let y = 0; y < HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        const boardPos = { x, y };
        const cell = this.board.getCell(boardPos);
        if (cell && cell.filled) {
          this.drawSquare(boardPos, cell.color);
        }
      }
    }
  }

  private drawBoard() {
    const { screen } = this.pc;
    this.drawBorder();
    this.drawBoardPieces();
  }

  public getBoard() {
    return this.board;
  }

  private spawnPiece() {
    this.fallingPiece = new FallingPiece(
      this,
      this.bag[this.bagIndex],
      levels[7]
    );
    this.fallingPiece.onPlaced.listen(() => {
      this.spawnPiece();
    });
    this.bagIndex += 1;
    if (this.bagIndex === this.bag.length) {
      this.shuffleBag();
    }
  }

  async run(args: string[]) {
    return new Promise<void>((resolve) => {
      const { screen, keyboard } = this.pc;
      screen.hideCursor();

      this.init();
      this.spawnPiece();

      let lastTime = performance.now();
      const doAnimationFrame: FrameRequestCallback = async () => {
        const dt = performance.now() - lastTime;
        lastTime = performance.now();

        // input

        const beenPressed = keyboard.getWasKeyPressed();
        if (beenPressed.has("ArrowUp")) {
          this.fallingPiece?.rotateRight();
        }
        if (beenPressed.has("Enter")) {
          resolve();
        }
        if (this.fallingPiece) {
          if (beenPressed.has("ArrowLeft")) {
            this.fallingPiece.setDirection({ x: -1, y: 0 });
          } else if (beenPressed.has("ArrowRight")) {
            this.fallingPiece.setDirection({ x: 1, y: 0 });
          } else if (
            !keyboard.getIsKeyPressed("ArrowLeft") &&
            !keyboard.getIsKeyPressed("ArrowRight")
          ) {
            this.fallingPiece.setDirection({ x: 0, y: 0 });
          }
        }
        keyboard.resetWereKeysPressed();

        // logic

        this.fallingPiece?.update(dt);

        // rendering

        this.drawBoard();
        this.fallingPiece?.draw();

        requestAnimationFrame(doAnimationFrame);
      };
      requestAnimationFrame(doAnimationFrame);
    });
  }
}
