import { User } from "@soapboxsocial/minis.js";
import sampleSize from "lodash.samplesize";
import { Server, Socket } from "socket.io";
import { DrawEmitEvents, DrawListenEvents } from ".";
import wordList from "../../data/word-list";
import delay from "../../util/delay";
import sample from "../../util/sample";

const ROUND_DURATION = 80;

export type DrawOperation = {
  previous: number[];
  current: number[];
  color: string;
  brushSize: "S" | "M" | "L";
};

export default class Draw {
  private readonly roomID: string;
  private players: Map<string, User>;
  private word!: string;
  private painter!: { id: string; user: User };
  private scores: { [key: string]: number };
  public canvasOperations: DrawOperation[];
  public canvasTimestamp: number;
  private intervalId!: NodeJS.Timeout;
  private timeRemaining: number;
  private io: Server<DrawListenEvents, DrawEmitEvents>;

  constructor(roomID: string, io: Server<DrawListenEvents, DrawEmitEvents>) {
    this.roomID = roomID;
    this.io = io;
    this.players = new Map();
    this.scores = {};
    this.canvasOperations = [];
    this.canvasTimestamp = 0;
    this.timeRemaining = ROUND_DURATION;
  }

  start = async () => {
    this.newRound();
  };

  stop = async () => {};

  newRound = () => {
    this.canvasOperations = [];
    this.canvasTimestamp = 0;

    clearInterval(this.intervalId);

    this.timeRemaining = ROUND_DURATION;

    this.intervalId = setInterval(async () => {
      this.timeRemaining = this.timeRemaining - 1;

      this.io.in(this.roomID).emit("TIME", this.timeRemaining);

      if (this.timeRemaining <= 0) {
        clearInterval(this.intervalId);

        await delay(5 * 1000);

        this.newRound();
      }
    }, 1 * 1000);
  };

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

  addPlayer = (
    socket: Socket<DrawListenEvents, DrawEmitEvents>,
    user: User
  ) => {
    console.log("[addPlayer]", user.username);

    const socketID = socket.id;

    this.players.set(socketID, user);

    if (this.players.size === 1) {
      this.painter = {
        id: socketID,
        user,
      };

      socket.in(this.roomID).emit("NEW_PAINTER", this.painter);

      const words = this.getWordOptions();

      socket.emit("WORDS", { words });
    }
  };

  setPainter = (socketID: string) => {
    console.log("[setPainter]");

    const player = this.players.get(socketID);

    if (typeof player === "undefined") {
      return;
    }

    this.painter = {
      id: socketID,
      user: player,
    };
  };

  getPainter = () => {
    console.log("[getPainter]");

    return this.painter;
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

  addCanvasOperation = (operation: DrawOperation) => {
    this.canvasOperations.push(operation);
  };

  clearCanvas = () => {
    this.canvasOperations = [];
    this.canvasTimestamp = Date.now();
  };
}
