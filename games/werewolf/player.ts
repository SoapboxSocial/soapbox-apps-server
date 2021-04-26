import { User } from "@soapboxsocial/minis.js";

export enum PlayerStatus {
  ALIVE = "ALIVE",
  DEAD = "DEAD",
  SAVED = "SAVED",
}

export enum PlayerRole {
  WEREWOLF = "WEREWOLF",
  SEER = "SEER",
  DOCTOR = "DOCTOR",
  VILLAGER = "VILLAGER",
}

export default class Player {
  readonly role: PlayerRole;
  readonly user: User;
  public status: PlayerStatus;

  constructor(user: User, role: PlayerRole) {
    this.user = user;
    this.role = role;
    this.status = PlayerStatus.ALIVE;
  }

  public kill = () => {
    this.status = PlayerStatus.DEAD;
  };

  public heal = () => {
    this.status = PlayerStatus.SAVED;
  };
}
