import express from "express";
import Pusher from "pusher";
import { getQuestions, getSessionToken, Question } from "../lib/opentdb";
import arrayRemove from "../util/arrayRemove";
import getRandom from "../util/getRandom";

const DURATION = 30;

const router = express.Router();

const pusher = new Pusher({
  appId: "1174088",
  key: "5d3a6dfd9bbec762d06a",
  secret: "9bda653d64053e1b38c6",
  cluster: "eu",
});

/**
 * Server State
 */
let sessionToken: string;

/**
 * Mini State
 */

let questions: Question[] = [];
let question: Question | null;
let votes: string[] = [];

let interval: NodeJS.Timeout;
let timer: number = 0;

/**
 * Middleware
 */
router.use(async (req, res, next) => {
  // console.log("🧼 [server]: current timestamp", Date.now());

  if (!sessionToken) {
    sessionToken = await getSessionToken();
  }

  next();
});

async function getQuestion() {
  /**
   * If questions are empty or they run out, lets request new ones
   */
  if (questions.length === 0) {
    console.log("🙋‍♀️ [trivia]: get new questions");

    questions = await getQuestions(sessionToken);
  }

  const random = questions[getRandom(questions.length)];

  questions = arrayRemove(questions, question);

  question = random;
}

// async function triviaTimer() {
//   if (timer >= DURATION) {
//     console.log("🙋‍♀️ [trivia]: reset timer");

//     timer = 0;
//   } else {
//     // console.log("🙋‍♀️ [trivia]: increment timer");

//     timer++;
//   }

//   pusher.trigger("trivia", "timer", {
//     timer,
//   });
// }

/**
 * Endpoints
 */
router.get("/:roomID/question", async (req, res) => {
  console.log("🙋‍♀️ [trivia]:", `send question, roomID: ${req.params.roomID}`);

  try {
    // if (typeof interval === "undefined") {
    //   interval = setInterval(triviaTimer, 1000);
    // }

    if (typeof question === "undefined") {
      await getQuestion();
    }

    await pusher.trigger("trivia", "question", {
      question,
    });

    res.sendStatus(200);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

router.get("/:roomID/setup", async (req, res) => {
  console.log("🙋‍♀️ [trivia]:", `setup trivia, roomID: ${req.params.roomID}`);

  if (typeof question === "undefined") {
    await getQuestion();
  }

  await pusher.trigger("trivia", "question", {
    question,
  });

  res.sendStatus(200);
});

router.post("/:roomID/vote", async (req, res) => {
  console.log("🙋‍♀️ [trivia]:", `handle vote, roomID: ${req.params.roomID}`);

  const { vote } = req.body;

  votes = [...votes, vote];

  await pusher.trigger("trivia", "vote", {
    votes,
  });

  res.sendStatus(200);
});

router.get("/:roomID/reset", async (req, res) => {
  console.log("🙋‍♀️ [trivia]:", `reset state, roomID: ${req.params.roomID}`);

  questions = [];
  question = null;
  votes = [];

  timer = 0;
  if (interval) clearInterval(interval);

  res.sendStatus(200);
});

export default router;
