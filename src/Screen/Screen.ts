import {
  CGA_BOLD_MAP,
  CGA_PALETTE,
  CGA_PALETTE_DICT,
} from "../Color/cgaPalette";
import { font9x16 } from "./font9x16";
import { CgaColors } from "../Color/types";
import { ScreenCharacter, ScreenCharacterAttributes } from "./types";
import { Rect, Size, StringLike } from "../types";
import { getIsPrintable } from "./getIsPrintable";
import { Vector } from "../Toolbox/Vector";

const stringLikeToArray = (s: StringLike) => {
  if (Array.isArray(s)) {
    return s;
  }

  return s.split("");
};

export class Screen {
  private widthInCharacters: number;
  private heightInCharacters: number;
  private totalCharacters: number;

  private characterWidth: number;
  private characterHeight: number;

  private widthInPixels: number;
  private heightInPixels: number;

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;

  private bufferCanvas!: HTMLCanvasElement;
  private bufferCtx!: CanvasRenderingContext2D;

  private bgCanvas!: HTMLCanvasElement;
  private bgCtx!: CanvasRenderingContext2D;

  private charCanvas!: HTMLCanvasElement;
  private charCtx!: CanvasRenderingContext2D;

  private attributeCanvas!: HTMLCanvasElement;
  private attributeCtx!: CanvasRenderingContext2D;

  private graphicsCanvas!: HTMLCanvasElement;
  private graphicsCtx!: CanvasRenderingContext2D;

  private currentAttributes: ScreenCharacterAttributes;

  private curX: number;
  private curY: number;
  private curDisplay: boolean;
  private curBlinkState: boolean;
  private curBlinkDuration: number;
  private curBlinkCounter: number;
  /** Pixel of cell to start cursor on. */
  private curStart: number;
  /** Pixel of cell to end cursor on. Inclusive. */
  private curEnd: number;

  private charBlinkState: boolean;
  private charBlinkDuration: number;
  private charBlinkCounter: number;

  private shouldScrollOnWrite: boolean;
  private shouldWrapOnWrite: boolean;

  private screenBuffer: Array<ScreenCharacter>;

  constructor() {
    this.widthInCharacters = 80;
    this.heightInCharacters = 25;
    this.totalCharacters = this.widthInCharacters * this.heightInCharacters;

    this.characterWidth = 9;
    this.characterHeight = 16;

    this.widthInPixels = this.widthInCharacters * this.characterWidth;
    this.heightInPixels = this.heightInCharacters * this.characterHeight;

    this.currentAttributes = {
      bgColor: CGA_PALETTE_DICT["black"],
      fgColor: CGA_PALETTE_DICT["lightGray"],
      blink: false,
    };

    this.curX = 0;
    this.curY = 0;
    this.curDisplay = true;
    this.curBlinkState = true;
    this.curBlinkDuration = 600;
    this.curBlinkCounter = this.curBlinkDuration;
    this.curStart = 14;
    this.curEnd = 15;

    this.charBlinkState = true;
    this.charBlinkDuration = 600;
    this.charBlinkCounter = this.charBlinkDuration;

    this.shouldScrollOnWrite = true;
    this.shouldWrapOnWrite = true;

    this.screenBuffer = new Array(this.totalCharacters);
    for (let i = 0; i < this.totalCharacters; i += 1) {
      this.screenBuffer[i] = {
        character: " ",
        attributes: {
          ...this.currentAttributes,
        },
      };
    }
  }

