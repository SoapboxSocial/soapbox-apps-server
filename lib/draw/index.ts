import { User } from "@soapboxsocial/minis.js";
import { Server } from "socket.io";
import Draw from "./draw";
import isEqual from "../../util/isEqual";

const games = new Map<string, Draw>();

async function getOrStartGame(
  roomID: string,
  io: Server<DrawListenEvents, DrawEmitEvents>
) {
  const instance = games.get(roomID);

  if (typeof instance === "undefined") {
    const game = new Draw(roomID, io);

    await game.start();

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

export interface DrawListenEvents {
  JOIN_GAME: ({ user }: { user: User }) => void;
  CLOSE_GAME: () => void;
  REROLL_WORDS: () => void;
  SELECT_WORD: ({ word }: { word: string }) => void;
  GUESS_WORD: ({ guess }: { guess: string }) => void;
}

export interface DrawEmitEvents {
  WORDS: ({ words }: { words: string[] }) => void;
  SEND_WORD: ({ word }: { word?: string }) => void;
  NEW_PAINTER: ({ id, user }: { id: string; user: User }) => void;
  TIME: (timeLeft: number) => void;
}

export default function drawWithFriends(
  io: Server<DrawListenEvents, DrawEmitEvents>
) {
  io.on("connection", (socket) => {
    const roomID = socket.handshake.query.roomID as string;

    const socketID = socket.id;

    console.log("[connection] new socket connected with id", socketID);

    socket.on("JOIN_GAME", async ({ user }: { user: User }) => {
      try {
        console.log("[JOIN_GAME]");

        socket.join(roomID);

        const game = await getOrStartGame(roomID, io);

        game.addPlayer(socket, user);

        const painter = game.getPainter();

        if (painter) {
          io.in(roomID).emit("NEW_PAINTER", painter);
        }

        const word = game.getWord();

        if (typeof word === "undefined") {
          return;
        }

        socket.emit("SEND_WORD", { word: word });
      } catch (error) {
        console.error(error);
      }
    });

    socket.on("REROLL_WORDS", () => {
      console.log("[REROLL_WORDS]");

      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      const wordOptions = game.getWordOptions();

      socket.emit("WORDS", { words: wordOptions });
    });

    socket.on("SELECT_WORD", ({ word }) => {
      console.log("[SELECT_WORD]");

      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      game.setWord(word);

      io.in(roomID).emit("SEND_WORD", { word });
    });

    socket.on("GUESS_WORD", ({ guess }) => {
      console.log("[GUESS_WORD]", guess);

      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      const correctWord = game.getWord();

      if (typeof correctWord === "undefined") {
        return;
      }

      if (isEqual(guess, correctWord)) {
        console.log("Correct Guess!");

        game.updateScore(socketID, 100);

        /**
         * Set next painter and new round
         */

        io.in(roomID).emit("SEND_WORD", { word: undefined });

        return;
      }

      console.log("Incorrect Guess!");
    });

    socket.on("CLOSE_GAME", async () => {
      console.log("[CLOSE_GAME]");

      io.in(roomID).disconnectSockets(true);

      await deleteGame(roomID);
    });

    socket.on("disconnect", (reason) => {
      console.log("[disconnect] socket disconnected with reason", reason);

      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      game.removePlayer(socketID);

      socket.leave(roomID);
    });
  });
}
