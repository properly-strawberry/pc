import {
  AudioFile,
  ImageFile,
  LinkFile,
  LinkOpenType,
  TextFile,
  BinaryFile,
} from "./fileTypes";

import _ from "lodash";

export const PATH_SEPARATOR = "/";
export const LSKEY_FLOPPIES = "floppies";

export enum FileSystemObjectType {
  Directory = "dir",
  TextFile = "txt",
  Executable = "exe",
  Audio = "aud",
  Image = "img",
  Link = "lnk",
  Binary = "bin",
}

export const DriveLabelValues: string[] = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
] as const;

export type DriveLabel = (typeof DriveLabelValues)[number];

export function isDriveLabel(label: string): label is DriveLabel {
  return DriveLabelValues.includes(label);
}

export interface Executable {
  run: (args: string[]) => Promise<void>;
}

export class FilePath {
  static tryParse(
    path: string,
    defaultDrive: DriveLabel | null = null,
  ): FilePath | null {
    if (path.length === 0) return new FilePath(null, [], false);
    if (path === "/") return new FilePath(null, [], true);

    let drive: DriveLabel | null = null;

    const colonIndex = path.indexOf(":");
    if (colonIndex >= 0) {
      const driveName = path.slice(0, colonIndex).toUpperCase();
      // TODO(local): file info parse error
      if (!isDriveLabel(driveName)) return null;
      drive = driveName;

      path = path.slice(colonIndex + 1);
    }

    const isAbsolute = path.length === 0 || path[0] === "/";
    if (isAbsolute) {
      path = path.slice(1);
      if (drive === null) drive = defaultDrive;
    }

    const pieces = path.split("/").filter((s) => s.length > 0);
    return new FilePath(drive, pieces, isAbsolute);
  }

  #drive: DriveLabel | null;
  #pieces: string[];
  #isAbsolute: boolean;

  private constructor(
    drive: DriveLabel | null,
    pieces: string[],
    isAbsolute: boolean,
  ) {
    isAbsolute = drive !== null || isAbsolute;

    this.#drive = drive;
    this.#isAbsolute = isAbsolute;

    this.#pieces = [];
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];

