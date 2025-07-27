/**
 * Author: Strawberry / nashiora@github / echoephile@github
 * Description: Implements the
 */

import {
  PATH_SEPARATOR,
  DriveLabel,
  isDriveLabel,
  Executable,
  FilePath,
  FileSystemObjectType,
  FileSystem,
  FloppyStorage,
  FloppySerialized,
} from "./FileSystem";

import { PC } from "./PC";

import { argparse } from "../Toolbox/argparse";
import { classicColors } from "../Color/ansi";

import _ from "lodash";

interface TakenProgram {
  path: FilePath;
  name: string;
}

export enum ShellTokenKind {
  Word = "word",
  Operator = "operator",
}

export enum ShellTokenMetaKind {
  None = "none",
}

export type ShellTokenMeta = {
  kind: ShellTokenMetaKind.None;
};

export interface ShellToken {
  start: number;
  end: number;
  kind: ShellTokenKind;
  meta: ShellTokenMeta;
  text: string;
}

export enum ShellCommandKind {
  Simple = "simple",
  Group = "group",
  Pipeline = "pipeline",
  List = "list",
  Function = "function",
}

export interface ShellSimpleCommand {
  kind: ShellCommandKind.Simple;
  command: string;
  arguments: string[];
}

export interface ShellGroupCommand {
  kind: ShellCommandKind.Group;
  commands: ShellCommandList;
  useSubprocess: boolean;
}

export interface ShellPipelineCommand {
  kind: ShellCommandKind.Pipeline;
  commands: (ShellSimpleCommand | ShellGroupCommand)[];
}

export interface ShellCommandList {
  kind: ShellCommandKind.List;
  commands: (ShellSimpleCommand | ShellGroupCommand | ShellPipelineCommand)[];
}

export interface ShellFunction {
  kind: ShellCommandKind.Function;
  name: string;
  parameterAliases: string[];
  body: ShellGroupCommand;
  // TODO(local): redirections?
}

export type ShellCommand =
  | ShellSimpleCommand
  | ShellGroupCommand
  | ShellPipelineCommand
  | ShellCommandList
  | ShellFunction;

const metaCharacters = [
  "(",
  ")",
  "[",
  "]",
  "{",
  "}",
  "$",
  "&",
  "*",
  "|",
  "<",
  ">",
  ";",
  "?",
];

const shellParameterCharacters = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "_",
];

function readShellCharacter(
  commandText: string,
  index: number,
): { character: string; nextIndex: number; isEscape: boolean } | null {
  if (index < 0 || index >= commandText.length) {
    return null;
  }

  const currentChar = commandText[index];
  if (index < commandText.length - 1 && currentChar === "\\") {
    const nextChar = commandText[index + 1];
    if (nextChar === '"') {
      return { character: '"', nextIndex: index + 2, isEscape: true };
    } else if (nextChar === " ") {
      return { character: " ", nextIndex: index + 2, isEscape: true };
    } else if (nextChar === "\\") {
      return { character: "\\", nextIndex: index + 2, isEscape: true };
    } else if (nextChar === "\n") {
      const peekChar = readShellCharacter(commandText, index + 2);
      if (peekChar === null) {
        return null;
      }

      peekChar.nextIndex += 2;
      return peekChar;
    } else if (isShellMetaCharacter(nextChar)) {
      return { character: nextChar, nextIndex: index + 2, isEscape: true };
    }
  }

  return {
    character: currentChar,
    nextIndex: index + 1,
    isEscape: false,
  };
}

export function isShellWhiteSpaceCharacter(character: string) {
  return character === " " || character === "\t";
}

export function isShellMetaCharacter(character: string) {
  return metaCharacters.indexOf(character) >= 0;
}

function isValidShellWordCharacter(char: string) {
  if (isShellWhiteSpaceCharacter(char)) {
    return false;
  }

  return !isShellMetaCharacter(char) || ["*", "?", "[", "]"].indexOf(char) >= 0;
}

