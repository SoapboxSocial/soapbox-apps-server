import { User } from "@soapboxsocial/minis.js";
import { Namespace, Server } from "socket.io";
import { DifficultyOptions, Question, Vote } from "../../lib/opentdb";
import Trivia from "./trivia";

export interface TriviaListenEvents {
  START_ROUND: (category: string, difficulty: DifficultyOptions) => void;
  CLOSE_GAME: () => void;
  VOTE: (vote: Vote) => void;
  JOIN_GAME: (user: User) => void;
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
  difficulty: DifficultyOptions
) {
  const game = games.get(roomID);

  if (typeof game === "undefined") {
    return;
  }

  if (typeof game?.sessionToken === "undefined") {
    await game.start(category, difficulty);

    return game;
  }

  await game.update(category, difficulty);

  return game;
}

async function getOrCreateGame(
  roomID: string,
  nsp: Namespace<TriviaListenEvents, TriviaEmitEvents>
) {
  const instance = games.get(roomID);

  if (typeof instance === "undefined") {
    const game = new Trivia(roomID, nsp);

    games.set(roomID, game);

    return game;
  } else {
    return instance;
  }
}

async function deleteGame(roomID: string) {
  const instance = games.get(roomID);

  if (typeof instance === "undefined") {
    return;
  }

  await instance.stop();

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

    socket.on("JOIN_GAME", async (user) => {
      try {
        console.log("[trivia]", "[JOIN_GAME]");

        const game = await getOrCreateGame(roomID, nsp);

        game.addPlayer(socket, user);

        socket.join(roomID);
      } catch (error) {
        console.error(error);
      }
    });

    socket.on("START_ROUND", async (category, difficulty) => {
      console.log("[trivia]", "[START_ROUND]");

      await startOrUpdateGame(roomID, category, difficulty);
    });

    socket.on("VOTE", (vote) => {
      console.log("[trivia]", "[VOTE]");

      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      game.vote(socketID, vote);
    });

    socket.on("CLOSE_GAME", async () => {
      console.log("[trivia]", "[CLOSE_GAME]");

      await deleteGame(roomID);

      nsp.in(roomID).disconnectSockets(true);
    });

    socket.on("disconnect", (reason) => {
      console.log(
        "[trivia]",
        "[disconnect] socket disconnected with reason",
        reason
      );

      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      game.removePlayer(socketID);

      socket.leave(roomID);
    });
  });
}