      if (piece === "..") {
        if (isAbsolute) {
          if (this.#pieces.length !== 0) this.#pieces.pop();
        } else this.#pieces.push("..");
      } else if (piece === ".") {
        continue;
      } else this.#pieces.push(piece);
    }
  }

  get drive(): DriveLabel | null {
    return this.#drive;
  }

  get pieces(): readonly string[] {
    return [...this.#pieces];
  }

  hasDrive() {
    return this.drive !== null;
  }

  isAbsolute() {
    return this.#isAbsolute;
  }

  isRelative() {
    return !this.#isAbsolute;
  }

  equals(other: FilePath): boolean {
    if (this.drive !== other.drive) {
      return false;
    }

    const thisPieces = this.#pieces;
    const otherPieces = other.#pieces;
    if (thisPieces.length !== otherPieces.length) {
      return false;
    }

    for (let i = 0; i < thisPieces.length; i++) {
      if (thisPieces[i] !== otherPieces[i]) {
        return false;
      }
    }

    return true;
  }

  combine(other: FilePath) {
    if (other.isAbsolute()) return this;
    return new FilePath(
      this.#drive,
      [...this.#pieces, ...other.#pieces],
      this.#isAbsolute,
    );
  }

  toString() {
    const pathPart = this.#pieces.join(PATH_SEPARATOR);
    if (this.drive !== null) {
      return `${this.drive}:${PATH_SEPARATOR}${pathPart}`;
    } else if (this.#isAbsolute) {
      return `${PATH_SEPARATOR}${pathPart}`;
    } else return `.${PATH_SEPARATOR}${pathPart}`;
  }

  parentDirectory() {
    const pieces = this.#pieces;
    if (pieces.length === 0) return this;
    return new FilePath(
      this.#drive,
      pieces.slice(0, pieces.length - 1),
      this.#isAbsolute,
    );
  }
}

export class FileInfoDirectory {
  type: FileSystemObjectType.Directory = FileSystemObjectType.Directory;

  #name: string;
  #entries: FileInfo[] = [];

  constructor(name: string, entries: FileInfo[]) {
    this.#name = name;
    this.#entries = entries;
  }

  get name() {
    return this.#name;
  }

  get entries(): readonly FileInfo[] {
    return [...this.#entries];
  }

  addItem(info: Exclude<FileInfo, FileInfoDirectory>) {
    if (_.find(this.#entries, (e) => e.name === info.name)) {
      throw new Error(`${info.name} already exists`);
    }

    this.#entries.push(info);
    return info;
  }

  mkdir(name: string): FileInfoDirectory {
    if (_.find(this.#entries, (e) => e.name === name)) {
      throw new Error(`${name} already exists`);
    }

    const dir = new FileInfoDirectory(name, []);
    this.#entries.push(dir);
    return dir;
  }

  rmdir(name: string, force: boolean = false) {
    const entries = this.#entries;
    const dir = _.find(entries, (e) => e.name === name);
    if (!dir) {
      throw new Error(`${name} does not exist`);
    }

    if (dir.type !== FileSystemObjectType.Directory) {
      throw new Error(`${name} is not a directory`);
    }

    if (dir.entries.length !== 0 && !force) {
      throw new Error(`${name} is not empty`);
    }

    _.remove(entries, (e) => e.name === name);
  }
}

export interface FileInfoText {
  type: FileSystemObjectType.TextFile;
  name: string;
  data: TextFile;
}

export interface FileInfoExecutable {
  type: FileSystemObjectType.Executable;
  name: string;
  createInstance: () => Executable;
}

export interface FileInfoAudio {
  type: FileSystemObjectType.Audio;
  name: string;
  data: AudioFile;
}

export interface FileInfoImage {
  type: FileSystemObjectType.Image;
  name: string;
  data: ImageFile;
}

export interface FileInfoLink {
  type: FileSystemObjectType.Link;
  name: string;
  data: LinkFile;
  openType: LinkOpenType;
}

export interface FileInfoBinary {
  type: FileSystemObjectType.Binary;
  name: string;
  data: BinaryFile;
}

export type FileInfo =
  | FileInfoDirectory
  | FileInfoText
  | FileInfoExecutable
  | FileInfoAudio
  | FileInfoImage
  | FileInfoLink
  | FileInfoBinary;

enum FileSystemDriveKind {
  Transient = "Transient",
  Floppy = "Floppy",
}

interface FileSystemDriveInterface {
  get rootEntry(): FileInfoDirectory;
}

type FileSystemDrive = TransientFileSystemDrive | FloppyFileSystemDrive;

class TransientFileSystemDrive implements FileSystemDriveInterface {
  type: FileSystemDriveKind.Transient = FileSystemDriveKind.Transient;

  #rootEntry: FileInfoDirectory;

  constructor() {
    this.#rootEntry = new FileInfoDirectory("/", []);
  }

  get rootEntry(): FileInfoDirectory {
    return this.#rootEntry;
  }
}

export type FloppyStorage = {
  name: string;
  drive: DriveLabel | null;
  data: string;
};

export type FloppySerializedFile =
  | {
      type: FileSystemObjectType.TextFile;
      name: string;
      textData: string;
    }
  | {
      type: FileSystemObjectType.Binary;
      name: string;
      binaryData: string;
    }; // etc., soon

export type FloppySerializedDirectory = {
  type: FileSystemObjectType.Directory;
  name: string;
  entries: (FloppySerializedFile | FloppySerializedDirectory)[];
};

export type FloppySerialized = {
  root: FloppySerializedDirectory;
};

class FloppyFileSystemDrive implements FileSystemDriveInterface {
  type: FileSystemDriveKind.Floppy = FileSystemDriveKind.Floppy;

  static fromSerialized(
    floppyContents: FloppySerialized,
  ): FloppyFileSystemDrive {
    const rootEntry = FloppyFileSystemDrive.#deserializeDirectory(
      floppyContents.root,
    );
    return new FloppyFileSystemDrive(rootEntry);
  }

  static #deserializeDirectory(
    dir: FloppySerializedDirectory,
  ): FileInfoDirectory {
    const entries = dir.entries.map((e) =>
      FloppyFileSystemDrive.#deserializeFile(e),
    );
    return new FileInfoDirectory(dir.name, entries);
  }

  static #deserializeFile(
    file: FloppySerializedFile | FloppySerializedDirectory,
  ): FileInfo {
    if (file.type === FileSystemObjectType.Directory) {
      return FloppyFileSystemDrive.#deserializeDirectory(file);
    }

    if (file.type === FileSystemObjectType.TextFile) {
      const textFile = new TextFile();
      textFile.replace(file.textData);
      return {
        type: FileSystemObjectType.TextFile,
        name: file.name,
        data: textFile,
      };
    }

    if (file.type === FileSystemObjectType.Binary) {
      const binaryFile = new BinaryFile(file.binaryData);
      return {
        type: FileSystemObjectType.Binary,
        name: file.name,
        data: binaryFile,
      };
    }

    throw new Error(
      `Unrecognized or unsupported serialized file type: ${(<any>file).type}`,
    );
  }

  static #serializeDirectory(
    dir: FileInfoDirectory,
  ): FloppySerializedDirectory {
    const entries = dir.entries.map((e) =>
      FloppyFileSystemDrive.#serializeFile(e),
    );
    return {
      type: FileSystemObjectType.Directory,
      name: dir.name,
      entries: entries,
    };
  }

  static #serializeFile(
    file: FileInfo,
  ): FloppySerializedFile | FloppySerializedDirectory {
    if (file.type === FileSystemObjectType.Directory) {
      return FloppyFileSystemDrive.#serializeDirectory(file);
    }

    if (file.type === FileSystemObjectType.TextFile) {
      return {
        type: FileSystemObjectType.TextFile,
        name: file.name,
        textData: file.data.getText(),
      };
    }

    if (file.type === FileSystemObjectType.Binary) {
      return {
        type: FileSystemObjectType.Binary,
        name: file.name,
        binaryData: file.data.data,
      };
    }

    throw new Error(
      `Unrecognized or unsupported file info type: ${(<any>file).type}`,
    );
  }

  #rootEntry: FileInfoDirectory;

  private constructor(rootEntry: FileInfoDirectory) {
    this.#rootEntry = rootEntry;
  }

  get rootEntry(): FileInfoDirectory {
    return this.#rootEntry;
  }

  serialize(): FloppySerialized {
    return {
      root: FloppyFileSystemDrive.#serializeDirectory(this.#rootEntry),
    };
  }
}