export function readShellToken(
  commandText: string,
  index: number,
): ShellToken | null {
  let startIndex = index;
  let endIndex = index;

  let tokenKind = ShellTokenKind.Word;
  let tokenMeta = { kind: ShellTokenMetaKind.None };
  let tokenText = "";

  while (
    startIndex < commandText.length &&
    isShellWhiteSpaceCharacter(commandText[startIndex])
  ) {
    startIndex += 1;
  }

  endIndex = startIndex;
  if (endIndex === commandText.length) {
    return null;
  }

  if (commandText[endIndex] === '"') {
    endIndex += 1;

    let char = readShellCharacter(commandText, endIndex);
    while (
      char &&
      (char.character !== '"' || char.isEscape) &&
      char.character !== "\n"
    ) {
      tokenText += char.character;
      endIndex = char.nextIndex;
      char = readShellCharacter(commandText, endIndex);
    }

    // if we stopped reading the quoted word without being at the commandText's end, this will consume the quote which stopped us reading it.
    endIndex = Math.min(endIndex + 1, commandText.length);
  } else {
    const c = commandText[endIndex];
    const nc = commandText[endIndex + 1];

    const readWord = () => {
      let char = readShellCharacter(commandText, endIndex);
      while (
        char &&
        (char.isEscape ||
          isValidShellWordCharacter(char.character) ||
          (tokenText.length === 0 && char.character === "$")) &&
        char.character !== "\n"
      ) {
        tokenText += char.character;
        endIndex = char.nextIndex;
        char = readShellCharacter(commandText, endIndex);
      }
    };

    if (c === "\n") {
      tokenKind = ShellTokenKind.Operator;
      tokenText = "\n";
      endIndex = endIndex + 1;
    } else if (c === "$" && nc === "(") {
      tokenKind = ShellTokenKind.Operator;
      tokenText = "$(";
      endIndex = endIndex + 2;
    } else if (c === "$" && shellParameterCharacters.indexOf(nc) >= 0) {
      tokenKind = ShellTokenKind.Operator;
      tokenText = "$" + nc;
      endIndex = endIndex + 2;
    } else if (c === "$" && isValidShellWordCharacter(nc)) {
      readWord();
    } else if (c === ">" && nc === ">") {
      tokenKind = ShellTokenKind.Operator;
      tokenText = ">>";
      endIndex = endIndex + 2;
    } else if (!isValidShellWordCharacter(c) && isShellMetaCharacter(c)) {
      tokenKind = ShellTokenKind.Operator;
      tokenText = c;
      endIndex = endIndex + 1;
    } else {
      readWord();
    }
  }

  return {
    start: startIndex,
    end: endIndex,
    kind: tokenKind,
    meta: tokenMeta,
    text: tokenText,
  };
}

export function readShellTokens(commandText: string): ShellToken[] {
  let i = 0;
  let args = [];
  let token = readShellToken(commandText, i);
  while (token !== null) {
    args.push(token);
    i = token.end;
    token = readShellToken(commandText, i);
  }
  return args;
}

export function parseShellCommand(
  tokens: ShellToken[],
  index: number,
): { nextIndex: number; command: ShellCommand | null } {
  if (index < 0 || index >= tokens.length) {
    return { nextIndex: index, command: null };
  }

  const atEnd = () => {
    return index >= tokens.length;
  };

  const peekToken = (ahead: number): ShellToken | null => {
    if (ahead < 0 || ahead + index >= tokens.length) {
      return null;
    }

    return tokens[index + ahead];
  };

  const eatToken = (): ShellToken => {
    if (index < 0 || index >= tokens.length) {
      throw new Error(
        "Should never call eatToken if you haven't checked one exists first.",
      );
    }

    const token = tokens[index];
    index += 1;
    return token;
  };

  const checkOperator = (ahead: number, text: string): boolean => {
    const token = peekToken(ahead);
    return (
      token !== null &&
      token.kind === ShellTokenKind.Operator &&
      token.text === text
    );
  };

  const parseSimpleCommand = (): ShellSimpleCommand | null => {
    let words: string[] = [];
    while (!atEnd() && peekToken(0)!.kind === ShellTokenKind.Word) {
      words.push(eatToken().text);
    }

    if (words.length === 0) {
      return null;
    }

    let [commandWord, ...argumentWords] = words;
    return {
      kind: ShellCommandKind.Simple,
      command: commandWord,
      arguments: argumentWords,
    };
  };

  const simpleCommand = parseSimpleCommand();
  if (simpleCommand === null) {
    throw new Error("Expected a shell command");
  }

  return {
    nextIndex: index,
    command: simpleCommand,
  };
}