  async init(containerEl: HTMLElement) {
    this.initCanvas(containerEl);

    this.bufferCanvas = document.createElement("canvas");
    this.bufferCanvas.width = this.canvas.width;
    this.bufferCanvas.height = this.canvas.height;
    this.bufferCtx = this.bufferCanvas.getContext("2d")!;
    this.bufferCtx.fillStyle = "white";

    this.bgCanvas = document.createElement("canvas");
    this.bgCanvas.width = this.canvas.width;
    this.bgCanvas.height = this.canvas.height;
    this.bgCtx = this.bgCanvas.getContext("2d")!;

    this.charCanvas = document.createElement("canvas");
    this.charCanvas.width = this.canvas.width;
    this.charCanvas.height = this.canvas.height;
    this.charCtx = this.charCanvas.getContext("2d")!;
    this.charCtx.fillStyle = "white";

    this.attributeCanvas = document.createElement("canvas");
    this.attributeCanvas.width = this.canvas.width;
    this.attributeCanvas.height = this.canvas.height;
    this.attributeCtx = this.attributeCanvas.getContext("2d")!;
    this.attributeCtx.fillStyle = this.currentAttributes.fgColor;
    this.attributeCtx.fillRect(0, 0, this.widthInPixels, this.heightInPixels);

    this.graphicsCanvas = document.createElement("canvas");
    this.graphicsCanvas.width = this.canvas.width;
    this.graphicsCanvas.height = this.canvas.height;
    this.graphicsCtx = this.graphicsCanvas.getContext("2d")!;
  }

  initCanvas(containerEl: HTMLElement) {
    const canvas = document.createElement("canvas");
    this.canvas = canvas;

    canvas.setAttribute("id", "screen");
    canvas.setAttribute("width", String(this.widthInPixels));
    canvas.setAttribute("height", String(this.heightInPixels));

    this.ctx = canvas.getContext("2d")!;

    containerEl.replaceChildren(canvas);
  }

  draw(dt: number) {
    this.curBlinkCounter -= dt;
    while (this.curBlinkCounter <= 0) {
      this.curBlinkCounter += this.curBlinkDuration;
      this.curBlinkState = !this.curBlinkState;
    }

    this.charBlinkCounter -= dt;
    while (this.charBlinkCounter <= 0) {
      this.charBlinkCounter += this.charBlinkDuration;
      this.charBlinkState = !this.charBlinkState;
    }

    // clear screen
    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.clearRect(0, 0, this.widthInPixels, this.heightInPixels);

    // draw background
    this.bufferCtx.globalCompositeOperation = "copy";
    this.bufferCtx.clearRect(0, 0, this.widthInPixels, this.heightInPixels);
    this.bufferCtx.drawImage(this.bgCanvas, 0, 0);
    this.ctx.drawImage(this.bufferCanvas, 0, 0);

    // draw character layer
    this.bufferCtx.clearRect(0, 0, this.widthInPixels, this.heightInPixels);
    this.bufferCtx.globalCompositeOperation = "source-over";
    this.bufferCtx.drawImage(this.charCanvas, 0, 0);

    // clear blinking characters
    if (this.charBlinkState === false) {
      for (let y = 0; y < this.heightInCharacters; y += 1) {
        for (let x = 0; x < this.widthInCharacters; x += 1) {
          const ch = this.getCharacterAt({ x, y });
          if (ch.attributes.blink) {
            this.bufferCtx.clearRect(
              x * this.characterWidth,
              y * this.characterHeight,
              this.characterWidth,
              this.characterHeight
            );
          }
        }
      }
    }

    // draw cursor
    if (this.curDisplay && this.curBlinkState) {
      const curW = this.characterWidth;
      const curH = this.curEnd - this.curStart + 1;
      const curX = this.curX * this.characterWidth;
      const curY = this.curY * this.characterHeight + this.curStart;
      this.bufferCtx.globalCompositeOperation = "xor";
      this.bufferCtx.fillRect(curX, curY, curW, curH);
    }

    // apply attribute layer
    this.bufferCtx.globalCompositeOperation = "source-atop";
    this.bufferCtx.drawImage(this.attributeCanvas, 0, 0);

    // commit characters
    this.ctx.drawImage(this.bufferCanvas, 0, 0);

    // display graphics
    this.ctx.drawImage(this.graphicsCanvas, 0, 0);
  }

