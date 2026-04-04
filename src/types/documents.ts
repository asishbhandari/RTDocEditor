import * as Y from "yjs";

export interface DocumentState{
    yDoc: Y.Doc;
    users: Set<string>;
}