export class PengerShell implements Executable {
  private pc: PC;

  private isRunning: boolean = false;

  private workingDirectories: { [id: string]: FilePath } = {};
  private currentDrive: DriveLabel = "C";
  private currentPath: string[] = [];
  private prompt: string = "%P>";

  private suppressNextPromptNewline: boolean = false;
  private takenPrograms: Array<TakenProgram> = [];

  private autorun: Array<string>;

  constructor(pc: PC) {
    this.pc = pc;

    const searchParams = new URLSearchParams(window.location.search);
    const autorunString = searchParams.get("autorun");
    if (autorunString) {
      this.autorun = autorunString.split("/");
    } else {
      this.autorun = [];
    }
  }

  private get workingDirectory(): FilePath {
    let wd = this.workingDirectories[this.currentDrive];
    if (!wd) {
      this.workingDirectories[this.currentDrive] = wd = FilePath.tryParse(
        `${this.currentDrive}:/`,
      )!;
    }
    return wd;
  }

  private set workingDirectory(wd: FilePath) {
    const drive = wd.drive ?? "C";
    this.currentDrive = drive;
    this.workingDirectories[drive] = wd;
  }

  private shiftAutorunCommand() {
    const { std } = this.pc;
    if (this.autorun.length > 1) {
      const command = `go ${this.autorun.shift()}`;
      std.writeConsole(`${command}\n`);
      return command;
    }

    if (this.autorun.length === 1) {
      const command = `run ${this.autorun.shift()}`;
      std.writeConsole(`${command}\n`);
      return command;
    }

    return undefined;
  }

  async run(args: string[]) {
    const { std, fileSystem } = this.pc;
    let previousEntries: string[] = [];

    const commands: Record<string, (args: string[]) => void | Promise<void>> = {
      help: this.commandHelp.bind(this),
      h: this.commandHelp.bind(this),
      exit: this.commandExit.bind(this),
      history: (args) => this.commandHistory(args, previousEntries),
      look: this.commandLook.bind(this),
      go: this.commandGo.bind(this),
      up: this.commandUp.bind(this),
      makedir: this.commandMakeDir.bind(this),
      burndir: this.commandBurnDir.bind(this),
      run: this.commandRun.bind(this),
      open: this.commandOpen.bind(this),
      clear: this.commandClear.bind(this),
      prompt: this.commandPrompt.bind(this),
      take: this.commandTake.bind(this),
      drop: this.commandDrop.bind(this),
      reboot: this.commandReboot.bind(this),
      flp: this.commandFloppy.bind(this),
      fscommit: (args) => this.pc.fileSystem.commit(),
    };

    this.isRunning = true;

    std.writeConsoleCharacter("penger00");
    std.writeConsoleCharacter("penger01");
    std.writeConsoleCharacter("penger02");
    std.writeConsole(" PengOS 2.1\n");
    std.writeConsoleCharacter("penger10");
    std.writeConsoleCharacter("penger11");
    std.writeConsoleCharacter("penger12");
    std.writeConsole(" (c) Copyright 1985 PengCorp\n");

    std.setIsConsoleCursorVisible(true);

    while (this.isRunning) {
      this.printPrompt();
      let autoCompleteStrings = [...this.takenPrograms.map((p) => p.name)];

      const entry = fileSystem.getFileInfo(this.workingDirectory);
      if (entry && entry.type === FileSystemObjectType.Directory) {
        const entries = entry.entries;
        autoCompleteStrings = [
          ...autoCompleteStrings,
          ...entries.map((i) => i.name),
        ];
      }

      autoCompleteStrings = [
        ...autoCompleteStrings,
        "help",
        "exit",
        "history",
        "look",
        "go",
        "up",
        "makedir",
        "run",
        "open",
        "clear",
        "prompt",
        "take",
        "drop",
        "reboot",
      ];

      const commandString =
        this.shiftAutorunCommand() ??
        (await std.readConsoleLine({
          autoCompleteStrings,
          previousEntries,
        })) ??
        "";

      const trimmedCommandString = commandString.trim();
      if (trimmedCommandString.length > 0) {
        previousEntries.push(commandString);
        if (previousEntries.length > 16) {
          previousEntries = previousEntries.slice(1);
        }
      }

      const tokens = readShellTokens(commandString);
      const { nextIndex, command } = parseShellCommand(tokens, 0);

      if (command === null) {
        std.writeConsole("Unable to parse a command, try something simpler\n");
        continue;
      }

      if (nextIndex < tokens.length) {
        std.writeConsole("Extra tokens at the end of the command\n");
        continue;
      }

      if (command.kind === ShellCommandKind.Simple) {
        const commandName: string = command.command;

        const knownCommand = commands[commandName.toLowerCase()];
        const knownTakenApp = this.takenPrograms.find(
          (p) => p.name === commandName,
        );

        if (knownCommand) {
          await knownCommand(command.arguments);
          std.resetConsole();
        } else if (knownTakenApp) {
          const app = fileSystem.getFileInfo(knownTakenApp.path);
          if (app && app.type === FileSystemObjectType.Executable) {
            await app.createInstance().run(command.arguments);
            std.resetConsole();
          } else {
            std.writeConsole(`Executable not found. Consider dropping`);
          }
        } else {
          std.writeConsole(`Unknown command: ${commandName}\n`);
          std.writeConsole('Try "help" or "h" to see available commands\n');
        }
      } else {
        std.writeConsole(
          "Unimplemented command type, try something simpler for now please\n",
        );
      }
    }
  }