  /** Clears screen using bgColor, resets fg color to current fgColor, clears char buffer. */
  clear() {
    const { bgCtx, charCtx, attributeCtx, graphicsCtx } = this;

    bgCtx.globalCompositeOperation = "source-over";
    bgCtx.fillStyle = this.currentAttributes.bgColor;
    bgCtx.fillRect(0, 0, this.widthInPixels, this.heightInPixels);

    attributeCtx.globalCompositeOperation = "source-over";
    charCtx.clearRect(0, 0, this.widthInPixels, this.heightInPixels);

    attributeCtx.globalCompositeOperation = "source-over";
    attributeCtx.fillStyle = this.currentAttributes.fgColor;
    attributeCtx.fillRect(0, 0, this.widthInPixels, this.heightInPixels);

    graphicsCtx.clearRect(0, 0, this.widthInPixels, this.heightInPixels);

    this.curX = 0;
    this.curY = 0;
  }

  getSizeInCharacters(): Size {
    return {
      w: this.widthInCharacters,
      h: this.heightInCharacters,
    };
  }

  getSizeInPixels(): Size {
    return {
      w: this.widthInPixels,
      h: this.heightInPixels,
    };
  }

  getCharacterSize(): Size {
    return {
      w: this.characterWidth,
      h: this.characterHeight,
    };
  }

  getTotalCharacters(): number {
    return this.totalCharacters;
  }

  //================================================= CANVAS HANDLING ==========================================

  private _getScreenBufferIndex(x: number, y: number) {
    return y * this.widthInCharacters + x;
  }

  redrawCharacter(x: number, y: number) {
    const bufferCharacter = this.screenBuffer[this._getScreenBufferIndex(x, y)];
    const { bgCtx, charCtx, attributeCtx, graphicsCtx } = this;

    // fill background
    bgCtx.globalCompositeOperation = "source-over";
    bgCtx.fillStyle = bufferCharacter.attributes.bgColor;
    bgCtx.fillRect(
      x * this.characterWidth,
      y * this.characterHeight,
      this.characterWidth,
      this.characterHeight
    );

    charCtx.clearRect(
      x * this.characterWidth,
      y * this.characterHeight,
      this.characterWidth,
      this.characterHeight
    );
    const atlasRegion = font9x16.getCharacter(bufferCharacter.character);
    if (atlasRegion) {
      const { canvas, x: cx, y: cy, w: cw, h: ch } = atlasRegion;

      // fill character
      charCtx.globalCompositeOperation = "source-over";
      charCtx.drawImage(
        canvas,
        cx,
        cy,
        cw,
        ch,
        x * this.characterWidth,
        y * this.characterHeight,
        this.characterWidth,
        this.characterHeight
      );
    }

    // fill attribute
    attributeCtx.globalCompositeOperation = "source-over";
    attributeCtx.fillStyle = bufferCharacter.attributes.fgColor;
    attributeCtx.fillRect(
      x * this.characterWidth,
      y * this.characterHeight,
      this.characterWidth,
      this.characterHeight
    );

    // clear graphics
    graphicsCtx.clearRect(
      x * this.characterWidth,
      y * this.characterHeight,
      this.characterWidth,
      this.characterHeight
    );
  }

  //================================================== BIOS FUNCTIONS =========================================

  showCursor() {
    this.curDisplay = true;
  }

  hideCursor() {
    this.curDisplay = false;
  }

  getCursorSize() {
    return { start: this.curStart, end: this.curEnd };
  }

  setCursorSize(start: number, end: number) {
    this.curStart = start;
    this.curEnd = end;
  }

  getCursorPosition(): Vector {
    return { x: this.curX, y: this.curY };
  }

  getCursorPositionPx(): Vector {
    return {
      x: this.curX * this.characterWidth,
      y: this.curY * this.characterHeight,
    };
  }

  setCursorPosition(pos: Vector, shouldWrap: boolean = false) {
    const { x, y } = this._resolveCursorXPosition(pos, shouldWrap);
    this.curX = x;
    this.curY = Math.max(0, Math.min(this.heightInCharacters - 1, y));
  }

