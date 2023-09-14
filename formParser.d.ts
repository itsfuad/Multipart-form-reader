/// <reference types="node" />
/// <reference types="node" />
import http from 'http';
type Input = {
    filename?: string;
    name?: string;
    type: string;
    data: Buffer;
};
interface Request extends http.IncomingMessage {
    body?: {
        fields: {
            [key: string]: string;
        };
        files: Input[];
    };
}
export declare function setMaxFileSize(size: number): void;
export declare function formParser(req: Request, res: http.ServerResponse, next: () => void): void;
export {};