  printPrompt() {
    const { std } = this.pc;
    const { prompt, currentDrive, currentPath } = this;

    std.setIsConsoleCursorVisible(true);

    const currentAttributes = std.getConsoleAttributes();
    currentAttributes.fgColor = classicColors[7];
    currentAttributes.bgColor = classicColors[0];
    std.setConsoleAttributes(currentAttributes);

    let pathString = this.workingDirectory.toString();
    const promptString = prompt.replace("%P", pathString);
    std.writeConsole(
      `${this.suppressNextPromptNewline ? "" : "\n"}${promptString}`,
    );
    this.suppressNextPromptNewline = false;
  }

  private getCanonicalPath(
    relativeToPath: FilePath,
    inputPath: string | null,
  ): FilePath | null {
    const inputFilePath = FilePath.tryParse(inputPath ?? "", this.currentDrive);
    if (inputFilePath === null) return null;

    if (inputFilePath.isRelative()) {
      return relativeToPath.combine(inputFilePath);
    } else return inputFilePath;
  }

  private commandExit(args: string[]) {
    this.isRunning = false;
  }

  private commandPrompt(args: string[]) {
    const { std } = this.pc;
    if (args.length === 0) {
      std.writeConsole(`${this.prompt}\n`);
      return;
    }
    this.prompt = args[0];
  }

  private commandLook(args: string[]) {
    const { fileSystem, std } = this.pc;
    const [dirName] = args;

    const lookPath = this.getCanonicalPath(this.workingDirectory, dirName);
    if (lookPath === null) {
      std.writeConsole(`Can't find ${dirName}\n\n`);
      return;
    }

    const entry = fileSystem.getFileInfo(lookPath);

    std.writeConsole(`Looking in ${lookPath.toString()}\n\n`);
    if (entry) {
      if (entry.type === FileSystemObjectType.Directory) {
        const entries = [...entry.entries];
        if (entries.length > 0) {
          entries.sort((a, b) => {
            if (a.name === b.name) {
              return 0;
            }
            if (b.name > a.name) {
              return -1;
            }
            return 1;
          });
          entries.sort((a, b) => {
            if (
              a.type === FileSystemObjectType.Directory &&
              b.type === FileSystemObjectType.Directory
            ) {
              return 0;
            }
            if (
              a.type === FileSystemObjectType.Directory &&
              b.type !== FileSystemObjectType.Directory
            ) {
              return -1;
            }
            return 1;
          });
          for (const directoryEntry of entries) {
            const isDir =
              directoryEntry.type === FileSystemObjectType.Directory;
            std.writeConsole(
              `${directoryEntry.name}${isDir ? PATH_SEPARATOR : ""}\n`,
            );
          }
        } else {
          std.writeConsole(`Directory is empty\n`);
        }
      } else {
        std.writeConsole("Not a directory\n");
      }
    } else {
      std.writeConsole("Does not exist\n");
    }
  }

