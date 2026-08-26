import { WebSocketServer } from "ws";
import mongoose from "mongoose";
import { WorkspaceModel } from "db/client";

mongoose.connect(process.env.DB_URL || "mongodb://localhost:27017/aisarthi");

const server = new WebSocketServer({ port: 3000 });

server.on("connection", (ws) => {
  ws.on("message", async (msg) => {
    console.log("Received from client:", msg.toString());

    const workspace = await WorkspaceModel.create({
      path: "123",
      name: "12345",
    });

    ws.send(JSON.stringify({ status: "success", workspace }));
  });
});