  private _resolveCursorXPosition(
    pos: Vector,
    shouldWrap: boolean = false
  ): Vector {
    if (shouldWrap) {
      const newPos = { x: pos.x, y: pos.y };
      while (newPos.x < 0) {
        newPos.x += this.widthInCharacters;
        newPos.y -= 1;
      }
      while (newPos.x >= this.widthInCharacters) {
        newPos.x -= this.widthInCharacters;
        newPos.y += 1;
      }
      return newPos;
    } else {
      return {
        x: Math.max(0, Math.min(this.widthInCharacters - 1, pos.x)),
        y: pos.y,
      };
    }
  }

  setCursorPositionDelta(delta: Vector, shouldWrap: boolean = false) {
    const newPosition = this.getCursorPosition();
    newPosition.x += delta.x;
    newPosition.y += delta.y;
    this.setCursorPosition(newPosition, shouldWrap);
  }

  getCharacter() {
    return this.getCharacterAt(this.getCursorPosition());
  }

  getCharacterAt(pos: Vector) {
    const { x, y } = pos;
    return this.screenBuffer[this._getScreenBufferIndex(x, y)];
  }

  getCurrentAttributes(): ScreenCharacterAttributes {
    return {
      fgColor: this.currentAttributes.fgColor,
      bgColor: this.currentAttributes.bgColor,
      blink: this.currentAttributes.blink,
    };
  }

  setCurrentAttributes(attributes: ScreenCharacterAttributes) {
    this.currentAttributes = {
      fgColor: attributes.fgColor,
      bgColor: attributes.bgColor,
      blink: attributes.blink,
    };
  }

  replaceCharacter(char: string) {
    this.replaceCharacterAt(char, this.getCursorPosition());
  }

  replaceCharacterAt(char: string, pos: Vector) {
    const { x, y } = pos;
    const bufferCharacter = this.screenBuffer[this._getScreenBufferIndex(x, y)];
    bufferCharacter.character = char;
    this.redrawCharacter(x, y);
  }

  replaceCharacterAndAttributes(
    character: string,
    attributes: ScreenCharacterAttributes = this.currentAttributes
  ) {
    this.replaceCharacterAndAttributesAt(
      character,
      attributes,
      this.getCursorPosition()
    );
  }

  replaceCharacterAndAttributesAt(
    character: string,
    attributes: ScreenCharacterAttributes,
    pos: Vector
  ) {
    const { x, y } = pos;
    const bufferCharacter = this.screenBuffer[this._getScreenBufferIndex(x, y)];
    bufferCharacter.character = character;
    bufferCharacter.attributes = { ...attributes };
    this.redrawCharacter(x, y);
  }

  /*================================ TTY EMULATION =============================*/