  private commandGo(args: string[]) {
    const { fileSystem, std } = this.pc;
    const [dirName] = args;

    if (!dirName) {
      std.writeConsole("Must provide a new path\n");
      return;
    }

    const newPath = this.getCanonicalPath(this.workingDirectory, dirName);
    if (newPath === null) {
      std.writeConsole(`Can't find ${dirName}\n\n`);
      return;
    }

    const fsEntry = fileSystem.getFileInfo(newPath);
    if (fsEntry) {
      if (fsEntry.type === FileSystemObjectType.Directory) {
        this.workingDirectory = newPath;
        std.writeConsole(`Now in ${this.workingDirectory.toString()}\n`);
      } else {
        std.writeConsole("Not a directory\n");
      }
    } else {
      std.writeConsole("Does not exist\n");
    }
  }

  private commandUp() {
    const { workingDirectory } = this;
    const { std } = this.pc;
    this.workingDirectory = workingDirectory.parentDirectory();
    if (
      workingDirectory.pieces.length !== this.workingDirectory.pieces.length
    ) {
      std.writeConsole(`Went up to ${this.workingDirectory.toString()}\n`);
    } else {
      std.writeConsole("Already at the root of the drive.\n");
    }
  }

  private commandMakeDir(args: string[]) {
    const { fileSystem, std } = this.pc;
    if (args.length === 0) {
      std.writeConsole("Must provide a name\n");
    }

    for (let i = 0; i < args.length; i++) {
      const newDirPath = this.getCanonicalPath(this.workingDirectory, args[i]);
      if (newDirPath === null) {
        std.writeConsole(`Invalid path ${args[i]}\n`);
        continue;
      }

      try {
        fileSystem.createDirectory(newDirPath, true);
        std.writeConsole(`Directory ${newDirPath.toString()} created\n`);
      } catch (e) {
        std.writeConsole(`${(<Error>e).message}\n`);
      }
    }
  }

  private commandBurnDir(args: string[]) {
    const { fileSystem, std } = this.pc;
    if (args.length === 0) {
      std.writeConsole("Must provide a name\n");
    }

    for (let i = 0; i < args.length; i++) {
      const path = this.getCanonicalPath(this.workingDirectory, args[i]);
      if (path === null) {
        std.writeConsole(`Invalid path ${args[i]}\n`);
        continue;
      }

      try {
        fileSystem.removeDirectory(path, false);
        std.writeConsole(`Directory ${path.toString()} removed\n`);
      } catch (e) {
        std.writeConsole(`${(<Error>e).message}\n`);
      }
    }
  }

  private async commandRun(args: string[]) {
    const { std, fileSystem } = this.pc;
    const [fileName] = args;
    if (!fileName) {
      std.writeConsole("Must provide a file name\n");
      return;
    }

    const path = this.getCanonicalPath(this.workingDirectory, fileName);
    if (path === null) {
      std.writeConsole(`Can't find ${fileName}\n\n`);
      return;
    }

    const fileEntry = fileSystem.getFileInfo(path);
    if (fileEntry) {
      if (fileEntry.type === FileSystemObjectType.Executable) {
        await fileEntry.createInstance().run(args);
      } else if (
        fileEntry.type === FileSystemObjectType.Link &&
        fileEntry.openType === "run"
      ) {
        std.writeConsole("Running...\n");
        fileEntry.data.open();
      } else {
        std.writeConsole(`Not executable\n`);
      }
    } else {
      std.writeConsole(`Does not exist\n`);
    }
  }

