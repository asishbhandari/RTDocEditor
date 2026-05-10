import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { Server, Socket } from "socket.io";
import http from "http";
import * as Y from "yjs";
import { getYDoc, documents } from "./store/documentStore.js"
import { DocumentState } from "./types/documents.js";
import { pubClient, subClient} from "./redis.js"

dotenv.config();

const app= express();
app.use(cors());

const httpServer= http.createServer(app);
const CHANNEL= "doc-updates";
const SERVER_ID = Math.random().toString();

async function getSnapshot(doc: DocumentState): Promise<Uint8Array> {
  if (doc.snapshotCache && !doc.isDirty) {
    return doc.snapshotCache;
  }

  if (doc.snapshotPromise) {
    return doc.snapshotPromise;
  }

  doc.snapshotPromise = (async () => {
    const snapshot = Y.encodeStateAsUpdate(doc.yDoc);

    doc.snapshotCache = snapshot;
    doc.isDirty = false;
    doc.snapshotPromise = null;

    return snapshot;
  })();

  return doc.snapshotPromise;
}

const io= new Server(httpServer, {
    cors: {
        origin: "http://localhost:5173",
        methods:["GET", "POST"]
    },
});

setInterval(() => {
  Object.values(documents).forEach((doc) => {
    if (doc.isDirty && !doc.snapshotPromise) {
      doc.snapshotPromise = getSnapshot(doc);
    }
  });
}, 5000);

app.get("/api/health/check", (req, res)=> {
    console.log("=====> Health Check Triggered");
    return res.status(200).send({status: "Healthy"})
})

io.on("connection", (socket: Socket)=> {
    console.log("user Connected: ",socket.id);

    socket.on("join-document", async({ docId, stateVector,}:{docId: string, stateVector: Uint8Array})=> {
        const doc= getYDoc(docId)
        socket.join(docId);
        doc.users.add(socket.id)

        // send current state to client
        // const state= Y.encodeStateAsUpdate(doc.yDoc)
        // socket.emit("load-document", state);
        let update: Uint8Array;
        if (!stateVector || stateVector.length === 0) {
            // New user → send snapshot
            update = await getSnapshot(doc);
        } else {
            // Returning user → send only missing updates
            update = Y.encodeStateAsUpdate(doc.yDoc, stateVector);
        }
        
        // getSnapshot(doc).then((snapshot) => {
        //     socket.emit("load-document", snapshot);
        // });
        socket.emit("load-document", Array.from(update));

        // listen for updates from client
        socket.on("send-update", (update: number[]) => {
            if(!doc || !docId) return;
            try {
                const Uint8Update= new Uint8Array(update)
                Y.applyUpdate(doc.yDoc, Uint8Update);
                doc.isDirty = true;

                socket.to(docId).emit("receive-update", Array.from(Uint8Update));

                // Publish to redis
                pubClient.publish(CHANNEL, JSON.stringify({
                    docId: docId,
                    update: Array.from(Uint8Update),
                    source: SERVER_ID,
                }))
            } catch (err) {
                console.error("Invalid update", err);
            }
        });
        
        socket.on("disconnect", ()=>{
            doc.users.delete(socket.id)
        });
    });

    socket.on("disconnect",()=>{
        console.log("User disconnected: ",socket.id);
    })
});

subClient.subscribe(CHANNEL, (message)=>{
    const { docId, update, source } = JSON.parse(message);
    // Ignore self messages
    if (source === SERVER_ID) return;

    const doc = getYDoc(docId);

    Y.applyUpdate(doc.yDoc, new Uint8Array(update));
    // Broadcast to local clients
    io.to(docId).emit("receive-update", new Uint8Array(update));
})

const PORT = process.env.PORT || 3003
httpServer.listen(PORT, ()=> {
    console.log("===========> Server is running on PORT: ",PORT)
})