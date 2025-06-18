/**
 * Author: worstprgr@github / strace@tsoding-discord / movrdxrax@discord
 * Extended version: Strawberry
 * Description: Implementing the 8Ball functionality from MrBotka/Hypernerd
 */
import _ from "lodash";
import { Executable } from "./FileSystem";
import { PC } from "./PC";

async function sha256Mod(string: string, modWith: number) {
  const encoder = new TextEncoder();
  const data = encoder.encode(string);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  // Convert first 4 bytes to an integer
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashInt =
    (hashArray[0] << 24) |
    (hashArray[1] << 16) |
    (hashArray[2] << 8) |
    hashArray[3];

  return (hashInt >>> 0) % modWith; // ensure unsigned
}

const EXTENDED_AFFIRMATIVE_ANSWERS = [
  // Affirmative
  "It is certain",
  "It is decidedly so",
  "Without a doubt",
  "Yes, definitely",
  "You may rely on it",
  "As I see it, yes",
  "Most likely",
  "Outlook good",
  "Yes",
  "Signs point to yes",
];

const EXTENDED_NEUTRAL_ANSWERS = [
  // Neutral
  "Reply hazy, try again",
  "Ask again later",
  "Better not tell you now",
  "Cannot predict now",
  "Concentrate and ask again",
];

const EXTENDED_NEGATIVE_ANSWERS = [
  // Negative
  "Don't count on it",
  "My reply is no",
  "My sources say no",
  "Outlook not so good",
  "Very doubtful",
];

const EXTENDED_ANSWERS = [
  ...EXTENDED_AFFIRMATIVE_ANSWERS,
  ...EXTENDED_NEUTRAL_ANSWERS,
  ...EXTENDED_NEGATIVE_ANSWERS,
];

const EXTENDED_ANSWER_SETS = [
  EXTENDED_AFFIRMATIVE_ANSWERS,
  EXTENDED_NEUTRAL_ANSWERS,
  EXTENDED_NEGATIVE_ANSWERS,
];

export class EightBall implements Executable {
  private pc: PC;
  private eightBallGlyph: string;
  private rareResponsePercent: number;
  private isExtended: boolean;

  constructor(pc: PC) {
    this.pc = pc;
    this.eightBallGlyph = "(8)";
    this.rareResponsePercent = 0.1;
    this.isExtended = false;
  }

  async run(args: string[]) {
    this.isExtended = false;

    if (args.length <= 1) {
      this.help(args);
      return;
    }

    if (args[1] === "-h") {
      args.shift();
      this.help(args);
      return;
    }

    if (args[1] === "-e") {
      args.shift();
      this.isExtended = true;
    }

    let userQuery = ['"', args.slice(1).join(" "), '"'].join("");
    const response = this.getResponse(userQuery);

    this.pc.screen.printString(userQuery);
    this.pc.screen.printString("\n");
    this.pc.screen.printString(await response);
  }

  async getResponse(userQuery: string) {
    if (this.isExtended) {
      return this.getExtendedResponse(userQuery);
    }

    return this.getRandomResponse(userQuery);
  }

  help(args: string[]) {
    const helpText = [
      "Welcome to (8) Your personal oracle!\n",
      `Usage: ${args[0]} [-h] [-e] [question]\n`,
      "\n",
      `Example: ${args[0]} Will B replace C?\n`,
      "\n",
      "OPTIONS:\n",
      "  -h - print this help text\n",
      "  -e - run 8ball in Magic 8 Ball emulation mode\n",
    ];
    for (const line of helpText) {
      this.pc.screen.printString(line);
    }
  }

  async getExtendedResponse(userQuery: string) {
    const selection = await sha256Mod(userQuery, 3);
    let answerSet = EXTENDED_ANSWER_SETS[selection];

    return `${this.eightBallGlyph}: ${
      answerSet[_.random(0, answerSet.length - 1)]
    }`;
  }

  async getRandomResponse(userQuery: string) {
    const output: string[] = [this.eightBallGlyph];

    const choice = await sha256Mod(userQuery, 2);

    // Added it for shits and giggles
    if (Math.random() < this.rareResponsePercent) {
      output.push("Maybe ...?");
    } else {
      output.push(choice === 0 ? "Yes" : "No");
    }

    return output.join(": ");
  }
}
