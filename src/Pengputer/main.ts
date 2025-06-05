import { loadFont9x16 } from "../Screen/font9x16";
import { Screen } from "../Screen";
import { Keyboard } from "../Keyboard";
import {
  loadImageBitmapFromUrl,
  readKey,
  readLine,
  waitFor,
  waitForKeysUp,
} from "../Functions";
import { Directory, FileSystem, FileSystemObjectType } from "./FileSystem";
import { PC } from "./PC";
import { HelloWorld } from "./HelloWorld";
import { EightBall } from "./EightBall";
import { DateApp } from "./DateApp";
import { CGA_PALETTE_DICT } from "../Color/cgaPalette";
import { CgaColors } from "../Color/types";
import { padStart } from "lodash";

import energyStar from "./res/energyStar.png";
import biosPenger from "./res/biosPenger.png";

import canyonOgg from "./files/documents/music/CANYON.ogg";
import mountainKingOgg from "./files/documents/music/mountainking.ogg";
import passportOgg from "./files/documents/music/PASSPORT.ogg";
import nerdgerPng from "./files/documents/pengers/nerdger.png";
import macgerPng from "./files/documents/pengers/macger.png";
import { ImageFile, TextFile, AudioFile, LinkFile } from "./fileTypes";
import { argparse } from "../Functions/argparse";
import { PrintArgs } from "./PrintArgs";

const PATH_SEPARATOR = "/";

declare global {
  interface Window {
    startupNoise: HTMLAudioElement;
  }
}

interface TakenProgram {
  path: Array<string>;
  name: string;
}

class PengOS {
  private pc: PC;

  private suppressNextPromptNewline: boolean;
  private takenPrograms: Array<TakenProgram>;

  constructor(screen: Screen, keyboard: Keyboard) {
    this.pc = {
      screen,
      keyboard,
      currentDrive: "C",
      currentPath: [],
      prompt: "%D%P",
      fileSystem: new FileSystem(),
    };
    this.takenPrograms = [];

    this.suppressNextPromptNewline = false;
  }

  async startup() {
    const { screen } = this.pc;

    this.pc.currentDrive = "C";
    this.pc.currentPath = [];
    this.pc.prompt = "%D%P>";

    const rootDirEntry = this.pc.fileSystem.getAtPath([])!;
    const rootDir = rootDirEntry.data as Directory;

    rootDir.addItem({
      type: FileSystemObjectType.Executable,
      name: "date.exe",
      data: new DateApp(this.pc),
    });

    const pengOSDir = rootDir.mkdir("pengos");
    const licenseTxt = new TextFile();
    licenseTxt.replace(
      "(C) COPYRIGHT 1985 PENGER CORPORATION (PENGCORP)\n\n" +
        "BY VIEWING THIS FILE YOU ARE COMMITING A FELONY UNDER TITLE 2,239,132 SECTION\n" +
        "XII OF THE PENGER CRIMINAL JUSTICE CODE"
    );
    pengOSDir.addItem({
      type: FileSystemObjectType.TextFile,
      data: licenseTxt,
      name: "LICENSE.TXT",
    });
    const pplTxt = new TextFile();
    pplTxt.replace(
      `Penger Public License (PPL)\n\nNo copyright.\nIf you are having fun, you are allowed to use and distribute whatever you want.\nYou can't forbid anyone to use Penger freely.\nNo requirements.`
    );
    pengOSDir.addItem({
      type: FileSystemObjectType.TextFile,
      data: pplTxt,
      name: "PPL.TXT",
    });

    const softwareDir = rootDir.mkdir("software");
    softwareDir.addItem({
      type: FileSystemObjectType.Executable,
      name: "hello.exe",
      data: new HelloWorld(this.pc),
    });

    softwareDir.addItem({
      type: FileSystemObjectType.Executable,
      name: "8ball.exe",
      data: new EightBall(this.pc),
    });

    softwareDir.addItem({
      type: FileSystemObjectType.Executable,
      name: "args.exe",
      data: new PrintArgs(this.pc),
    });

    const gamesDir = softwareDir.mkdir("games");
    gamesDir.addItem({
      type: FileSystemObjectType.Link,
      name: "pongr.exe",
      data: new LinkFile("https://penger.city/pongerslair/"),
      openType: "run",
    });

    const documentsDir = rootDir.mkdir("documents");
    const musicDir = documentsDir.mkdir("music");
    musicDir.addItem({
      type: FileSystemObjectType.Audio,
      name: "CANYON.MID",
      data: new AudioFile(canyonOgg),
    });
    musicDir.addItem({
      type: FileSystemObjectType.Audio,
      name: "PASSPORT.MID",
      data: new AudioFile(passportOgg),
    });
    musicDir.addItem({
      type: FileSystemObjectType.Audio,
      name: "mountainking.mid",
      data: new AudioFile(mountainKingOgg),
    });

    const pengersDir = documentsDir.mkdir("pengers");
    pengersDir.addItem({
      type: FileSystemObjectType.Image,
      name: "macger.png",
      data: new ImageFile(macgerPng),
    });
    pengersDir.addItem({
      type: FileSystemObjectType.Image,
      name: "nerdger.png",
      data: new ImageFile(nerdgerPng),
    });

    await this.runStartupAnimation();
  }

