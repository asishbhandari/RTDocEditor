import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { Server, Socket } from "socket.io";
import http from "http";
import * as Y from "yjs";
import { getYDoc } from "./store/documentStore.js"

dotenv.config();

const app= express();
app.use(cors());

const httpServer= http.createServer(app);

const io= new Server(httpServer, {
    cors: {
        origin: "*"
    },
});

app.get("/api/health/check", (req, res)=> {
    console.log("=====> Health Check Triggered");
    return res.status(200).send({status: "Healthy"})
})

io.on("connection", (socket: Socket)=> {
    console.log("user Connected: ",socket.id);

    socket.on("join-document", (docId: string)=> {
        const doc= getYDoc(docId)
        socket.join(docId);
        doc.users.add(socket.id)

        // send current state to client
        const state= Y.encodeStateAsUpdate(doc.yDoc)
        socket.emit("load-document", state);

        // listen for updates from client
        socket.on("send-update", (update: Uint8Array)=>{
            Y.applyUpdate(doc.yDoc, update);

            // broadcast to others
            socket.to(docId).emit("receive-update", update);
        })
        socket.on("disconnect", ()=>{
            doc.users.delete(socket.id)
        })
    });

    socket.on("disconnect",()=>{
        console.log("User disconnected: ",socket.id);
    })
})

const PORT = process.env.PORT || 3003
httpServer.listen(PORT, ()=> {
    console.log("===========> Server is running on PORT: ",PORT)
})