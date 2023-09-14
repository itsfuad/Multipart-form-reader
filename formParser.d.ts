/// <reference types="node" resolution-mode="require"/>
/// <reference types="node" resolution-mode="require"/>
import http from 'http';
type Input = {
    filename?: string;
    name?: string;
    type: string;
    data: Buffer;
};
interface Request extends http.IncomingMessage {
    files?: Input[];
    body?: any;
}
export declare function setMaxFileSize(size: number): void;
export declare function formParser(req: Request, res: http.ServerResponse, next: () => void): void;
export {};
