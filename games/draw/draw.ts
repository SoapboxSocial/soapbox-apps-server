import { User } from "@soapboxsocial/minis.js";
import sampleSize from "lodash.samplesize";
import { Namespace, Socket } from "socket.io";
import { DrawEmitEvents, DrawListenEvents } from ".";
import wordList from "../../data/word-list";
import { postScores, GameTokens } from "../../lib/scores";
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
  private nsp: Namespace<DrawListenEvents, DrawEmitEvents>;

  constructor(
    roomID: string,
    nsp: Namespace<DrawListenEvents, DrawEmitEvents>
  ) {
    this.roomID = roomID;
    this.nsp = nsp;
    this.players = new Map();
    this.scores = {};
    this.canvasOperations = [];
    this.canvasTimestamp = 0;
    this.timeRemaining = ROUND_DURATION;
  }

  start = () => {};

  stop = () => {
    clearInterval(this.intervalId);
  };

  newRound = async () => {
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
      this.nsp.in(this.roomID).emit("TIME", this.timeRemaining);

      if (this.timeRemaining <= 0) {
        clearInterval(this.intervalId);

        this.endRound();
      }
    }, 1 * 1000);
  };

  endRound = async (winnerId?: string) => {
    clearInterval(this.intervalId);

    // Send Scores
    const scores = await this.getHighScores();

    this.nsp.in(this.roomID).emit("SEND_SCORES", scores);

    await delay(NEW_ROUND_DELAY);

    this.nsp.in(this.roomID).emit("SEND_SCORES");

    // Wipe Canvas
    this.nsp.in(this.roomID).emit("UPDATE_CANVAS", {
      canvasTimestamp: this.canvasTimestamp,
    });

    // Wipe Current Word
    this.nsp.in(this.roomID).emit("SEND_WORD", { word: undefined });

    // Set New Painter, Either The Person Who Won The Round, Or A Random One
    if (typeof winnerId === "string" && this.players.has(winnerId)) {
      this.setPainter(winnerId);
    } else {
      this.setPainter(sample(Array.from(this.players.keys())));
    }

    // Send New Painter To All Players
    this.nsp.in(this.roomID).emit("NEW_PAINTER", this.painter);

    // Send New Words To Them
    const words = this.getWordOptions();

    this.nsp.to(this.painter.id).emit("WORDS", { words });
  };

  getWordOptions = (count = 3) => {
    return sampleSize(wordList, count);
  };

  setWord = (selectedWord: string) => {
    this.word = selectedWord;

    this.newRound();
  };

  getWord = () => {
    if (typeof this.word === "undefined") {
      return;
    }

    return this.word;
  };

  addPlayer = (
    socket: Socket<DrawListenEvents, DrawEmitEvents>,
    user: User
  ) => {
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
    return this.painter;
  };

  removePlayer = (socketID: string) => {
    this.players.delete(socketID);
  };

  updateScore = (socketID: string, points: number) => {
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

  getHighScores = async () => {
    const userArray = Array.from(this.players.values());

    const scoresArray = Object.entries(this.scores).map(([username, score]) => {
      const user = userArray.find((el) => el.username === username) as User;

      return {
        id: user.id,
        display_name: user?.display_name ?? user.username,
        score,
      };
    });

    await postScores(
      Object.fromEntries(scoresArray.map((el) => [el.id, el.score])),
      GameTokens.DRAW_WITH_FRIENDS,
      this.roomID
    );

    const scoresArrayDesc = scoresArray.sort((a, b) => b.score - a.score);

    return scoresArrayDesc;
  };
}