  private async commandOpen(args: string[]) {
    const { currentPath } = this;
    const { std, fileSystem } = this.pc;
    const [fileName] = args;
    if (!fileName) {
      std.writeConsole("Must provide a file name\n");
      return;
    }

    const path = this.getCanonicalPath(this.workingDirectory, fileName);
    if (path === null) {
      std.writeConsole(`Can't find ${fileName}\n\n`);
      return;
    }

    const fileEntry = fileSystem.getFileInfo(path);
    if (fileEntry) {
      if (fileEntry.type === FileSystemObjectType.TextFile) {
        std.writeConsole(`${fileEntry.data.getText()}`);
      } else if (fileEntry.type === FileSystemObjectType.Audio) {
        std.writeConsole(`Playing ${fileEntry.name}...\n`);
        std.writeConsole(`Press any key to exit.`);
        fileEntry.data.play();
        await std.readConsoleKey();
        fileEntry.data.stop();
        std.writeConsole(`\n`);
      } else if (fileEntry.type === FileSystemObjectType.Image) {
        std.clearConsole();
        const image = await fileEntry.data.load();
        if (image) {
          std.drawConsoleImage(image, 0, 0);
          const characterSize = std.getConsoleCharacterSize();
          std.moveConsoleCursorBy({
            x: 0,
            y: Math.ceil(image.height / characterSize.h),
          });
        }
        std.writeConsole("Press ENTER to continue...");
        await std.readConsoleLine();
        std.resetConsole();
        std.clearConsole();
      } else if (
        fileEntry.type === FileSystemObjectType.Link &&
        fileEntry.openType === "open"
      ) {
        std.writeConsole("Opening...\n");
        fileEntry.data.open();
      } else {
        std.writeConsole(`Not readable\n`);
      }
    } else {
      std.writeConsole(`Does not exist\n`);
    }
  }

  private async commandReboot() {
    this.isRunning = false;
    this.pc.reboot();
  }

  private commandClear() {
    const { std } = this.pc;
    std.clearConsole();
    this.suppressNextPromptNewline = true;
  }

  private commandTake(args: string[]) {
    const { std, fileSystem } = this.pc;
    const [argsName] = args;
    if (!argsName) {
      std.writeConsole(`Must provide name\n`);
      return;
    }
    const path = this.getCanonicalPath(this.workingDirectory, argsName);
    if (path === null) {
      std.writeConsole(`Can't find ${argsName}\n\n`);
      return;
    }
    const { pieces } = path;
    if (pieces.length == 0) {
      std.writeConsole(`Invalid path provided\n`);
      return;
    }
    const lastPathName = pieces[pieces.length - 1];
    const strippedNameMatch = lastPathName.match(/^[^.]+/);
    if (!strippedNameMatch) {
      std.writeConsole(`Invalid name provided\n`);
      return;
    }
    const target = fileSystem.getFileInfo(path);
    if (!target) {
      std.writeConsole("Program not found\n");
      return;
    }
    if (target.type !== FileSystemObjectType.Executable) {
      std.writeConsole("Not executable\n");
      return;
    }
    const strippedSplit = strippedNameMatch[0].split("/");
    const strippedName = strippedSplit[strippedSplit.length - 1];
    let candidateName = strippedName;
    let dedupIndex = 0;
    while (this.takenPrograms.find((p) => p.name === candidateName)) {
      dedupIndex += 1;
      candidateName = `${strippedName}~${dedupIndex}`;
    }

    std.writeConsole(
      `Added "${argsName}" as "${candidateName}" to command list\n`,
    );
    this.takenPrograms.push({
      name: candidateName,
      path,
    });
  }

  private commandDrop(args: string[]) {
    const { std } = this.pc;
    const [name] = args;
    if (!name) {
      std.writeConsole("Must provide a name\n");
      return;
    }
    const filteredPrograms = this.takenPrograms.filter((p) => p.name !== name);
    if (filteredPrograms.length < this.takenPrograms.length) {
      std.writeConsole(`"${name}" dropped from command list\n`);
    } else {
      std.writeConsole(`"${name}" not found in the taken command list\n`);
    }
  }

  private commandHistory(args: string[], previousEntries: string[]) {
    const { std } = this.pc;
    std.writeConsole(`Last run commands:\n`);
    for (const cmd of previousEntries) {
      std.writeConsole(`${cmd}\n`);
    }
  }

  private commandHelp() {
    const { std } = this.pc;

    const printEntry = (cmd: string, text: string) => {
      std.writeConsoleSequence([
        { bold: true },
        _.padEnd(cmd, 10) + " ",
        { reset: true },
        text,
      ]);
    };

    printEntry("help", "List available commands\n");
    printEntry("exit", "Exit this shell instance\n");
    printEntry("history", "View previously run commands\n");
    printEntry("look", "Display contents of current directory\n");
    printEntry("go", "Navigate directories\n");
    printEntry("up", "Navigate to parent directory\n");
    printEntry("makedir", "Create a directory\n");
    printEntry("run", "Execute program\n");
    printEntry("open", "Display file\n");
    printEntry("clear", "Clear screen\n");
    printEntry("prompt", "Change your command prompt text\n");
    printEntry("take", "Add a program to the command list\n");
    printEntry("drop", "Remove a program from the command list\n");
    printEntry("flp", "Manage floppy disks\n");
    printEntry("reboot", "Restart the system\n");

    if (this.takenPrograms.length > 0) {
      std.writeConsole("\nAvailable programs:\n");
      for (const takenProgram of this.takenPrograms) {
        std.writeConsole(`${takenProgram.name}\n`);
      }
    }
  }