  private async runStartupAnimation() {
    const { screen, keyboard } = this.pc;
    screen.clear();
    if (!localStorage.getItem("hasStartedUp")) {
      window.startupNoise.volume = 0.7;
      window.startupNoise.play();
      screen.hideCursor();
      screen.drawImageAt(await loadImageBitmapFromUrl(energyStar), -135, 0);

      screen.printString(
        "    Penger Modular BIOS v5.22, An Energy Star Ally\n"
      );
      screen.printString("    Copyright (C) 1982-85, PengCorp\n");
      screen.printString("\n");
      screen.drawImageAt(await loadImageBitmapFromUrl(biosPenger), 0, 0);
      const curPos = screen.getCursorPosition();
      screen.setCursorPosition({ x: 0, y: 24 });
      screen.printString("05/02/1984-ALADDIN5-P2B");
      screen.setCursorPosition(curPos);
      await waitFor(1000);
      screen.printString("AMD-K6(rm)-III/450 Processor\n");
      screen.printString("Memory Test :        ");
      await waitFor(500);
      for (let i = 0; i <= 262144; i += 1024) {
        screen.setCursorPositionDelta({ x: -7, y: 0 }, false);
        screen.printString(`${padStart(String(i), 6, " ")}K`);
        await waitFor(7);
      }
      await waitFor(500);
      screen.printString(` OK\n`);
      screen.printString("\n");
      await waitFor(750);
      screen.printString("Initialize Plug and Play Cards...\n");
      await waitFor(1000);
      screen.printString("PNP Init Completed");
      await waitFor(2500);
      screen.clear();
      screen.printString(
        "╔═══════════════════════════════════════════════════════════════════════════╗\n"
      );
      screen.printString(
        "║            PBIOS System Configuration (C) 1982-1985, PengCorp             ║\n"
      );
      screen.printString(
        "╠═════════════════════════════════════╤═════════════════════════════════════╣\n"
      );
      screen.printString(
        "║ Main Processor     : AMD-K6-III     │ Base Memory Size   : 640 KB         ║\n"
      );
      screen.printString(
        "║ Numeric Processor  : Present        │ Ext. Memory Size   : 261504 KB      ║\n"
      );
      screen.printString(
        "║ Floppy Drive A:    : None           │ Hard Disk C: Type  : 47             ║\n"
      ); // 1.44 MB, 3½"
      screen.printString(
        "║ Floppy Drive B:    : None           │ Hard Disk D: Type  : None           ║\n"
      );
      screen.printString(
        "║ Display Type       : VGA/PGA/EGA    │ Serial Port(s)     : 3F8, 2F8       ║\n"
      );
      screen.printString(
        "║ PBIOS Date         : 11/11/85       │ Parallel Port(s)   : 378            ║\n"
      );
      screen.printString(
        "╚═════════════════════════════════════╧═════════════════════════════════════╝\n"
      );
      await waitFor(1500);
      screen.printString("Starting PengOS...\n\n");
      await waitFor(1000);
      localStorage.setItem("hasStartedUp", "yes");
    }

    screen.printString("PengOS 2.1\n(c) Copyright 1985 PengCorp\n");

    screen.showCursor();
  }

