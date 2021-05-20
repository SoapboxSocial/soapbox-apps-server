import type { User } from "@soapboxsocial/minis.js";
import { EventEmitter } from "events";
import type { Socket } from "socket.io";
import { BirdsEmitEvents, BirdsListenEvents } from ".";
import { PlayerStateEnum } from "./constants";
import Player from "./player";

const NB_AVAILABLE_BIRDS_COLOR = 8;

export default class PlayersManager extends EventEmitter {
  private playersList: Map<string, Player> = new Map();
  private posOnGrid = 0;
  private scores: Record<string, number> = {};

  addNewPlayer(
    playerSocket: Socket<BirdsListenEvents, BirdsEmitEvents>,
    id: string
  ) {
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
    const highScores = this.getHighScores();

    // Save player score
    this.playersList.forEach((player) => {
      this.savePlayerScore(player, player.getScore());
    });

    // Send score to the players
    this.playersList.forEach((player) => {
      player.sendScore(this.playersList.size, highScores);
    });
  }

  prepareNewPlayer(player: Player, user: User, floor: number) {
    // Set User obj
    player.setUserData(user);

    // Set his nickname
    player.setNick(user.username);

    // Set player's floor
    player.setFloor(floor);

    // Retrieve his highscore
    this.setPlayerHighScore(player);

    // Put him on the game grid
    player.preparePlayer(this.posOnGrid++);
  }

  setPlayerHighScore(player: Player) {
    const nick = player.getNick();

    if (Object.prototype.hasOwnProperty.call(this.scores, nick)) {
      player.setBestScore(this.scores[nick]);

      return;
    }

    player.setBestScore(0);
  }

  savePlayerScore(player: Player, lastScore: number) {
    const nick = player.getNick();

    const highScore = player.getHighScore();

    // If the player just beats his highscore, record it !
    if (lastScore > highScore) {
      this.scores[nick] = lastScore;
    }
  }

  getHighScores() {
    const userArrayFromPlayers = Array.from(this.playersList.values()).map(
      (player) => player.user
    );

    const highScores = Object.entries(this.scores).map(([nick, score]) => {
      const user = userArrayFromPlayers.find(
        (el) => el.username === nick
      ) as User;

      return {
        id: user.id,
        player: nick,
        score,
      };
    });

    const sortedHighScores = highScores.sort((a, b) => b.score - a.score);

    return sortedHighScores;
  }
}
