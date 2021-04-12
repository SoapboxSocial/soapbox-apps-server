import { User } from "@soapboxsocial/minis.js";
import sampleSize from "lodash.samplesize";
import wordList from "../../data/word-list";

export class Pictionary {
  private readonly roomID: string;
  private players: Map<string, User>;
  private word!: string;

  constructor(roomID: string) {
    this.roomID = roomID;
    this.players = new Map();
  }

  start = async () => {};

  stop = async () => {};

  getWordOptions = (count = 3) => {
    console.log("[getWordOptions]");

    return sampleSize(wordList, count);
  };

  setWord = (selectedWord: string) => {
    console.log("[setWord]", selectedWord);

    this.word = selectedWord;
  };

  getWord = () => {
    console.log("[getWord]");

    if (typeof this.word === "undefined") {
      return;
    }

    return this.word;
  };

  addPlayer = (socketID: string, user: User) => {
    console.log("[addPlayer]", socketID, user);

    this.players.set(socketID, user);
  };

  removePlayer = (socketID: string) => {
    console.log("[removePlayer]", socketID);

    this.players.delete(socketID);
  };
}
