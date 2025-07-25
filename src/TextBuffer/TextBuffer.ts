import { classicColors } from "../Color/ansi";
import { Color, ColorType } from "../Color/Color";
import { getIsPrintable } from "../Screen/getIsPrintable";
import { RingBuffer } from "../Toolbox/RingBuffer";
import { splitStringIntoCharacters } from "../Toolbox/String";
import { Vector } from "../Toolbox/Vector";
import { getIsVectorInZeroAlignedRect, Size } from "../types";
import { BOXED_NO_BOX } from "./constants";

export interface CellAttributes {
  fgColor: Color;
  bgColor: Color;
  blink: boolean;
  bold: boolean;
  reverseVideo: boolean;
  underline: boolean;
  halfBright: boolean;
  /** A bitfield for the character being boxed. */
  boxed: number;
}

const cloneCellAttributes = (attr: CellAttributes): CellAttributes => {
  return {
    fgColor: attr.fgColor,
    bgColor: attr.bgColor,
    blink: attr.blink,
    bold: attr.bold,
    reverseVideo: attr.reverseVideo,
    underline: attr.underline,
    halfBright: attr.halfBright,
    boxed: attr.boxed,
  };
};

const DEFAULT_ATTRIBUTES: CellAttributes = {
  fgColor: classicColors[7],
  bgColor: classicColors[0],
  blink: false,
  bold: false,
  reverseVideo: false,
  underline: false,
  halfBright: false,
  boxed: BOXED_NO_BOX,
};

class Cell {
  private attributes: CellAttributes;
  public rune: string;

  public isDirty: boolean;

  constructor() {
    this.attributes = cloneCellAttributes(DEFAULT_ATTRIBUTES);
    this.rune = "\x00";

    this.isDirty = true;
  }

  public getAttributes() {
    return cloneCellAttributes(this.attributes);
  }

  public setAttributes(attr: CellAttributes) {
    this.attributes = attr;
    this.isDirty = true;
  }

  public updateAttributes(update: Partial<CellAttributes>) {
    this.attributes = { ...this.attributes, ...update };
  }

  public clone(): Cell {
    const c = new Cell();

    c.attributes = cloneCellAttributes(this.attributes);
    c.rune = this.rune;

    c.isDirty = true;

    return c;
  }
}

export class Line {
  public cells: Cell[];
  public isWrapped: boolean = false;

  constructor(width: number, attr: CellAttributes) {
    this.cells = new Array(width).fill(null).map(() => {
      const cell = new Cell();
      cell.setAttributes(cloneCellAttributes(attr));
      return cell;
    });
  }
}

export class Cursor {
  private x: number;
  private y: number;
  private isWrapPending: boolean;

  constructor() {
    this.x = 0;
    this.y = 0;
    this.isWrapPending = false;
  }

  public getPosition(): Vector {
    return {
      x: this.x,
      y: this.y,
    };
  }

  public setPosition(pos: Vector, opt: { isWrapPending?: boolean } = {}) {
    this.x = pos.x;
    this.y = pos.y;
    this.isWrapPending = opt.isWrapPending ?? false;
  }

  public getIsWrapPending() {
    return this.isWrapPending;
  }

  public setIsWrapPending(isWrapPending: boolean) {
    return (this.isWrapPending = isWrapPending);
  }

  public clone(): Cursor {
    const c = new Cursor();
    c.x = this.x;
    c.y = this.y;
    return c;
  }

  public getIsInPage(pageSize: Size): boolean {
    if (getIsVectorInZeroAlignedRect({ x: this.x, y: this.y }, pageSize)) {
      return false;
    }
    return true;
  }

  /** If cursor is outside of the page it is returned to the first available position. */
  public snapToPage(pageSize: Size): void {
    this.isWrapPending = false;
    if (this.x < 0) this.x = 0;
    if (this.x >= pageSize.w) this.x = pageSize.w - 1;
    if (this.y < 0) this.y = 0;
    if (this.y >= pageSize.h) this.y = pageSize.h - 1;
  }

