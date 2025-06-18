/**
 * Author: worstprgr@github / strace@tsoding-discord / movrdxrax@discord
 * Extended version: Strawberry
 * Description: Implementing the 8Ball functionality from MrBotka/Hypernerd
 */
import _ from "lodash";
import { Executable } from "./FileSystem";
import { PC } from "./PC";

const EXTENDED_ANSWERS = [
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
  // Neutral
  "Reply hazy, try again",
  "Ask again later",
  "Better not tell you now",
  "Cannot predict now",
  "Concentrate and ask again",
  // Negative
  "Don't count on it",
  "My reply is no",
  "My sources say no",
  "Outlook not so good",
  "Very doubtful",
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

    let userQuery = ['"', args.slice(1).join(" "), '"'];
    const response = this.getResponse();

    this.pc.screen.printString(userQuery.join(""));
    this.pc.screen.printString("\n");
    this.pc.screen.printString(response);
  }

  getResponse() {
    if (this.isExtended) {
      return this.getExtendedResponse();
    }

    return this.getRandomResponse();
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

  getExtendedResponse() {
    const selection = _.random(0, 19);

    return EXTENDED_ANSWERS[selection];
  }

  getRandomResponse() {
    const output: string[] = [this.eightBallGlyph];

    // Added it for shits and giggles
    if (Math.random() < this.rareResponsePercent) {
      output.push("Maybe ...?");
    } else {
      output.push(Math.random() < 0.5 ? "Yes" : "No");
    }

    return output.join(": ");
  }
}