export class FileSystem {
  private drives: { [id: DriveLabel]: FileSystemDrive } = {};

  constructor() {
    this.mount("C", new TransientFileSystemDrive());

    const floppyDataString = localStorage.getItem(LSKEY_FLOPPIES) ?? "[]";
    const floppyData = JSON.parse(floppyDataString) as FloppyStorage[];

    for (let floppy of floppyData) {
      if (floppy.drive === null) continue;
      try {
        this.#insertFloppyInternal(floppy.drive, floppy);
      } catch (e) {
        throw e;
      }
    }

    localStorage.setItem(LSKEY_FLOPPIES, JSON.stringify(floppyData));
  }

  mount(label: DriveLabel, drive: FileSystemDrive): boolean {
    if (label in this.drives) return false;
    this.drives[label] = drive;
    return true;
  }

  unmount(label: DriveLabel) {
    delete this.drives[label];
  }

  commit() {
    const floppyDataString = localStorage.getItem(LSKEY_FLOPPIES) ?? "[]";
    const floppyData = JSON.parse(floppyDataString) as FloppyStorage[];

    for (let floppy of floppyData) {
      if (floppy.drive === null) continue;
      let drive = this.drives[floppy.drive];
      if (drive.type !== FileSystemDriveKind.Floppy) {
        floppy.drive = null;
      } else {
        floppy.data = JSON.stringify(drive.serialize());
      }
    }

    localStorage.setItem(LSKEY_FLOPPIES, JSON.stringify(floppyData));
  }

  getFloppyInfos(): readonly { drive: DriveLabel | null; name: string }[] {
    const floppyDataString = localStorage.getItem(LSKEY_FLOPPIES);
    if (!floppyDataString) {
      return [];
    }

    const floppyData = JSON.parse(floppyDataString) as FloppyStorage[];
    floppyData.sort((a, b) => {
      const stringCompare = (l: string, r: string) => {
        if (l === r) return 0;
        if (l < r) return -1;
        return 1;
      };

      if (a.drive !== null && b.drive !== null) {
        return stringCompare(a.drive, b.drive);
      }

      if (a.drive !== null) return -1;
      if (b.drive !== null) return 1;

      return stringCompare(a.name, b.name);
    });

    return floppyData.map((d) => {
      return { drive: d.drive, name: d.name };
    });
  }

  spawnFloppy(name: string) {
    if (!name.match(/^[a-zA-Z0-9_]+$/)) {
      throw new Error("Invalid floppy name\n");
    }

    const floppyDataString = localStorage.getItem(LSKEY_FLOPPIES) ?? "[]";
    const floppyData = JSON.parse(floppyDataString) as FloppyStorage[];

    const existing = _.find(floppyData, (d) => d.name === name);
    if (existing) {
      throw new Error(`Floppy '${name}' already exists\n`);
    }

    const floppyContents: FloppySerialized = {
      root: {
        type: FileSystemObjectType.Directory,
        name: "/",
        entries: [],
      },
    };

    floppyData.push({
      name: name,
      drive: null,
      data: JSON.stringify(floppyContents),
    });
    localStorage.setItem(LSKEY_FLOPPIES, JSON.stringify(floppyData));
  }

