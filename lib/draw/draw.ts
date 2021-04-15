import { User } from "@soapboxsocial/minis.js";
import sampleSize from "lodash.samplesize";
import wordList from "../../data/word-list";
import sample from "../../util/sample";

export default class Draw {
  private readonly roomID: string;
  private players: Map<string, User>;
  private word!: string;
  private painter!: string;
  private scores: { [key: string]: number };

  constructor(roomID: string) {
    this.roomID = roomID;
    this.players = new Map();
    this.scores = {};
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
    console.log("[addPlayer]", user.username);

    this.players.set(socketID, user);

    if (this.players.size === 1) {
      this.painter = socketID;
    }
  };

  setPainter = (socketID: string) => {
    console.log("[setPainter]");

    this.painter = socketID;
  };

  setRandomPainter = () => {
    const players = Array.from(this.players.keys());

    const newPainter = sample(players);

    this.painter = newPainter;

    return newPainter;
  };

  removePlayer = (socketID: string) => {
    console.log("[removePlayer]", socketID);

    this.players.delete(socketID);
  };

  getPlayersCount = () => {
    console.log("[getPlayersCount]");

    return this.players.size;
  };

  updateScore = (socketID: string, points: number) => {
    console.log("[updateScore]", socketID);

    if (Object.prototype.hasOwnProperty.call(this.scores, socketID)) {
      this.scores[socketID] = this.scores[socketID] += points;

      return;
    }

    this.scores[socketID] = points;
  };
}
