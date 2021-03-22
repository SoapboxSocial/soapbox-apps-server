import cors from "cors";
import express from "express";
import trivia from "./routes/trivia";

const app = express();

/**
 * App Middleware
 */
app.use(cors());
app.use(express.json());

/**
 * App Routes
 */
app.use("/trivia", trivia);

/**
 * App Startup
 */

// @ts-ignore
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.sendStatus(400);
});

app.set("PORT", process.env.PORT || 8080);

app.listen(app.get("PORT"), () => {
  console.log(`🧼 [server]: listening at ${app.get("PORT")}`);
});
