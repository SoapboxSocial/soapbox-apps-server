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

enum SocketEvents {
  JOIN_GAME = "JOIN_GAME",
  CLOSE_GAME = "CLOSE_GAME",
}

export default function pictionary(io: Server) {
  io.on("connection", (socket) => {
    const roomID = socket.handshake.query.roomID as string;

    const socketID = socket.id;

    console.log("[connection] new socket connected with id", socketID);

    socket.on(SocketEvents.JOIN_GAME, async ({ user }: { user: User }) => {
      console.log("[JOIN_GAME] with payload", user);

      socket.join(roomID);

      const game = await getOrStartGame(roomID);

      game.addPlayer(socketID, user);
    });

    socket.on(SocketEvents.CLOSE_GAME, async () => {
      console.log("[CLOSE_GAME]");

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
