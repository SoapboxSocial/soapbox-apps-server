import fetch from "isomorphic-unfetch";

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

export const getSessionToken = async () => {
  const r = await fetch(`https://opentdb.com/api_token.php?command=request`);

  const {
    token,
  }: {
    response_code: ResponseCode;
    response_message: string;
    token: string;
  } = await r.json();

  return token;
};

export type Question = {
  category: string;
  type: "boolean";
  difficulty: "easy" | "medium" | "hard";
  question: string;
  correct_answer: "True" | "False";
  incorrect_answers: ["True" | "False"];
};

export const getQuestions = async (sessionToken?: string) => {
  const r = await fetch(
    `https://opentdb.com/api.php?amount=50&type=boolean&token=${sessionToken}`
  );

  const {
    results,
  }: {
    response_code: ResponseCode;
    results: Question[];
  } = await r.json();

  return results;
};
