import { EventEmitter } from "events";
import type { Socket } from "socket.io";
import Player from "./player";
import Scores from "./scoreSystem";
import { PlayerStateEnum } from "./constants";

const NB_AVAILABLE_BIRDS_COLOR = 8;

export default class PlayersManager extends EventEmitter {
  private playersList: Map<string, Player> = new Map();
  private posOnGrid = 0;
  private scores = new Scores();

  addNewPlayer(playerSocket: Socket, id: string) {
    // Set an available color according the number of client's sprites
    const birdColor = Math.floor(
      Math.random() * (NB_AVAILABLE_BIRDS_COLOR - 1 + 1)
    );

    // Create new player and add it in the list
    const newPlayer = new Player(playerSocket, id, birdColor);

    this.playersList.set(id, newPlayer);

    console.log(
      "[birds]",
      "[PlayersManager]",
      `new player connected, there are currently ${this.playersList.size} player(s)`
    );

    return newPlayer;
  }

  getPlayer(id: string) {
    return this.playersList.get(id);
  }

  removePlayer(id: string) {
    if (this.playersList.has(id)) {
      console.log(
        "[birds]",
        "[PlayersManager]",
        `removing player of id: ${id}`
      );

      this.playersList.delete(id);
    }
  }

  changeLobbyState(id: string, isReady: boolean) {
    const playerToReady = this.playersList.get(id);

    if (typeof playerToReady === "undefined") {
      console.error(
        "[birds]",
        "[PlayersManager]",
        `player with id: ${id} not found!`
      );

      return;
    }

    // Set current player to ready
    playerToReady.setReadyState(isReady);

    // Check if all players are ready
    for (const [id, player] of this.playersList.entries()) {
      if (player.getState() === PlayerStateEnum.WaitingInLobby) {
        console.log("[birds]", "[PlayersManager]", `${id} is not yet ready`);

        return;
      }
    }

    // If players are ready, start the game
    this.emit("players-ready");
  }

  getPlayersListByState(playerState: PlayerStateEnum) {
    return Array.from(this.playersList)
      .map(([, player]) => player)
      .filter((player) => player.getState() === playerState);
  }

  getPlayerList() {
    return Array.from(this.playersList).map(([, player]) =>
      player.getPlayerObject()
    );
  }

  getOnGamePlayerList() {
    return Array.from(this.playersList)
      .map(([, player]) => player)
      .filter((player) => {
        const playerState = player.getState();

        return (
          playerState === PlayerStateEnum.Playing ||
          playerState === PlayerStateEnum.Died
        );
      })
      .map((player) => player.getPlayerObject());
  }

  getNumberOfPlayers() {
    return this.playersList.size;
  }

  updatePlayers(time: number) {
    this.playersList.forEach((player) => {
      player.update(time);
    });
  }

  arePlayersStillAlive() {
    for (const [, player] of this.playersList.entries()) {
      const playerState = player.getState();

      if (playerState === PlayerStateEnum.Playing) {
        return true;
      }
    }

    return false;
  }

  resetPlayersForNewGame() {
    // Reset player position counter
    this.posOnGrid = 0;

    return Array.from(this.playersList).map(([, player]) => {
      player.preparePlayer(this.posOnGrid++);

      return player.getPlayerObject();
    });
  }

  sendPlayerScore() {
    // Save player score
    this.playersList.forEach((player) => {
      this.scores.savePlayerScore(player, player.getScore());
    });

    // Retrieve highscores and then send scores to players
    this.scores.getHighScores((highScores) => {
      this.playersList.forEach((player) => {
        // Send score to the players
        player.sendScore(this.playersList.keys.length, highScores);
      });
    });
  }

  prepareNewPlayer(player: Player, nickname: string, floor: number) {
    // Set his nickname
    player.setNick(nickname);

    player.setFloor(floor);

    // Retrieve his highscore
    this.scores.setPlayerHighScore(player);

    // Put him on the game grid
    player.preparePlayer(this.posOnGrid++);
  }
}