  /** Handles escape code. Index should point to first character after escape character. Returns new index into string just after the escape sequence. */
  private handleEscape(string: StringLike, index: number): number {
    const cmdChar = string[index];
    index += 1;
    switch (cmdChar) {
      case "s": {
        const setChar = string[index];
        index += 1;
        switch (setChar) {
          case "f": {
            const colorIndex = parseInt(
              stringLikeToArray(string)
                .slice(index, index + 2)
                .join(""),
              16
            );
            if (colorIndex >= 0 && colorIndex < CGA_PALETTE.length) {
              this.currentAttributes.fgColor =
                CGA_PALETTE_DICT[CGA_PALETTE[colorIndex]];
            }
            index += 2;
            break;
          }
          case "b": {
            const colorIndex = parseInt(
              stringLikeToArray(string)
                .slice(index, index + 2)
                .join(""),
              16
            );
            if (colorIndex >= 0 && colorIndex < CGA_PALETTE.length) {
              this.currentAttributes.bgColor =
                CGA_PALETTE_DICT[CGA_PALETTE[colorIndex]];
            }
            index += 2;
            break;
          }
        }
        break;
      }
      case "i": {
        const fgColor = this.currentAttributes.fgColor;
        const bgColor = this.currentAttributes.bgColor;
        this.currentAttributes.fgColor = bgColor;
        this.currentAttributes.bgColor = fgColor;
        break;
      }
      case "b": {
        const boldCommand = string[index];
        index += 1;
        switch (boldCommand) {
          case "s": {
            const boldColor = CGA_BOLD_MAP[this.currentAttributes.fgColor];
            if (boldColor) {
              this.currentAttributes.fgColor = boldColor;
            }
            break;
          }
          case "r": {
            const fgColor = this.currentAttributes.fgColor;
            const result = Object.entries(CGA_BOLD_MAP).find(
              ([k, v]) => v === fgColor
            );
            if (result) {
              this.currentAttributes.fgColor = result[0];
            }
            break;
          }
        }
        break;
      }
      case "r": {
        this.currentAttributes.bgColor = CGA_PALETTE_DICT[CgaColors.Black];
        this.currentAttributes.fgColor = CGA_PALETTE_DICT[CgaColors.LightGray];
        this.currentAttributes.blink = false;
        break;
      }
      case "f": {
        this.currentAttributes.blink = !this.currentAttributes.blink;
        break;
      }
      default:
        index -= 1;
        break;
    }
    return index;
  }

  /** Prints a single character to screen using current attributes and moves cursor. */
  printChar(ch: string) {
    this.printString([ch]);
  }

  /** Prints a string of characters to screen using current attributes and moves cursor. */
  printString(string: StringLike) {
    this.displayString(this.getCursorPosition(), string, undefined, true);
  }

  /** Replace string at current cursor position with new string. */
  replaceString(string: StringLike) {
    const curPos = this.getCursorPosition();
    this.printString(string);
    this.setCursorPosition(curPos, false);
  }

  /** Updates screen by writing a string with provided attributes. Optionally updates cursor position. */
  displayString(
    pos: Vector,
    string: StringLike,
    attributes: ScreenCharacterAttributes | undefined = undefined,
    shouldUpdateCursor: boolean = false
  ) {
    let curPos = { x: pos.x, y: pos.y };

    let i = 0;
    while (i < string.length) {
      const ch = string[i];
      if (ch === "\n") {
        curPos.y += 1;
        curPos.x = 0;
      } else if (ch === "\b") {
        curPos.x -= 1;
        if (curPos.x < 0) {
          curPos.x = this.widthInCharacters - 1;
          curPos.y -= 1;
          if (curPos.y < 0) {
            curPos.y = 0;
          }
        }
        this.replaceCharacterAndAttributesAt(
          " ",
          attributes ?? this.currentAttributes,
          curPos
        );
      } else if (getIsPrintable(ch)) {
        this.replaceCharacterAndAttributesAt(
          ch,
          attributes ?? this.currentAttributes,
          curPos
        );
        curPos.x += 1;
      } else {
        i += 1;
        if (ch === "\x1B") {
          i = this.handleEscape(string, i);
        }
        continue;
      }

      curPos = this._resolveCursorXPosition(curPos, this.shouldWrapOnWrite);
      while (curPos.y >= this.heightInCharacters) {
        if (this.shouldScrollOnWrite) {
          this.scrollUp(1);
        }
        curPos.y -= 1;
      }
      i += 1;
    }

    if (shouldUpdateCursor) {
      this.setCursorPosition(curPos);
    }
  }

  /*================================ SCROLLING ================================*/

