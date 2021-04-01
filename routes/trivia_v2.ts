import express from "express";
import {Socket} from "socket.io";

const app = express();

let http = require("http").Server(app);
let io = require("socket.io")(http);

io.of("/trivia").on("connection", (socket: Socket) => {

    socket.handshake.query.room

})