  burnFloppy(name: string) {
    const floppyDataString = localStorage.getItem(LSKEY_FLOPPIES) ?? "[]";
    const floppyData = JSON.parse(floppyDataString) as FloppyStorage[];

    const floppyCount = floppyData.length;
    const floppies = _.remove(floppyData, (d) => d.name === name);

    if (floppies.length === 0) {
      throw new Error("No floppy with that name");
    }

    const [floppy] = floppies;
    if (floppy.drive !== null) {
      this.unmount(floppy.drive);
    }

    localStorage.setItem(LSKEY_FLOPPIES, JSON.stringify(floppyData));
  }

  #insertFloppyInternal(label: DriveLabel, floppy: FloppyStorage) {
    const floppyContents = JSON.parse(floppy.data) as FloppySerialized;

    const drive = FloppyFileSystemDrive.fromSerialized(floppyContents);
    if (drive === null) {
      throw new Error("Failed to deserialize drive; can't mount it");
    }

    if (!this.mount(label, drive)) {
      throw new Error("Failed to insert floppy; it might be corrupt");
    }

    floppy.drive = label;
  }

  insertFloppy(label: DriveLabel, floppyName: string) {
    const floppyDataString = localStorage.getItem(LSKEY_FLOPPIES) ?? "[]";
    const floppyData = JSON.parse(floppyDataString) as FloppyStorage[];

    const floppy = _.find(floppyData, (d) => d.name === floppyName);
    if (!floppy) {
      throw new Error("No floppy with that name");
    }

    this.#insertFloppyInternal(label, floppy);
    localStorage.setItem(LSKEY_FLOPPIES, JSON.stringify(floppyData));
  }

  ejectFloppy(label: DriveLabel) {
    if (!this.drives[label]) return;

    const floppyDataString = localStorage.getItem(LSKEY_FLOPPIES) ?? "[]";
    const floppyData = JSON.parse(floppyDataString) as FloppyStorage[];

    const floppy = _.find(floppyData, (d) => d.drive === label);
    if (!floppy) {
      throw new Error("No floppy mounted to that drive");
    }

    this.unmount(label);

    floppy.drive = null;
    localStorage.setItem(LSKEY_FLOPPIES, JSON.stringify(floppyData));

    console.dir(floppy);
    console.dir(floppyData);
  }

  trySerializeFloppy(label: DriveLabel): string | null {
    try {
      const drive = this.drives[label];
      if (!drive) return null;

      if (drive.type !== FileSystemDriveKind.Floppy) {
        return null;
      }

      return JSON.stringify(drive.serialize());
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  getFileInfo(path: FilePath | null): FileInfo | null {
    if (path === null) return null;

    const { drive, pieces } = path;
    if (drive === null) return null;

    const fsDrive: FileSystemDrive = this.drives[drive];
    if (fsDrive === undefined) return null;

    const rootEntry = fsDrive.rootEntry;
    if (pieces.length === 0) {
      return rootEntry;
    }

    let cur: FileInfoDirectory = rootEntry;
    for (let i = 0; i < pieces.length - 1; i++) {
      const pathName = pieces[i];

      const entries = cur.entries;
      const found =
        entries.find(
          (e) =>
            e.type === FileSystemObjectType.Directory && e.name === pathName,
        ) ?? null;

      if (found && found.type === FileSystemObjectType.Directory) {
        cur = found;
      } else return null;
    }

    const pathName = pieces[pieces.length - 1];

    const entries = cur.entries;
    return entries.find((e) => e.name === pathName) ?? null;
  }

  createDirectory(path: FilePath, wholePath: boolean = false) {
    const pieces = path.pieces;
    for (let pathIndex = 0; pathIndex < pieces.length; pathIndex++) {
      const nextDirPath = FilePath.tryParse(
        `${path.drive}:/${pieces.slice(0, pathIndex + 1).join("/")}`,
      )!;
      const nextDirEntry = this.getFileInfo(nextDirPath);

      if (nextDirEntry === null) {
        const prevDirEntry = this.getFileInfo(nextDirPath.parentDirectory())!;
        if (
          prevDirEntry !== null &&
          prevDirEntry.type === FileSystemObjectType.Directory
        ) {
          prevDirEntry.mkdir(pieces[pathIndex]);
        }
      } else if (nextDirEntry.type !== FileSystemObjectType.Directory) {
        throw new Error(`Path ${nextDirPath.toString()} is not a directory`);
      }
    }
  }

  removeDirectory(path: FilePath, force: boolean = false) {
    const parentPath = path.parentDirectory();
    const parentDir = this.getFileInfo(parentPath);
    if (parentDir === null) {
      throw new Error(`${parentPath.toString()} does not exist`);
    }

    if (parentDir.type !== FileSystemObjectType.Directory) {
      throw new Error(`${parentPath.toString()} is not a directory`);
    }

    if (path.equals(parentPath)) {
      return; // root always exists, and we were given root.
    }

    const pieces = path.pieces;
    return parentDir.rmdir(pieces[pieces.length - 1], force);
  }
}
