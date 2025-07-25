import { Std } from "../Std";
import { clamp } from "../Toolbox/Math";
import { splitStringIntoCharacters } from "../Toolbox/String";
import { isNil } from "../Toolbox/typescript";
import { Executable } from "./FileSystem";
import { PC } from "./PC";
import _ from "lodash";

const SEPARATOR = ",";

// ========================= Tokenizer =========================

enum TokenType {
  LineNumber,
  Separator,
  Command,
  String,
}

type Token =
  | {
      type: TokenType.String;
      value: string;
    }
  | {
      type: TokenType.LineNumber;
      value: string;
    }
  | {
      type: TokenType.Separator;
    }
  | {
      type: TokenType.Command;
      value: string;
    };

const getStringFromToken = (token: Token) => {
  switch (token.type) {
    case TokenType.Command:
      return `command(${token.value})`;
    case TokenType.Separator:
      return `separator`;
    case TokenType.LineNumber:
      return `lineNumber(${token.value})`;
    case TokenType.String:
      return `string("${token.value}")`;
  }
  return "unknown";
};

const isNumeric = (char: string) => {
  return char >= "0" && char <= "9";
};

class CommandTokenizer {
  private input: string[];

  constructor(input: string) {
    this.input = splitStringIntoCharacters(input);
  }

  tokenize(): Token[] {
    const result: Token[] = [];

    while (this.getHasCharacters()) {
      this.skipWhitespace();

      if (!this.getHasCharacters()) {
        break;
      }

      const nextChar = this.peekCharacter();

      if (isNumeric(nextChar)) {
        const number = this.takeNumber();
        if (number === null) {
          throw new Error("Invalid number.");
        }
        result.push({
          type: TokenType.LineNumber,
          value: number,
        });
        continue;
      } else if (nextChar === ".") {
        this.takeCurrentLine();
        result.push({
          type: TokenType.LineNumber,
          value: "current",
        });
      } else if (nextChar === SEPARATOR) {
        this.takeSeparator();
        result.push({
          type: TokenType.Separator,
        });
      } else if (nextChar === '"') {
        const string = this.takeString();
        if (string === null) {
          throw new Error("Invalid string.");
        }
        result.push({
          type: TokenType.String,
          value: string,
        });
      } else {
        const command = this.takeCommand();
        if (command === null) {
          throw new Error("Invalid command.");
        }
        result.push({
          type: TokenType.Command,
          value: command,
        });
      }
    }

    return result;
  }

  private shiftCharacter() {
    return this.input.shift();
  }

  private peekCharacter() {
    return this.input[0];
  }

  private getHasCharacters() {
    return this.input.length > 0;
  }

  private skipWhitespace() {
    while (this.getHasCharacters() && this.peekCharacter() === " ") {
      this.input.shift();
    }
  }

  private takeNumber(): string | null {
    const result: string[] = [];

    while (this.getHasCharacters() && isNumeric(this.peekCharacter())) {
      result.push(this.shiftCharacter()!);
    }

    if (result.length === 0) {
      return null;
    }

    return result.join("");
  }

  private takeString(): string | null {
    const result: string[] = [];

    if (this.peekCharacter() !== '"') {
      return null;
    }

    this.shiftCharacter();

    let isEscape = false;

    while (this.getHasCharacters()) {
      const nextChar = this.peekCharacter();

      if (nextChar === "\\") {
        this.shiftCharacter();
        isEscape = true;
        continue;
      }

      if (nextChar === '"') {
        if (isEscape) {
          result.push(this.shiftCharacter()!);
          isEscape = false;
          continue;
        }

        this.shiftCharacter()!;
        break;
      }

      result.push(this.shiftCharacter()!);
    }

    return result.join("");
  }

  private takeCommand(): string | null {
    const nextChar = this.peekCharacter();
    if (
      (nextChar >= "a" && nextChar <= "z") ||
      (nextChar >= "A" && nextChar <= "Z") ||
      nextChar === "?"
    ) {
      return this.shiftCharacter()!;
    }
    return null;
  }

  private takeSeparator(): string | null {
    const nextChar = this.peekCharacter();
    if (nextChar === SEPARATOR) {
      return this.shiftCharacter()!;
    }
    return null;
  }

  private takeCurrentLine(): string | null {
    const nextChar = this.peekCharacter();
    if (nextChar === ".") {
      return this.shiftCharacter()!;
    }
    return null;
  }
}

// ========================= End tokenizer =========================

// ========================= Command parser =========================

enum CommandType {
  Help,
  Insert,
  List,
  EditLine,
  Page,
  NoOp,
  Delete,
}

type CommandHelp = {
  type: CommandType.Help;
};

type CommandInsert = {
  type: CommandType.Insert;
  atLine: number;
};

