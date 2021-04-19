import { User } from "@soapboxsocial/minis.js";
import sampleSize from "lodash.samplesize";
import { Server, Socket } from "socket.io";
import { DrawEmitEvents, DrawListenEvents } from ".";
import wordList from "../../data/word-list";
import delay from "../../util/delay";
import sample from "../../util/sample";

const ROUND_DURATION = 60;

const NEW_ROUND_DELAY = 10 * 1000;

export type CanvasOperation = {
  points: number[];
  stroke: string;
  strokeWidth: number;
};

export default class Draw {
  private readonly roomID: string;
  private players: Map<string, User>;
  private word!: string;
  private painter!: { id: string; user: User };
  private scores: { [key: string]: number };
  public canvasOperations: CanvasOperation[];
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

  start = () => {};

  stop = () => {
    console.log("[stop]");

    clearInterval(this.intervalId);
  };

  newRound = async () => {
    console.log("[newRound]");

    clearInterval(this.intervalId);

    // Reset Timer
    this.timeRemaining = ROUND_DURATION;

    // Wipe Canvas
    this.canvasOperations = [];
    this.canvasTimestamp = 0;

    // Start The Game
    this.intervalId = setInterval(async () => {
      // De-Increment Timer
      this.timeRemaining = this.timeRemaining - 1;

      // Emit The Timer
      this.io.in(this.roomID).emit("TIME", this.timeRemaining);

      if (this.timeRemaining <= 0) {
        clearInterval(this.intervalId);

        this.endRound();
      }
    }, 1 * 1000);
  };

  endRound = async (winnerId?: string) => {
    console.log("[endRound]");

    clearInterval(this.intervalId);

    // Send Scores
    const scores = this.getHighScores();

    this.io.in(this.roomID).emit("SEND_SCORES", scores);

    await delay(NEW_ROUND_DELAY);

    this.io.in(this.roomID).emit("SEND_SCORES");

    // Wipe Canvas
    this.io.in(this.roomID).emit("UPDATE_CANVAS", {
      canvasTimestamp: this.canvasTimestamp,
    });

    // Wipe Current Word
    this.io.in(this.roomID).emit("SEND_WORD", { word: undefined });

    // Set New Painter, Either The Person Who Won The Round, Or A Random One
    if (typeof winnerId === "undefined") {
      this.setPainter(sample(Array.from(this.players.keys())));
    } else {
      this.setPainter(winnerId ?? this.painter.id);
    }

    // Send New Painter To All Players
    this.io.in(this.roomID).emit("NEW_PAINTER", this.painter);

    // Send New Words To Them
    const words = this.getWordOptions();

    this.io.to(this.painter.id).emit("WORDS", { words });
  };

  getWordOptions = (count = 3) => {
    console.log("[getWordOptions]");

    return sampleSize(wordList, count);
  };

  setWord = (selectedWord: string) => {
    console.log("[setWord]", selectedWord);

    this.word = selectedWord;

    this.newRound();
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

  updateScore = (socketID: string, points: number) => {
    console.log("[updateScore]", socketID);

    const user = this.players.get(socketID);

    if (typeof user === "undefined") {
      return;
    }

    if (Object.prototype.hasOwnProperty.call(this.scores, user.username)) {
      this.scores[user.username] = this.scores[user.username] += points;

      return;
    }

    this.scores[user.username] = points;
  };

  addCanvasOperation = (operation: CanvasOperation) => {
    this.canvasOperations.push(operation);
  };

  clearCanvas = () => {
    this.canvasOperations = [];
    this.canvasTimestamp = Date.now();
  };

  getHighScores = () => {
    const userArray = Array.from(this.players.values());

    const scoresArray = Object.entries(this.scores).map(([username, score]) => {
      const user = userArray.find((el) => el.username === username);

      return {
        id: user?.id ?? "username",
        display_name: user?.display_name ?? user?.username ?? "User",
        score,
      };
    });

    const scoresArrayDesc = scoresArray.sort((a, b) => b.score - a.score);

    return scoresArrayDesc;
  };
}
