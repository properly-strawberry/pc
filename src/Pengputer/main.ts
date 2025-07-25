import { padStart } from "lodash";
import { Keyboard } from "../Keyboard";
import { Screen } from "../Screen";
import { loadFont9x16 } from "../Screen/font9x16";
import { loadImageBitmapFromUrl } from "../Toolbox/loadImage";
import { waitFor } from "../Toolbox/waitFor";
import { DateApp } from "./DateApp";
import { EightBall } from "./EightBall";
import {
  FileSystem,
  FileSystemObjectType,
  FileInfoDirectory,
} from "./FileSystem";
import { FilePath, FileInfo } from "./FileSystem";
import { HelloWorld } from "./HelloWorld";
import { PC } from "./PC";
import { PengerShell } from "./PengerShell";

import biosPenger from "./res/biosPenger.png";
import energyStar from "./res/energyStar.png";

import { Std } from "../Std";
import canyonOgg from "./files/documents/music/CANYON.ogg";
import mountainKingOgg from "./files/documents/music/mountainking.ogg";
import passportOgg from "./files/documents/music/PASSPORT.ogg";
import macgerPng from "./files/documents/pengers/macger.png";
import nerdgerPng from "./files/documents/pengers/nerdger.png";
import { AudioFile, ImageFile, LinkFile, TextFile } from "./fileTypes";
import { PengsweeperApp } from "./Pengsweeper";
import { PrintArgs } from "./PrintArgs";
import { TetrisApp } from "./Tetris";

import "../Color/ansi";
import { ScreenKeyboard } from "../Keyboard/ScreenKeyboard";
import { TextBuffer } from "../TextBuffer";
import { Blackjack } from "./Blackjack";
import { Colors } from "./Colors";
import { FileTransferTest } from "./FileTransferTest";
import { loadFont9x8 } from "../Screen/font9x8";
import { Pedlin } from "./Pedlin";

const PATH_SEPARATOR = "/";

declare global {
  interface Window {
    startupNoise: HTMLAudioElement;
  }
}

class PengOS {
  private pc: PC;

  constructor(keyboard: Keyboard, textBuffer: TextBuffer, screen: Screen) {
    const std = new Std(keyboard, textBuffer, screen);
    this.pc = {
      fileSystem: new FileSystem(),
      std,
      reboot: async () => {
        localStorage.removeItem("hasStartedUp");
      },
    };
  }

  private async runShell() {
    const { std } = this.pc;
    const pengerShellExe = this.pc.fileSystem.getFileInfo(
      FilePath.tryParse("C:/software/psh.exe"),
    );
    if (
      pengerShellExe !== null &&
      pengerShellExe.type === FileSystemObjectType.Executable
    ) {
      await pengerShellExe.createInstance().run([]);
    } else {
      throw new Error(
        "Missing default PengerShell executable at 'C:/software/psh.exe'.",
      );
    }
    std.clearConsole();
  }