type CommandList = {
  type: CommandType.List;
  fromLine: number;
  toLine: number;
};

type CommandEditLine = {
  type: CommandType.EditLine;
  atLine: number;
  shouldAdvanceLine: boolean;
};

type CommandPage = {
  type: CommandType.Page;
  fromLine: number;
  toLine: number;
  newCurrentLine: number;
};

type CommandNoop = { type: CommandType.NoOp };

type CommandDelete = {
  type: CommandType.Delete;
  fromLine: number;
  toLine: number;
};

type Command =
  | CommandHelp
  | CommandInsert
  | CommandList
  | CommandEditLine
  | CommandPage
  | CommandNoop
  | CommandDelete;

interface CommandParserContext {
  totalLines: number;
  currentLine: number;
  screenHeight: number;
}

class CommandParser {
  totalLines: number = 0;
  currentLine: number = 0;
  screenHeight: number = 0;

  constructor() {}

  private lineNumberToIndex(lineNumber: string) {
    if (lineNumber === "current") {
      return this.currentLine;
    }

    let result = Number(lineNumber) - 1;

    if (result !== Math.floor(result) || result < 0) {
      throw new Error("Invalid line number");
    }

    return result;
  }

  private getViewCenteredAround(lineNumber: number) {
    let windowHeight = this.screenHeight - 1;

    let pivot = (windowHeight - 1) / 2;

    let linesBefore = Math.floor(pivot);
    let linesAfter = Math.ceil(pivot);

    let fromLine = lineNumber - linesBefore;
    let toLine = lineNumber + linesAfter;

    let startOverflow = Math.max(0, 0 - fromLine);
    let endOverflow = Math.max(0, toLine - (this.totalLines - 1));

    fromLine -= endOverflow;
    toLine += startOverflow;

    fromLine = Math.max(fromLine, 0);
    toLine = Math.min(toLine, this.totalLines - 1);

    return [fromLine, toLine];
  }

  private parseHelp(): CommandHelp {
    return { type: CommandType.Help };
  }

  private parseInsert(lineNumbers: (number | null)[]): CommandInsert {
    let atLine = 0;

    if (lineNumbers.length === 0) {
      atLine = this.currentLine;
    } else if (lineNumbers.length === 1) {
      if (isNil(lineNumbers[0])) {
        atLine = this.currentLine;
      } else {
        atLine = lineNumbers[0];
      }
    }

    if (lineNumbers.length > 1) {
      throw new Error("Too many arguments");
    }

    return {
      type: CommandType.Insert,
      atLine,
    };
  }

  private parseList(lineNumbers: (number | null)[]): CommandList | CommandNoop {
    let windowHeight = this.screenHeight - 1;

    if (lineNumbers.length === 0) {
      const [from, to] = this.getViewCenteredAround(this.currentLine);
      return {
        type: CommandType.List,
        fromLine: from,
        toLine: to,
      };
    }

    let fromLine = lineNumbers[0];

    if (lineNumbers.length === 1) {
      if (isNil(fromLine)) {
        throw new Error("Entry error");
      }

      if (fromLine >= this.totalLines) {
        return {
          type: CommandType.NoOp,
        };
      }

      const [from, to] = this.getViewCenteredAround(fromLine);
      return {
        type: CommandType.List,
        fromLine: from,
        toLine: to,
      };
    }

    let toLine = lineNumbers[1];

    if (lineNumbers.length === 2) {
      if (isNil(fromLine) && isNil(toLine)) {
        const [from, to] = this.getViewCenteredAround(this.currentLine);
        return {
          type: CommandType.List,
          fromLine: from,
          toLine: to,
        };
      } else if (isNil(fromLine) && !isNil(toLine)) {
        return {
          type: CommandType.List,
          fromLine: 0,
          toLine: toLine,
        };
      } else if (!isNil(fromLine) && isNil(toLine)) {
        if (fromLine >= this.totalLines) {
          return {
            type: CommandType.NoOp,
          };
        }

        return {
          type: CommandType.List,
          fromLine: fromLine,
          toLine: Math.min(fromLine + windowHeight - 1, this.totalLines - 1),
        };
      } else if (!isNil(fromLine) && !isNil(toLine)) {
        if (fromLine >= this.totalLines) {
          return {
            type: CommandType.NoOp,
          };
        }

        if (toLine < fromLine) {
          throw new Error("Entry error");
        }

        return {
          type: CommandType.List,
          fromLine: fromLine,
          toLine: Math.min(toLine, this.totalLines - 1),
        };
      }
    }

    if (lineNumbers.length > 2) {
      throw new Error("Too many arguments");
    }

    throw new Error("Unreachable");
  }

