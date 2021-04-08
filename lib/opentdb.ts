import type { User } from "@soapboxsocial/minis.js";
import fetch from "isomorphic-unfetch";
import qs from "../util/qs";

/**
 * **Code 0**: Success Returned results successfully.
 *
 * **Code 1**: No Results Could not return results. The API doesn't have enough questions for your query. (Ex. Asking for 50 Questions in a Category that only has 20.)
 *
 * **Code 2**: Invalid Parameter Contains an invalid parameter. Arguments passed in aren't valid. (Ex. Amount = Five)
 *
 * **Code 3**: Token Not Found Session Token does not exist.
 *
 * **Code 4**: Token Empty Session Token has returned all possible questions for the specified query. Resetting the Token is necessary.
 */
type ResponseCode = 0 | 1 | 2 | 3 | 4;

export type Question = {
  category: string;
  correct_answer: string;
  difficulty: "easy" | "medium" | "hard";
  incorrect_answers: string[];
  question: string;
  type: "boolean" | "multiple";
};

export type DifficultyOptions = "any" | "easy" | "medium" | "hard";

export type Vote = {
  answer: string;
  user: User;
};

export const getSessionToken = async () => {
  type Data = {
    response_code: ResponseCode;
    response_message: string;
    token: string;
  };

  const r = await fetch(`https://opentdb.com/api_token.php?command=request`);

  const { token, response_code }: Data = await r.json();

  if (response_code !== 0) throw new Error("Error Fetching Trivia Data");

  return token;
};

export const getQuestions = async (
  sessionToken: string,
  category: string,
  difficulty: DifficultyOptions
) => {
  type Data = {
    response_code: ResponseCode;
    results: Question[];
  };

  const ENDPOINT =
    "https://opentdb.com/api.php?" +
    qs({
      amount: "5",
      token: sessionToken,
      ...(category !== "all" && { category }),
      ...(difficulty !== "any" && { difficulty }),
    });

  const r = await fetch(ENDPOINT);

  const { results, response_code }: Data = await r.json();

  if (response_code !== 0) throw new Error("Error Fetching Trivia Data");

  return results;
};
