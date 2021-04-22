import { Namespace, Server } from "socket.io";
import { DifficultyOptions, Question, Vote } from "../../lib/opentdb";
import Trivia from "./trivia";

export interface TriviaListenEvents {
  START_ROUND: (category: string, difficulty: DifficultyOptions) => void;
  CLOSE_GAME: () => void;
  VOTE: (vote: Vote) => void;
}

export interface TriviaEmitEvents {
  VOTES: (votes: Vote[]) => void;
  QUESTION: (question: Question | null) => void;
  REVEAL: () => void;
  SCORES: (scores: { display_name: string; score: number }[]) => void;
}

const games = new Map<string, Trivia>();

async function startOrUpdateGame(
  roomID: string,
  category: string,
  difficulty: DifficultyOptions,
  nsp: Namespace<TriviaListenEvents, TriviaEmitEvents>
) {
  const instance = games.get(roomID);

  if (typeof instance === "undefined") {
    const game = new Trivia(roomID, category, difficulty, nsp);

    await game.start();

    games.set(roomID, game);

    return game;
  } else {
    await instance.update(category, difficulty);

    return instance;
  }
}

function deleteGame(roomID: string) {
  const instance = games.get(roomID);

  if (typeof instance === "undefined") {
    return;
  }

  games.delete(roomID);
}

export default function trivia(
  io: Server<TriviaListenEvents, TriviaEmitEvents>
) {
  const nsp = io.of("/trivia");

  nsp.on("connection", (socket) => {
    const roomID = socket.handshake.query.roomID as string;

    const socketID = socket.id;

    console.log(
      "[trivia]",
      "[connection] new socket connected with id",
      socketID
    );

    socket.on("START_ROUND", async (category, difficulty) => {
      await startOrUpdateGame(roomID, category, difficulty, nsp);
    });

    socket.on("VOTE", (vote) => {
      console.log("[trivia]", "[VOTE]");

      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      game.vote(vote);
    });

    socket.on("CLOSE_GAME", () => {
      console.log("[trivia]", "[CLOSE_GAME]");

      nsp.in(roomID).disconnectSockets(true);

      deleteGame(roomID);
    });

    socket.on("disconnect", (reason) => {
      console.log(
        "[trivia]",
        "[disconnect] socket disconnected with reason",
        reason
      );

      socket.leave(roomID);
    });
  });
}