  public wrapToBeInsidePage(pageSize: Size): void {
    this.isWrapPending = false;
    while (this.x < 0) {
      this.y -= 1;
      this.x += pageSize.w;
    }
    while (this.x >= pageSize.w) {
      this.y += 1;
      this.x -= pageSize.w;
    }
  }
}

interface Page {
  size: Size;
  lines: Line[];
  cursor: Cursor;
}

export class TextBuffer {
  private buffer: RingBuffer<Line>;
  private currentAttributes: CellAttributes;
  public cursor: Cursor;
  public topLine: number;
  private pageSize: Size;
  public isDirty: boolean;
  public bellRequested: boolean = false;
  private scrollbackLength: number;
  private linesScrolled: number = 0;

  constructor({
    pageSize,
    scrollbackLength = 0,
  }: {
    pageSize: Size;
    scrollbackLength?: number;
  }) {
    this.currentAttributes = cloneCellAttributes(DEFAULT_ATTRIBUTES);
    this.scrollbackLength = scrollbackLength;

    this.buffer = new RingBuffer<Line>(pageSize.h + this.scrollbackLength);
    this.pageSize = pageSize;
    this.isDirty = true;

    for (let i = 0; i < pageSize.h; i += 1) {
      this.buffer.push(new Line(pageSize.w, this.currentAttributes));
    }

    this.cursor = new Cursor();
    this.topLine = 0;
  }

  public getPageSize(): Size {
    return this.pageSize;
  }

  public setPageSize(pageSize: Size) {
    this.buffer = new RingBuffer<Line>(pageSize.h + this.scrollbackLength);
    this.pageSize = pageSize;
    this.isDirty = true;

    for (let i = 0; i < pageSize.h; i += 1) {
      this.buffer.push(new Line(pageSize.w, this.currentAttributes));
    }

    this.cursor = new Cursor();
    this.topLine = 0;
  }

  public getPage(offset: number): Page {
    if (offset > 0) {
      offset = 0;
    }
    let savedLines = Math.max(this.buffer.getLength() - this.pageSize.h);
    if (offset < -savedLines) {
      offset = -savedLines;
    }

    const cursor = this.cursor.clone();
    const cursorPosition = cursor.getPosition();
    cursorPosition.y -= offset;
    cursor.setPosition(cursorPosition);

    const lines = this.buffer.slice(-this.pageSize.h + offset, offset);
    for (const l of lines) {
      if (!l) {
        throw new Error("Empty line encountered when building Page.");
      }
    }

    return {
      size: this.pageSize,
      lines: lines as Line[],
      cursor: cursor,
    };
  }

  private stepCursorForward() {
    const page = this.getPage(0);
    const cursorPosition = this.cursor.getPosition();
    cursorPosition.x += 1;
    if (cursorPosition.x === page.size.w) {
      cursorPosition.x -= 1;
      this.cursor.setPosition(cursorPosition, { isWrapPending: true });
    } else {
      this.cursor.setPosition(cursorPosition);
    }
  }

  public printCharacter(character: string) {
    if (character === "\n") {
      this.lineFeed();
      this.carriageReturn();
      return;
    }

    if (!getIsPrintable(character)) {
      return;
    }

    if (this.cursor.getIsWrapPending()) {
      this.lineFeed();
      this.carriageReturn();
    }

    const page = this.getPage(0);

    const cursorPosition = this.cursor.getPosition();
    const cell = page.lines[cursorPosition.y]?.cells[cursorPosition.x];
    if (!cell) {
      throw new Error("Unable to get cell.");
    }
    cell.setAttributes(this.currentAttributes);
    cell.rune = character;
    cell.isDirty = true;

    this.stepCursorForward();

    this.topLine = 0;
  }

  public printString(string: string) {
    const chars = splitStringIntoCharacters(string);
    for (const ch of chars) {
      this.printCharacter(ch);
    }
  }

