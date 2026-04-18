import * as Y from "yjs";
import { DocumentState } from "../types/documents.js";

export const documents: Record<string, DocumentState> = {};

export function getYDoc(docId: string): DocumentState{
    if(!documents[docId]){
        const yDoc= new Y.Doc();

        documents[docId]={
            yDoc,
            users: new Set<string>(),
            snapshotCache: null,
            snapshotPromise: null,
            isDirty: true,
        }
    }

    return documents[docId];
}