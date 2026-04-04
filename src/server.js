import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { Server } from "socket.io";
import http from "http";
import path from "path";
import { fileURLToPath } from "url"
import * as Y from "yjs";

dotenv.config();

const app= express();
app.use(cors());
const __fileName= fileURLToPath(import.meta.url);
const __dirname = path.dirname(__fileName);
// console.log("Import:", import.meta)
const httpServer= http.createServer(app);

const io= new Server(httpServer, {
    cors: {
        origin: "*"
    },
});

const documents= {};

export function getYDoc(docId){
    if(!documents[docId]){
        const yDoc= new Y.Doc();
        documents[docId]={
            yDoc,
            users: new Set(),
        }
    };
    return documents[docId];
}

app.get("/api/health/check", (req, res)=> {
    console.log("=====> Health Check Triggered");
    return res.status(200).send({status: "Healthy"})
})

io.on("connection", (socket)=> {
    console.log("user Connected: ",socket.id);

    socket.on("join-document", (docId)=> {
        const doc= getYDoc(docId)
        socket.join(docId);
        doc.users.add(socket.id)

        // send current state to client
        const state= Y.encodeStateAsUpdate(doc.yDoc)
        socket.emit("load-document", state);

        // listen for updates from client
        socket.on("send-update", (update)=>{
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

app.get("/", (req, res)=> {
    res.sendFile(__dirname + "/index.html")
})
const PORT = process.env.PORT || 3003
httpServer.listen(PORT, ()=> {
    console.log("===========> Server is running on PORT: ",PORT)
})