  formatPath(path: string[]): string {
    return path.length > 0
      ? `${PATH_SEPARATOR}${path.join(PATH_SEPARATOR)}${PATH_SEPARATOR}`
      : PATH_SEPARATOR;
  }

  printPrompt() {
    const { screen, prompt, currentDrive, currentPath } = this.pc;
    screen.setCurrentAttributes({
      ...screen.getCurrentAttributes(),
      fgColor: CGA_PALETTE_DICT[CgaColors.LightGray],
      bgColor: CGA_PALETTE_DICT[CgaColors.Black],
    });
    let pathString = this.formatPath(currentPath);
    const promptString = prompt
      .replace("%D", `${currentDrive}:`)
      .replace("%P", pathString);
    screen.printString(
      `${this.suppressNextPromptNewline ? "" : "\n"}${promptString}`
    );
    this.suppressNextPromptNewline = false;
  }

  private commandPrompt(args: string[]) {
    this.pc.prompt = args[0] ?? "";
  }

  private commandLook() {
    const { fileSystem, currentPath, screen } = this.pc;
    screen.printString(
      `Currently in ${this.pc.currentDrive}:${this.formatPath(currentPath)}\n\n`
    );
    const entry = fileSystem.getAtPath(currentPath);
    if (entry && entry.type === FileSystemObjectType.Directory) {
      const items = entry.data.getItems();
      if (items.length > 0) {
        const items = entry.data.getItems();
        items.sort((a, b) => {
          if (a.name === b.name) {
            return 0;
          }
          if (b.name > a.name) {
            return -1;
          }
          return 1;
        });
        items.sort((a, b) => {
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
        for (const directoryEntry of items) {
          const isDir = directoryEntry.type === FileSystemObjectType.Directory;
          screen.printString(
            `${directoryEntry.name}${isDir ? PATH_SEPARATOR : ""}\n`
          );
        }
      } else {
        screen.printString(`Directory is empty\n`);
      }
    }
  }

  private commandGo(args: string[]) {
    const [dirName] = args;

    const { fileSystem, currentPath, screen } = this.pc;

    if (!dirName) {
      screen.printString("Must provide a new path\n");
      return;
    }

    const newPath = [...currentPath, dirName];
    const fsEntry = fileSystem.getAtPath(newPath);
    if (fsEntry) {
      if (fsEntry.type === FileSystemObjectType.Directory) {
        this.pc.currentPath = newPath;
        screen.printString(
          `Now in ${this.pc.currentDrive}:${this.formatPath(
            this.pc.currentPath
          )}\n`
        );
      } else {
        screen.printString("Not a directory\n");
      }
    } else {
      screen.printString("Does not exist\n");
    }
  }

  private commandUp() {
    const { currentPath, screen } = this.pc;
    if (currentPath.length > 0) {
      currentPath.splice(currentPath.length - 1, 1);
      screen.printString(
        `Went up to ${this.pc.currentDrive}:${this.formatPath(currentPath)}\n`
      );
    } else {
      screen.printString("Already at the root of the drive.\n");
    }
  }

  private commandMakedir(args: string[]) {
    const { currentPath, fileSystem, screen } = this.pc;
    const [newDirName] = args;
    if (!newDirName) {
      screen.printString("Must provide a name\n");
    }

    const currentDirEntry = fileSystem.getAtPath(currentPath);
    if (currentDirEntry?.type === FileSystemObjectType.Directory) {
      const currentDir = currentDirEntry.data;
      currentDir.mkdir(newDirName);
      screen.printString("Directory created\n");
    } else {
      screen.printString("Current path is not a directory\n");
    }
  }

  private async commandRun(args: string[]) {
    const { screen, keyboard, fileSystem, currentPath } = this.pc;
    const [fileName] = args;
    if (!fileName) {
      screen.printString("Must provide a file name\n");
      return;
    }

    const fileEntry = fileSystem.getAtPath([...currentPath, fileName]);
    if (fileEntry) {
      if (fileEntry.type === FileSystemObjectType.Executable) {
        await fileEntry.data.run(args);
      } else if (
        fileEntry.type === FileSystemObjectType.Link &&
        fileEntry.openType === "run"
      ) {
        screen.printString("Running...\n");
        await waitForKeysUp(keyboard);
        fileEntry.data.open();
      } else {
        screen.printString(`Not executable\n`);
      }
    } else {
      screen.printString(`Does not exist\n`);
    }
  }

  private async commandOpen(args: string[]) {
    const { screen, keyboard, fileSystem, currentPath } = this.pc;
    const [fileName] = args;
    if (!fileName) {
      screen.printString("Must provide a file name\n");
      return;
    }

    const fileEntry = fileSystem.getAtPath([...currentPath, fileName]);
    if (fileEntry) {
      if (fileEntry.type === FileSystemObjectType.TextFile) {
        screen.printString(`${fileEntry.data.getText()}`);
      } else if (fileEntry.type === FileSystemObjectType.Audio) {
        screen.printString(`Playing ${fileEntry.name}...\n`);
        screen.printString(`Press any key to exit.`);
        fileEntry.data.play();
        await readKey(keyboard);
        fileEntry.data.stop();
        screen.printString(`\n`);
      } else if (fileEntry.type === FileSystemObjectType.Image) {
        screen.clear();
        const image = await fileEntry.data.load();
        if (image) {
          screen.drawImageAt(image, 0, 0);
          screen.setCursorPositionDelta({
            x: 0,
            y: Math.ceil(image.height / screen.getCharacterSize().h),
          });
        }
      } else if (
        fileEntry.type === FileSystemObjectType.Link &&
        fileEntry.openType === "open"
      ) {
        screen.printString("Opening...\n");
        await waitForKeysUp(keyboard);
        fileEntry.data.open();
      } else {
        screen.printString(`Not readable\n`);
      }
    } else {
      screen.printString(`Does not exist\n`);
    }
  }

  private commandClear() {
    const { screen } = this.pc;
    screen.clear();
    this.suppressNextPromptNewline = true;
  }

  private async commandReboot() {
    localStorage.removeItem("hasStartedUp");
    await this.runStartupAnimation();
  }

  private commandTake(args: string[]) {
    const { screen, fileSystem } = this.pc;
    const [argsName] = args;
    if (!argsName) {
      screen.printString(`Must provide name\n`);
    }
    const strippedNameMatch = argsName.match(/^[^.]+/);
    if (!strippedNameMatch) {
      screen.printString(`Invalid name provided\n`);
      return;
    }
    const path = [...this.pc.currentPath, argsName];
    const target = fileSystem.getAtPath(path);
    if (!target) {
      screen.printString("Program not found\n");
      return;
    }
    if (target.type !== FileSystemObjectType.Executable) {
      screen.printString("Not executable\n");
      return;
    }
    const strippedName = strippedNameMatch[0];
    let candidateName = strippedName;
    let dedupIndex = 0;
    while (this.takenPrograms.find((p) => p.name === candidateName)) {
      dedupIndex += 1;
      candidateName = `${strippedName}~${dedupIndex}`;
    }

    screen.printString(
      `Added "${argsName}" as "${candidateName}" to command list\n`
    );
    this.takenPrograms.push({
      name: candidateName,
      path,
    });
  }

  private commandDrop(args: string[]) {
    const { screen } = this.pc;
    const [name] = args;
    if (!name) {
      screen.printString("Must provide a name\n");
      return;
    }
    const filteredPrograms = this.takenPrograms.filter((p) => p.name !== name);
    if (filteredPrograms.length < this.takenPrograms.length) {
      screen.printString(`"${name}" dropped from command list\n`);
    } else {
      screen.printString(`"${name} not found in the taken command list\n`);
    }
  }

  private commandHistory(args: string[], previousEntries: string[]) {
    const { screen } = this.pc;
    screen.printString(`Last run commands:\n`);
    for (const cmd of previousEntries) {
      screen.printString(`${cmd}\n`);
    }
  }

  private commandHelp() {
    const { screen } = this.pc;
    screen.printString("\x1Bbshelp      \x1BbrList available commands\n");
    screen.printString("\x1Bbshistory   \x1BbrView previously run commands\n");
    screen.printString(
      "\x1Bbslook      \x1BbrDisplay contents of current directory\n"
    );
    screen.printString("\x1Bbsgo        \x1BbrNavigate directories\n");
    screen.printString("\x1Bbsup        \x1BbrNavigate to parent directory\n");
    screen.printString("\x1Bbsmakedir   \x1BbrCreate a directory\n");
    screen.printString("\x1Bbsrun       \x1BbrExecute program\n");
    screen.printString("\x1Bbsopen      \x1BbrDisplay file\n");
    screen.printString("\x1Bbsclear     \x1BbrClear screen\n");
    screen.printString(
      "\x1Bbsprompt    \x1BbrChange your command prompt text\n"
    );
    screen.printString(
      "\x1Bbstake      \x1BbrAdd a program to the command list\n"
    );
    screen.printString(
      "\x1Bbsdrop      \x1BbrRemove a program from the command list\n"
    );
    screen.printString("\x1Bbsreboot    \x1BbrRestart the system\n");

    if (this.takenPrograms.length > 0) {
      screen.printString("\nAvailable programs:\n");
      for (const takenProgram of this.takenPrograms) {
        screen.printString(`${takenProgram.name}\n`);
      }
    }
  }

  async mainLoop() {
    const { screen, keyboard, fileSystem } = this.pc;

    let previousEntries: string[] = [];

    const commands: Record<string, (args: string[]) => void | Promise<void>> = {
      help: this.commandHelp.bind(this),
      h: this.commandHelp.bind(this),
      history: (args) => this.commandHistory(args, previousEntries),
      look: this.commandLook.bind(this),
      go: this.commandGo.bind(this),
      up: this.commandUp.bind(this),
      makedir: this.commandMakedir.bind(this),
      run: this.commandRun.bind(this),
      open: this.commandOpen.bind(this),
      clear: this.commandClear.bind(this),
      prompt: this.commandPrompt.bind(this),
      take: this.commandTake.bind(this),
      drop: this.commandDrop.bind(this),
      reboot: this.commandReboot.bind(this),
    };

    while (true) {
      this.printPrompt();
      let autoCompleteStrings = [...this.takenPrograms.map((p) => p.name)];

      const entry = fileSystem.getAtPath(this.pc.currentPath);
      if (entry && entry.type === FileSystemObjectType.Directory) {
        const items = entry.data.getItems();
        autoCompleteStrings = [
          ...autoCompleteStrings,
          ...items.map((i) => i.name),
        ];
      }

      autoCompleteStrings = [
        ...autoCompleteStrings,
        "help",
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

      const commandString = await readLine(screen, keyboard, {
        autoCompleteStrings,
        previousEntries,
      });
      previousEntries.push(commandString);
      if (previousEntries.length > 16) {
        previousEntries = previousEntries.slice(1);
      }
      const args = argparse(commandString);
      const commandName = args[0];
      if (commandName) {
        const knownCommand = commands[commandName.toLowerCase()];
        const knownTakenApp = this.takenPrograms.find(
          (p) => p.name === commandName
        );
        if (knownCommand) {
          await knownCommand(args.slice(1));
        } else if (knownTakenApp) {
          const app = fileSystem.getAtPath(knownTakenApp.path);
          if (app && app.type === FileSystemObjectType.Executable) {
            app.data.run(args);
          } else {
            screen.printString(`Executable not found. Consider dropping`);
          }
        } else {
          screen.printString("Unknown command: " + commandName + "\n");
          screen.printString('Try "help" or "h" to see available commands\n');
        }
      }
    }
  }
}

(async () => {
  await loadFont9x16();

  const screen = new Screen();
  await screen.init(document.getElementById("screen-container")!);

  const keyboard = new Keyboard();

  let lastTime = performance.now();
  const cb = () => {
    const dt = performance.now() - lastTime;
    lastTime = performance.now();
    screen.draw(dt);
    keyboard.update(dt);
    requestAnimationFrame(cb);
  };
  requestAnimationFrame(cb);

  const pengOS = new PengOS(screen, keyboard);
  await pengOS.startup();
  pengOS.mainLoop();
})();