  private scrollCanvases(
    src: Rect,
    dst: Rect,
    clear: Rect,
    attributes: ScreenCharacterAttributes
  ) {
    const scrollDraws = [
      {
        ctx: this.bgCtx,
        canvas: this.bgCanvas,
      },
      {
        ctx: this.charCtx,
        canvas: this.charCanvas,
      },
      {
        ctx: this.attributeCtx,
        canvas: this.attributeCanvas,
      },
      {
        ctx: this.graphicsCtx,
        canvas: this.graphicsCanvas,
      },
    ];

    for (const { ctx, canvas } of scrollDraws) {
      this.bufferCtx.globalCompositeOperation = "copy";
      this.bufferCtx.drawImage(
        canvas,
        src.x,
        src.y,
        src.w,
        src.h,
        dst.x,
        dst.y,
        dst.w,
        dst.h
      );
      ctx.clearRect(dst.x, dst.y, dst.w, dst.h);
      ctx.drawImage(this.bufferCanvas, 0, 0);
    }

    this.bgCtx.fillStyle = attributes.bgColor;
    this.bgCtx.fillRect(clear.x, clear.y, clear.w, clear.h);
    this.charCtx.clearRect(clear.x, clear.y, clear.w, clear.h);
    this.attributeCtx.fillStyle = attributes.fgColor;
    this.attributeCtx.fillRect(clear.x, clear.y, clear.w, clear.h);
  }

  scrollUp(
    linesToScroll: number,
    attributes: ScreenCharacterAttributes = this.currentAttributes
  ) {
    this.scrollUpRect(
      {
        x: 0,
        y: 0,
        w: this.widthInCharacters,
        h: this.heightInCharacters,
      },
      linesToScroll,
      attributes
    );
  }

  scrollUpRect(
    rect: Rect,
    linesToScroll: number,
    attributes: ScreenCharacterAttributes = this.currentAttributes
  ) {
    // scroll screen buffer
    for (let y = rect.y + linesToScroll; y < rect.y + rect.h; y += 1) {
      for (let x = rect.x; x < rect.x + rect.w; x += 1) {
        this.screenBuffer[this._getScreenBufferIndex(x, y - linesToScroll)] =
          this.screenBuffer[this._getScreenBufferIndex(x, y)];
      }
    }

    // clear new lines
    for (let y = rect.y + rect.h - linesToScroll; y < rect.y + rect.h; y += 1) {
      for (let x = rect.x; x < rect.x + rect.w; x += 1) {
        this.screenBuffer[this._getScreenBufferIndex(x, y)] = {
          character: " ",
          attributes: { ...attributes },
        };
      }
    }

    const copyRect = {
      x: rect.x * this.characterWidth,
      y: (rect.y + linesToScroll) * this.characterHeight,
      w: rect.w * this.characterWidth,
      h: (rect.h - linesToScroll) * this.characterHeight,
    };
    const copyRectTo = {
      x: rect.x * this.characterWidth,
      y: rect.y * this.characterHeight,
      w: rect.w * this.characterWidth,
      h: (rect.h - linesToScroll) * this.characterHeight,
    };
    const clearRect = {
      x: rect.x * this.characterWidth,
      y: (rect.y + rect.h - linesToScroll) * this.characterHeight,
      w: rect.w * this.characterWidth,
      h: linesToScroll * this.characterHeight,
    };

    this.scrollCanvases(copyRect, copyRectTo, clearRect, attributes);
  }

  scrollDown(
    linesToScroll: number,
    attributes: ScreenCharacterAttributes = this.currentAttributes
  ) {
    this.scrollDownRect(
      {
        x: 0,
        y: 0,
        w: this.widthInCharacters,
        h: this.heightInCharacters,
      },
      linesToScroll,
      attributes
    );
  }

