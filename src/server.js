import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { Server } from "socket.io";
import http from "http";
import path from "path";
import { fileURLToPath } from "url"

dotenv.config();

const app= express();
app.use(cors());
const __fileName= fileURLToPath(import.meta.url);
const __dirname = path.dirname(__fileName);
console.log("Import:", import.meta)
const httpServer= http.createServer(app);

const io= new Server(httpServer, {
    cors: {
        origin: "*"
    },
});

const documents= {};

app.get("/api/health/check", (req, res)=> {
    console.log("=====> Health Check Triggered");
    return res.status(200).send({status: "Healthy"})
})

io.on("connection", (socket)=> {
    console.log("user Connected: ",socket.id);

    socket.on("join-document", (docId)=> {
        socket.join(docId);

        if(!documents[docId]){
            documents[docId] = "";
        }

        socket.emit("load-document", documents[docId]);
    });

    socket.on("send-changes",({docId, operation}) => {
        let doc = documents[docId];
        if (operation.type === "insert") {
            doc = insert(doc, operation.position, operation.value);
        } else if (operation.type === "delete") {
            doc = remove(doc, operation.position, operation.length);
        }

        documents[docId] = doc;

        socket.to(docId).emit("receive-changes", operation);
    })

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