  private commandFloppy(args: string[]) {
    const { std } = this.pc;
    const [command, ...rest] = args;

    if (command === "list") {
      const floppies = this.pc.fileSystem.getFloppyInfos();
      if (floppies.length === 0) {
        std.writeConsole("You have no floppies\n");
        return;
      }

      for (const floppy of floppies) {
        if (floppy.drive) {
          std.writeConsole(`${floppy.drive}: `);
        } else std.writeConsole("   ");
        std.writeConsoleCharacter("floppy0");
        std.writeConsoleCharacter("floppy1");
        std.writeConsole(` ${floppy.name}\n`);
      }
    } else if (command === "spawn") {
      const [name] = rest;
      if (!name) {
        std.writeConsole("Missing floppy name\n");
        return;
      }

      try {
        this.pc.fileSystem.spawnFloppy(name);
        std.writeConsole(`Floppy '${name}' has materialized\n`);
      } catch (e) {
        std.writeConsole(`${(<Error>e).message}\n`);
      }

      return;
    } else if (command === "import") {
    } else if (command === "export") {
    } else if (command === "burn") {
      const [name] = rest;
      if (!name) {
        std.writeConsole("Missing floppy name\n");
        return;
      }

      try {
        this.pc.fileSystem.burnFloppy(name);
        std.writeConsole(`Floppy '${name}' is now a pile of ash\n`);
      } catch (e) {
        std.writeConsole(`${(<Error>e).message}\n`);
      }
    } else if (command === "insert") {
      const [label, name] = rest;

      if (!label) {
        std.writeConsole("Missing drive label\n");
        return;
      }

      if (!isDriveLabel(label)) {
        std.writeConsole("Invalid drive label\n");
        return;
      }

      if (!name) {
        std.writeConsole("Missing floppy name\n");
        return;
      }

      try {
        this.pc.fileSystem.insertFloppy(label, name);
        std.writeConsole(
          `Floppy '${name}' is now available through ${label}:/\n`,
        );
      } catch (e) {
        std.writeConsole(`${(<Error>e).message}\n`);
      }
    } else if (command === "eject") {
      const [label] = rest;

      if (!label) {
        std.writeConsole("Missing drive label\n");
        return;
      }

      if (!isDriveLabel(label)) {
        std.writeConsole("Invalid drive label\n");
        return;
      }

      try {
        this.pc.fileSystem.ejectFloppy(label);
        std.writeConsole(`Drive ${label}:/ no longer contains a floppy\n`);

        if (label === this.workingDirectory.drive) {
          this.currentDrive = "C";
        }
      } catch (e) {
        std.writeConsole(`${(<Error>e).message}\n`);
      }
    } else {
      const printEntry = (cmd: string, text: string) => {
        const cmdFmt =
          cmd.length < 10 ? _.padEnd(cmd, 10) + " " : cmd + "\n           ";
        std.writeConsoleSequence([
          { bold: true },
          cmdFmt,
          { reset: true },
          text,
        ]);
      };

      if (!command) {
        std.writeConsole(`Missing a command\n\n`);
      } else if (command !== "help") {
        std.writeConsole(`Unknown floppy command "${command}"\n\n`);
      }

      printEntry("flp list", "List all mounted floppies\n");
      printEntry("flp spawn <name>", "Create a blank floppy '<name>'\n");
      printEntry("flp import <name>", "Import data onto floppy '<name>'\n");
      printEntry("flp export <name>", "Export data off of floppy '<name>'\n");
      printEntry("flp burn <name>", "Completely destroy floppy '<name>'\n");
      printEntry(
        "flp insert <label> <name>",
        "Insert floppy '<name>' into drive <label>\n",
      );
      printEntry("flp eject <label>", "Eject the floppy at drive <label>\n");
    }
  }
}
