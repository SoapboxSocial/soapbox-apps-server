import { Server } from "socket.io";
import Game from "./game";

const games = new Map<string, Game>();

function getOrCreateGame(roomID: string) {
  const instance = games.get(roomID);

  if (typeof instance === "undefined") {
    let game = new Game();

    game.start();

    games.set(roomID, game);

    return game;
  }

  return instance;
}

function deleteGame(roomID: string) {
  const instance = games.get(roomID);

  if (typeof instance === "undefined") {
    return;
  }

  instance.stop();

  games.delete(roomID);
}

export default function birds(io: Server) {
  const nsp = io.of("/birds");

  nsp.on("connection", (socket) => {
    const roomID = socket.handshake.query.roomID as string;

    const socketID = socket.id;

    console.log(
      "[birds]",
      "[connection] new socket connected with id",
      socketID
    );

    if (roomID === "" || roomID === undefined) {
      socket.disconnect();

      return;
    }

    socket.on("close_game", () => {
      console.log(
        "[birds]",
        "[close_game]",
        `deleting game with roomID of ${roomID}`
      );

      deleteGame(roomID);
    });

    getOrCreateGame(roomID).handle(socket);
  });
}
