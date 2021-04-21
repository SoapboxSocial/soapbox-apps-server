import { Server } from "socket.io";
import Game from "./lib/game";

type GamesMap = {
  [key: string]: Game;
};

let games: GamesMap = {};

function getOrCreateGame(room: string) {
  if (!(room in games)) {
    let game = new Game();

    game.start();

    games[room] = game;
  }

  return games[room];
}

function deleteGame(room: string) {
  if (!(room in games)) {
    return;
  }

  games[room].stop();

  delete games[room];
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
      console.log("[close_game]", `deleting game with roomID of ${roomID}`);

      deleteGame(roomID);
    });

    getOrCreateGame(roomID).handle(socket);
  });
}