  async startup() {
    const rootDir = this.pc.fileSystem.getFileInfo(
      FilePath.tryParse("C:/"),
    )! as FileInfoDirectory;
    if (!rootDir) {
      throw new Error("Root dir is undefined.");
    }

    rootDir.addItem({
      type: FileSystemObjectType.Executable,
      name: "date.exe",
      createInstance: () => new DateApp(this.pc),
    });

    const pengOSDir = rootDir.mkdir("pengos");
    const licenseTxt = new TextFile();
    licenseTxt.replace(
      "(C) COPYRIGHT 1985 PENGER CORPORATION (PENGCORP)\n\n" +
        "BY VIEWING THIS FILE YOU ARE COMMITTING A FELONY UNDER TITLE 2,239,132 SECTION\n" +
        "XII OF THE PENGER CRIMINAL JUSTICE CODE",
    );
    pengOSDir.addItem({
      type: FileSystemObjectType.TextFile,
      data: licenseTxt,
      name: "LICENSE.TXT",
    });
    const pplTxt = new TextFile();
    pplTxt.replace(
      `Penger Public License (PPL)\n\nNo copyright.\nIf you are having fun, you are allowed to use and distribute whatever you want.\nYou can't forbid anyone to use Penger freely.\nNo requirements.`,
    );
    pengOSDir.addItem({
      type: FileSystemObjectType.TextFile,
      data: pplTxt,
      name: "PPL.TXT",
    });

    const testDir = rootDir.mkdir("test");
    testDir.addItem({
      type: FileSystemObjectType.Executable,
      name: "colors.exe",
      createInstance: () => new Colors(this.pc),
    });
    testDir.addItem({
      type: FileSystemObjectType.Executable,
      name: "args.exe",
      createInstance: () => new PrintArgs(this.pc),
    });
    testDir.addItem({
      type: FileSystemObjectType.Executable,
      name: "hello.exe",
      createInstance: () => new HelloWorld(this.pc),
    });
    testDir.addItem({
      type: FileSystemObjectType.Executable,
      name: "transfer.exe",
      createInstance: () => new FileTransferTest(this.pc),
    });

    const softwareDir = rootDir.mkdir("software");

    softwareDir.addItem({
      type: FileSystemObjectType.Executable,
      name: "8ball.exe",
      createInstance: () => new EightBall(this.pc),
    });
    softwareDir.addItem({
      type: FileSystemObjectType.Executable,
      name: "psh.exe",
      createInstance: () => new PengerShell(this.pc),
    });
    softwareDir.addItem({
      type: FileSystemObjectType.Executable,
      name: "pedlin.exe",
      createInstance: () => new Pedlin(this.pc),
    });

    const gamesDir = rootDir.mkdir("games");
    gamesDir.addItem({
      type: FileSystemObjectType.Link,
      name: "pongr.exe",
      data: new LinkFile("https://penger.city/pongerslair/"),
      openType: "run",
    });
    gamesDir.addItem({
      type: FileSystemObjectType.Executable,
      name: "pengtris.exe",
      createInstance: () => new TetrisApp(this.pc),
    });
    gamesDir.addItem({
      type: FileSystemObjectType.Executable,
      name: "pengswp.exe",
      createInstance: () => new PengsweeperApp(this.pc),
    });
    gamesDir.addItem({
      type: FileSystemObjectType.Executable,
      name: "blakjack.exe",
      createInstance: () => new Blackjack(this.pc),
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
    do {
      const { std } = this.pc;

      try {
        await this.runShell();
        await this.runStartupAnimation();
      } catch (e) {
        std.writeConsoleError(e);
      }
    } while (true);
  }

  private async runStartupAnimation() {
    const { std } = this.pc;
    std.clearConsole();
    if (!localStorage.getItem("hasStartedUp")) {
      window.startupNoise.volume = 0.7;
      window.startupNoise.play();
      std.setIsConsoleCursorVisible(false);
      std.drawConsoleImage(await loadImageBitmapFromUrl(energyStar), -135, 0);

      std.writeConsole("    Penger Modular BIOS v5.22, An Energy Star Ally\n");
      std.writeConsole("    Copyright (C) 1982-85, PengCorp\n");
      std.writeConsole("\n");
      std.drawConsoleImage(await loadImageBitmapFromUrl(biosPenger), 0, 0);
      const curPos = std.getConsoleCursorPosition();
      std.setConsoleCursorPosition({ x: 0, y: 24 });
      std.writeConsole("05/02/1984-ALADDIN5-P2B");
      std.setConsoleCursorPosition(curPos);
      await waitFor(1000);
      std.writeConsole("AMD-K6(rm)-III/450 Processor\n");
      std.writeConsole("Memory Test :        ");
      await waitFor(500);
      for (let i = 0; i <= 262144; i += 1024) {
        std.moveConsoleCursorBy({ x: -7, y: 0 });
        std.writeConsole(`${padStart(String(i), 6, " ")}K`);
        await waitFor(7);
      }
      await waitFor(500);
      std.writeConsole(` OK\n`);
      std.writeConsole("\n");
      await waitFor(750);
      std.writeConsole("Initialize Plug and Play Cards...\n");
      await waitFor(1000);
      std.writeConsole("PNP Init Completed");
      await waitFor(2500);
      std.clearConsole();
      std.writeConsole(
        "╔═══════════════════════════════════════════════════════════════════════════╗\n",
      );
      std.writeConsole(
        "║            PBIOS System Configuration (C) 1982-1985, PengCorp             ║\n",
      );
      std.writeConsole(
        "╠═════════════════════════════════════╤═════════════════════════════════════╣\n",
      );
      std.writeConsole(
        "║ Main Processor     : AMD-K6-III     │ Base Memory Size   : 640 KB         ║\n",
      );
      std.writeConsole(
        "║ Numeric Processor  : Present        │ Ext. Memory Size   : 261504 KB      ║\n",
      );
      std.writeConsole(
        "║ Floppy Drive A:    : None           │ Hard Disk C: Type  : 47             ║\n",
      ); // 1.44 MB, 3½"
      std.writeConsole(
        "║ Floppy Drive B:    : None           │ Hard Disk D: Type  : None           ║\n",
      );
      std.writeConsole(
        "║ Display Type       : VGA/PGA/EGA    │ Serial Port(s)     : 3F8, 2F8       ║\n",
      );
      std.writeConsole(
        "║ PBIOS Date         : 11/11/85       │ Parallel Port(s)   : 378            ║\n",
      );
      std.writeConsole(
        "╚═════════════════════════════════════╧═════════════════════════════════════╝\n",
      );
      await waitFor(1500);
      std.writeConsole("Starting PengOS...\n\n");
      await waitFor(1000);
      localStorage.setItem("hasStartedUp", "yes");
    }
  }
}

(async () => {
  await loadFont9x16();
  await loadFont9x8();

  const screen = new Screen();
  await screen.init(document.getElementById("screen-container")!);

  const keyboard = new Keyboard();
  new ScreenKeyboard(keyboard);

  const textBuffer = new TextBuffer({
    pageSize: screen.getSizeInCharacters(),
    scrollbackLength: 0,
  });

  let lastTime = performance.now();
  const cb = () => {
    const dt = performance.now() - lastTime;
    lastTime = performance.now();
    screen.updateFromBuffer(textBuffer);
    screen.draw(dt);
    keyboard.update(dt);
    requestAnimationFrame(cb);
  };
  requestAnimationFrame(cb);

  const pengOS = new PengOS(keyboard, textBuffer, screen);
  await pengOS.startup();
})();