  private parsePage(lineNumbers: (number | null)[]): CommandPage | CommandNoop {
    let windowHeight = this.screenHeight - 1;

    if (lineNumbers.length === 0) {
      if (this.currentLine >= this.totalLines - 1) {
        return { type: CommandType.NoOp };
      }

      let fromLine = this.currentLine === 0 ? 0 : this.currentLine + 1;

      return {
        type: CommandType.Page,
        fromLine: fromLine,
        toLine: Math.min(fromLine + (windowHeight - 1), this.totalLines - 1),
        newCurrentLine: Math.min(
          fromLine + (windowHeight - 1),
          this.totalLines - 1,
        ),
      };
    }

    let fromLine = lineNumbers[0];

    if (lineNumbers.length === 1) {
      if (isNil(fromLine)) {
        throw new Error("Entry error");
      }

      if (fromLine >= this.totalLines) {
        return { type: CommandType.NoOp };
      }

      return {
        type: CommandType.Page,
        fromLine: fromLine,
        toLine: Math.min(fromLine + (windowHeight - 1), this.totalLines - 1),
        newCurrentLine: Math.min(
          fromLine + (windowHeight - 1),
          this.totalLines - 1,
        ),
      };
    }

    if (lineNumbers.length > 1) {
      throw new Error("Entry error");
    }

    throw new Error("Unreachable");
  }

  private parseDelete(
    lineNumbers: (number | null)[],
  ): CommandDelete | CommandNoop {
    if (lineNumbers.length === 0) {
      return {
        type: CommandType.Delete,
        fromLine: this.currentLine,
        toLine: this.currentLine,
      };
    }

    let fromLine = lineNumbers[0];

    if (lineNumbers.length === 1) {
      if (isNil(fromLine)) {
        throw new Error("Entry error");
      }

      return {
        type: CommandType.Delete,
        fromLine: fromLine,
        toLine: fromLine,
      };
    }

    let toLine = lineNumbers[1];

    if (lineNumbers.length === 2) {
      fromLine = fromLine ?? 0;
      toLine = toLine ?? this.totalLines - 1;

      if (toLine < fromLine) {
        throw new Error("Entry error");
      }

      return {
        type: CommandType.Delete,
        fromLine,
        toLine,
      };
    }

    if (lineNumbers.length > 2) {
      throw new Error("Entry error");
    }

    throw new Error("Unreachable");
  }

  /** Returns next command or throws. Modifies the passed in tokens array. */
  getNextCommand(tokens: Token[]): Command | null {
    const lineNumbers: (number | null)[] = [];

    let numberAdded = false;
    let lastIsSeparator = false;
    while (tokens.length > 0) {
      const nextToken = tokens[0];
      if (nextToken.type === TokenType.LineNumber) {
        let value = this.lineNumberToIndex(nextToken.value);
        lastIsSeparator = false;
        lineNumbers.push(value);
        numberAdded = true;
        tokens.shift();
        continue;
      } else if (nextToken.type === TokenType.Separator) {
        lastIsSeparator = true;
        if (!numberAdded) {
          lineNumbers.push(null);
        }
        numberAdded = false;
        tokens.shift();
        continue;
      }
      break;
    }
    if (lastIsSeparator) {
      lineNumbers.push(null);
    }

    const commandToken = tokens[0];
    if (!commandToken) {
      if (lineNumbers.length > 1) {
        throw new Error("Entry error.");
      }

      return {
        type: CommandType.EditLine,
        atLine: Math.min(lineNumbers[0] ?? this.currentLine, this.totalLines),
        shouldAdvanceLine: isNil(lineNumbers[0]),
      };
    }
    if (commandToken.type !== TokenType.Command) {
      throw new Error(`Unexpected token: ${getStringFromToken(tokens[0])}`);
    }
    tokens.shift();
    const command = commandToken.value.toLowerCase();

    switch (command) {
      case "?": {
        return this.parseHelp();
      }
      case "i": {
        return this.parseInsert(lineNumbers);
      }
      case "l": {
        return this.parseList(lineNumbers);
      }
      case "p": {
        return this.parsePage(lineNumbers);
      }
      case "d": {
        return this.parseDelete(lineNumbers);
      }
    }

    return null;
  }

  updateContext({
    totalLines,
    currentLine,
    screenHeight,
  }: CommandParserContext) {
    this.totalLines = totalLines;
    this.currentLine = currentLine;
    this.screenHeight = screenHeight;
  }
}

// ========================= End command parser =========================

export class Pedlin implements Executable {
  private pc: PC;
  private std: Std;

  private lines: string[];
  private currentLine: number;

  constructor(pc: PC) {
    this.pc = pc;
    this.std = pc.std;

    this.lines = [];
    this.currentLine = 0;
  }

  async run(args: string[]) {
    const { std } = this;

    this.pc.std.writeConsole("New file\n");
    while (true) {
      try {
        await this.readCommand();
      } catch (e: any) {
        std.writeConsole(e.message);
        std.writeConsole("\n");
      }
    }
  }

