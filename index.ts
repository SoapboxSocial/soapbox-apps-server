import express from "express";

const app = express();

const PORT = 8080;

app.get("/", (_, res) => res.send("Express + TypeScript Server"));

app.listen(PORT, () => {
  console.log(`⚡️ [server]: running at https://localhost:${PORT}`);
});
