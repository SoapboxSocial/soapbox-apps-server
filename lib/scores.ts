import fetch from "node-fetch";
import { SERVER_BASE } from "../constants";

export enum GameTokens {
  FLAPPY_BIRD = "03ba569d-1577-43f0-8acb-602f0c2ca720",
  TRIVIA = "198ba444-55b7-47c6-8cb5-5cc912f83ea4",
  DRAW_WITH_FRIENDS = "349c0163-8049-4453-a067-aca72bb51254",
}

export async function postScores(
  scores: Record<number, number>,
  token: GameTokens
) {
  const r = await fetch(SERVER_BASE + "/v1/minis/scores?token=" + token, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(scores),
  });

  if (r.ok) {
    return;
  }

  throw new Error(r.statusText);
}
