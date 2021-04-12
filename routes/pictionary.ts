import { User } from "@soapboxsocial/minis.js";
import { Server } from "socket.io";
import { Pictionary } from "../lib/pictionary";

const games = new Map<string, Pictionary>();

async function getOrStartGame(roomID: string) {
  const instance = games.get(roomID);

  if (typeof instance === "undefined") {
    const game = new Pictionary(roomID);

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

interface PictionaryListenEvents {
  JOIN_GAME: ({ user }: { user: User }) => void;
  CLOSE_GAME: () => void;
  REROLL_WORDS: () => void;
  SELECT_WORD: ({ word }: { word: string }) => void;
  GUESS_WORD: ({ guess }: { guess: string }) => void;
}

interface PictionaryEmitEvents {
  WORDS: ({ words }: { words: string[] }) => void;
  SEND_WORD: ({ word }: { word: string }) => void;
}

export default function pictionary(
  io: Server<PictionaryListenEvents, PictionaryEmitEvents>
) {
  io.on("connection", (socket) => {
    const roomID = socket.handshake.query.roomID as string;

    const socketID = socket.id;

    console.log("[connection] new socket connected with id", socketID);

    socket.on("JOIN_GAME", async ({ user }: { user: User }) => {
      try {
        console.log("[JOIN_GAME]");

        socket.join(roomID);

        const game = await getOrStartGame(roomID);

        game.addPlayer(socketID, user);

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

      const instance = games.get(roomID);

      if (typeof instance === "undefined") {
        return;
      }

      const wordOptions = instance.getWordOptions();

      socket.emit("WORDS", { words: wordOptions });
    });

    socket.on("SELECT_WORD", ({ word }) => {
      console.log("[SELECT_WORD]");

      const instance = games.get(roomID);

      if (typeof instance === "undefined") {
        return;
      }

      instance.setWord(word);

      io.in(roomID).emit("SEND_WORD", { word });
    });

    socket.on("GUESS_WORD", ({ guess }) => {
      console.log("[GUESS_WORD]");

      const instance = games.get(roomID);

      if (typeof instance === "undefined") {
        return;
      }
    });

    socket.on("CLOSE_GAME", async () => {
      console.log("[CLOSE_GAME]");

      io.in(roomID).disconnectSockets(true);

      await deleteGame(roomID);
    });

    socket.on("disconnect", (reason) => {
      console.log("[disconnect] socket disconnected with reason", reason);

      const instance = games.get(roomID);

      if (typeof instance === "undefined") {
        return;
      }

      instance.removePlayer(socketID);

      socket.leave(roomID);
    });
  });
}
