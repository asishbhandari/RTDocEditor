import * as Y from "yjs";
import { DocumentState } from "../types/documents.js";

const documents: Record<string, DocumentState> = {};

export function getYDoc(docId: string): DocumentState{
    if(!documents[docId]){
        const yDoc= new Y.Doc();

        documents[docId]={
            yDoc,
            users: new Set<string>(),
        }
    }

    return documents[docId];
}