  public printAttributes(length: number = 1) {
    for (let i = 0; i < length; i += 1) {
      const page = this.getPage(0);
      const cursorPosition = this.cursor.getPosition();

      const cell = page.lines[cursorPosition.y]?.cells[cursorPosition.x];
      cell.setAttributes(this.currentAttributes);
      cell.isDirty = true;

      this.stepCursorForward();
    }
  }

  public bell() {
    this.bellRequested = true;
  }

  public backspace() {
    const curPos = this.cursor.getPosition();
    curPos.x -= 1;
    if (curPos.x < 0) {
      curPos.x = 0;
    }
    this.cursor.setPosition(curPos);
  }

  public lineFeed() {
    const curPos = this.cursor.getPosition();
    curPos.y += 1;
    if (curPos.y === this.pageSize.h) {
      curPos.y -= 1;
      this.scrollDownBy(1);
    }
    this.cursor.setPosition(curPos);
  }

  public carriageReturn() {
    const curPos = this.cursor.getPosition();
    curPos.x = 0;
    this.cursor.setPosition(curPos);
  }

  public getCurrentAttributes(): CellAttributes {
    return cloneCellAttributes(this.currentAttributes);
  }

  public setCurrentAttributes(attr: CellAttributes): void {
    this.currentAttributes = attr;
  }

  public updateCurrentAttributes(update: Partial<CellAttributes>) {
    const currentAttributes = this.getCurrentAttributes();
    this.setCurrentAttributes({ ...currentAttributes, ...update });
  }

  public resetCurrentAttributes() {
    this.currentAttributes = DEFAULT_ATTRIBUTES;
  }

  public scrollDownBy(numRows: number): void {
    for (let i = 0; i < numRows; i += 1) {
      this.buffer.push(new Line(this.pageSize.w, this.currentAttributes));
    }
    this.isDirty = true;
    this.linesScrolled += 1;
  }

  public scrollUpBy(numRows: number): void {
    for (let i = 0; i < numRows; i += 1) {
      this.buffer.insertAtWithDiscard(
        -(this.pageSize.h - 1),
        new Line(this.pageSize.w, this.currentAttributes),
      );
    }
    this.isDirty = true;
    this.linesScrolled -= 1;
  }

  public eraseDown() {
    const curPos = this.cursor.getPosition();
    const page = this.getPage(0);
    const currentAttributes = this.getCurrentAttributes();

    for (let x = curPos.x; x < page.size.w; x += 1) {
      const cell = page.lines[curPos.y].cells[x];
      cell.rune = " ";
      cell.setAttributes(currentAttributes);
      cell.isDirty = true;
    }
    for (let y = curPos.y + 1; y < page.size.h; y += 1) {
      for (let x = 0; x < page.size.w; x += 1) {
        const cell = page.lines[y].cells[x];
        cell.rune = " ";
        cell.setAttributes(currentAttributes);
        cell.isDirty = true;
      }
    }
  }

  public eraseUp() {
    const curPos = this.cursor.getPosition();
    const page = this.getPage(0);
    const currentAttributes = this.getCurrentAttributes();

    for (let y = 0; y < curPos.y; y += 1) {
      for (let x = 0; x < page.size.w; x += 1) {
        const cell = page.lines[y].cells[x];
        cell.rune = " ";
        cell.setAttributes(currentAttributes);
        cell.isDirty = true;
      }
    }
    for (let x = 0; x <= curPos.x; x += 1) {
      const cell = page.lines[curPos.y].cells[x];
      cell.rune = " ";
      cell.setAttributes(currentAttributes);
      cell.isDirty = true;
    }
  }

  public eraseScreen() {
    const page = this.getPage(0);
    const currentAttributes = this.getCurrentAttributes();

    for (let y = 0; y < page.size.h; y += 1) {
      for (let x = 0; x < page.size.w; x += 1) {
        const cell = page.lines[y].cells[x];
        cell.rune = " ";
        cell.setAttributes(currentAttributes);
        cell.isDirty = true;
      }
    }

    this.isDirty = true;
    this.linesScrolled = 0;
  }
}