  private printLineNumber(number: number) {
    const { std } = this;

    let indicator = " ";
    if (number === this.currentLine) {
      indicator = "*";
    }
    std.writeConsole(`${_.padStart(String(number + 1), 8)}:${indicator}`);
  }

  private async insert() {
    const { std } = this;

    if (this.currentLine < this.lines.length) {
      this.printLineNumber(this.currentLine);
      std.writeConsole(`${this.lines[this.currentLine] ?? ""}\n`);
    }

    while (true) {
      this.printLineNumber(this.currentLine);
      const newLine = await std.readConsoleLine();
      if (newLine === null) {
        std.writeConsole("\n\n");
        break;
      }
      this.lines.splice(this.currentLine, 0, newLine);
      this.currentLine += 1;
    }
  }

  /** List lines at indexes, inclusive. */
  private async list(start: number, end: number) {
    const { std } = this;

    if (start < 0 || start > end) {
      throw new Error("Invalid range provided.");
    }

    for (let i = start; i <= this.lines.length - 1 && i <= end; i += 1) {
      this.printLineNumber(i);

      std.writeConsole(this.lines[i]);
      std.writeConsole("\n");
    }
  }

  private async editLine(atLine: number, shouldAdvanceLine: boolean) {
    const { std } = this;

    this.currentLine = atLine;

    if (shouldAdvanceLine) {
      this.currentLine = Math.min(this.lines.length, this.currentLine + 1);
    }

    if (this.currentLine === this.lines.length) {
      return;
    }

    this.printLineNumber(this.currentLine);
    std.writeConsole(`${this.lines[this.currentLine] ?? ""}\n`);

    this.printLineNumber(this.currentLine);
    const newLine = await std.readConsoleLine();
    if (newLine === null) {
      std.writeConsole("\n\n");
    } else {
      if (newLine.length > 0) {
        this.lines[this.currentLine] = newLine;
      }
    }
  }

  /** List lines and move current line to end of range. */
  private page(fromLine: number, toLine: number) {
    const { std } = this;

    for (let i = fromLine; i <= this.lines.length - 1 && i <= toLine; i += 1) {
      this.printLineNumber(i);

      std.writeConsole(this.lines[i]);
      std.writeConsole("\n");
    }
  }

  private deleteLines(fromLine: number, toLine: number) {
    this.lines.splice(fromLine, toLine - fromLine + 1);
  }

  private writeHelp() {
    const { std } = this;

    const entries = [
      ["Edit line", "line#"],
      ["Append", "[#lines]A"],
      ["Copy", "[startline],[endline],toline[,times]C"],
      ["Delete", "[startline][,endline]D"],
      ["End (save file)", "E"],
      ["Insert", "[line]I"],
      ["List", "[startline][,endline]L"],
      ["Move", "[startline],[endline],tolineM"],
      ["Page", "[startline][,endline]P"],
      ["Quit (throw away changes)", "Q"],
      ["Replace", '[startline][,endline][?]R["oldtext"]["newtext"]'],
      ["Search", '[startline][,endline][?]S"text"'],
      ["Write", "[#lines]W"],
    ];

    const maxNameLength = entries.reduce(
      (acc, e) => (acc = Math.max(acc, e[0].length)),
      0,
    );

    for (const entry of entries) {
      std.writeConsole(_.padEnd(entry[0], maxNameLength));
      std.writeConsole("   ");
      std.writeConsole(entry[1]);
      std.writeConsole("\n");
    }
  }

  async readCommand() {
    const { std } = this;

    std.writeConsole("*");
    const input = await std.readConsoleLine();
    if (isNil(input)) {
      return;
    }

    const t = new CommandTokenizer(input ?? "");
    const tokens = t.tokenize();

    const p = new CommandParser();
    while (true) {
      p.updateContext({
        totalLines: this.lines.length,
        currentLine: this.currentLine,
        screenHeight: std.getConsoleSize().h,
      });
      const command = p.getNextCommand(tokens);

      switch (command?.type) {
        case CommandType.List:
          this.list(command.fromLine, command.toLine);
          break;
        case CommandType.Insert:
          this.currentLine = command.atLine;
          await this.insert();
          break;
        case CommandType.Help:
          this.writeHelp();
          break;
        case CommandType.EditLine:
          await this.editLine(command.atLine, command.shouldAdvanceLine);
          break;
        case CommandType.Page:
          this.currentLine = command.newCurrentLine;
          this.page(command.fromLine, command.toLine);
          break;
        case CommandType.Delete:
          this.currentLine = command.fromLine;
          this.deleteLines(command.fromLine, command.toLine);
          break;
      }

      if (tokens.length === 0 || !command) {
        break;
      }
    }
  }
}