  scrollDownRect(
    rect: Rect,
    linesToScroll: number,
    attributes: ScreenCharacterAttributes = this.currentAttributes
  ) {
    // scroll screen buffer
    for (let y = rect.y + rect.h - 1; y >= rect.y + linesToScroll; y -= 1) {
      for (let x = rect.x; x < rect.x + rect.w; x += 1) {
        this.screenBuffer[this._getScreenBufferIndex(x, y)] =
          this.screenBuffer[this._getScreenBufferIndex(x, y - linesToScroll)];
      }
    }

    // clear new lines
    for (let y = rect.y; y < rect.y + linesToScroll; y += 1) {
      for (let x = rect.x; x < rect.x + rect.w; x += 1) {
        this.screenBuffer[this._getScreenBufferIndex(x, y)] = {
          character: " ",
          attributes: { ...attributes },
        };
      }
    }

    const copyRect = {
      x: rect.x * this.characterWidth,
      y: rect.y * this.characterHeight,
      w: rect.w * this.characterWidth,
      h: (rect.h - linesToScroll) * this.characterHeight,
    };
    const copyRectTo = {
      x: rect.x * this.characterWidth,
      y: (rect.y + linesToScroll) * this.characterHeight,
      w: rect.w * this.characterWidth,
      h: (rect.h - linesToScroll) * this.characterHeight,
    };
    const clearRect = {
      x: rect.x * this.characterWidth,
      y: rect.y * this.characterHeight,
      w: rect.w * this.characterWidth,
      h: linesToScroll * this.characterHeight,
    };

    this.scrollCanvases(copyRect, copyRectTo, clearRect, attributes);
  }

  /*================================ IMAGES ====================================*/

  drawImageAt(image: CanvasImageSource, dx: number, dy: number) {
    while (dx < 0) {
      dx += this.widthInPixels;
    }
    while (dy < 0) {
      dy += this.heightInPixels;
    }

    this.graphicsCtx.drawImage(image, dx, dy);
  }

  /*================================ DEMO STUFF ================================*/

  _printColorDemo() {
    const daskish: Array<keyof typeof CGA_PALETTE_DICT> = [
      CgaColors.Black,
      CgaColors.Red,
      CgaColors.Green,
      CgaColors.Blue,
      CgaColors.Yellow,
      CgaColors.Cyan,
      CgaColors.Magenta,
      CgaColors.Orange,
      CgaColors.Chartreuse,
      CgaColors.SpringGreen,
      CgaColors.Azure,
      CgaColors.Violet,
      CgaColors.Rose,
      CgaColors.LightGray,
    ];

    const lightish: Array<keyof typeof CGA_PALETTE_DICT> = [
      CgaColors.DarkGray,
      CgaColors.LightRed,
      CgaColors.LightGreen,
      CgaColors.LightBlue,
      CgaColors.LightYellow,
      CgaColors.LightCyan,
      CgaColors.LightMagenta,
      CgaColors.LightOrange,
      CgaColors.LightChartreuse,
      CgaColors.LightSpringGreen,
      CgaColors.LightAzure,
      CgaColors.LightViolet,
      CgaColors.LightRose,
      CgaColors.White,
    ];

    for (const c of daskish) {
      this.currentAttributes.bgColor = CGA_PALETTE_DICT[c];
      this.currentAttributes.fgColor = CGA_PALETTE_DICT["white"];
      this.printChar(`☺︎`);
    }
    this.printString(`\n`);

    for (const c of lightish) {
      this.currentAttributes.bgColor = CGA_PALETTE_DICT[c];
      this.currentAttributes.fgColor = CGA_PALETTE_DICT["black"];
      this.printChar(`☺︎`);
    }
    this.printString(`\n`);
  }

  _printBoxDrawingDemo() {
    this.currentAttributes.bgColor = CGA_PALETTE_DICT["black"];
    this.currentAttributes.fgColor = CGA_PALETTE_DICT["lightGray"];
    this.printString("╔═══════╗\n");
    this.printString("╙───────╫\n");
    this.printString("   ╟────╜\n");
  }

  drawSomeText() {
    this.currentAttributes.bgColor = CGA_PALETTE_DICT["black"];
    this.currentAttributes.fgColor = CGA_PALETTE_DICT["lightGray"];
    this.printString("C:\\>\n");

    this.printString("Hello ");

    this.currentAttributes.bgColor = "blue";
    this.currentAttributes.fgColor = "green";
    this.printString("World!\n");

    this._printColorDemo();

    this._printBoxDrawingDemo();
  }
}
