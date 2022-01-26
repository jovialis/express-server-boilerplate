/**
 * Created on 10/15/21 by jovialis (Dylan Hanson)
 **/

import {Application, Request, Response, NextFunction, ErrorRequestHandler} from "express";
import {CorsOptions} from 'cors';

import * as express from 'express';
import * as cookieParser from 'cookie-parser';
import * as logger from 'morgan';
import * as cors from 'cors';
import * as enforce from 'express-sslify';

export type RestHandler = (app: Application) => void;

export class ServerBoilerplate {
    private readonly dev: boolean;
    private handlers: RestHandler[];

    // Package-specific settings
    private corsOptions: CorsOptions | false = {};

    private _extendedURLEncoding: boolean = false;

    // Error handling function
    private errorRequestHandler: ErrorRequestHandler = (
        err: any, req: Request, res: Response, next: NextFunction
    ) => {
        if (res.headersSent) {
            return next(err);
        }

        let status = err.statusCode || 500;
        let message = err.message || "No error details provided.";

        if (err.expose || this.dev) {
            // console.log(err);
        } else {
            status = 500;
            message = "An internal error occurred.";
        }

        res.status(status).send(message);
    }

    constructor() {
        this.dev = process.env.NODE_ENV !== 'production'
        this.handlers = [];
    }

    public handler(handler: RestHandler): ServerBoilerplate {
        this.handlers.push(handler);
        return this;
    }

    public cors(options: CorsOptions): ServerBoilerplate {
        this.corsOptions = options;
        return this;
    }

    public extendedURLEncoding(flag: boolean) {
        this._extendedURLEncoding = flag;
    }

    public errorHandler(handler: ErrorRequestHandler): ServerBoilerplate {
        this.errorRequestHandler = handler;
        return this;
    }

    public async start(port?: string): Promise<void> {
        port = port || process.env.PORT;

        const app = express.default();
        app.disable('x-powered-by');

        // Trust proxy if we're in production
        if (!this.dev) {
            app.enable('trust proxy');
        }

        app.use(logger.default(this.dev ? 'dev' : 'tiny'));
        app.use(express.json());
        app.use(express.urlencoded({ extended: this._extendedURLEncoding }));
        app.use(cookieParser.default());

        if (this.corsOptions !== false)
            app.use(cors.default(this.corsOptions));

        // Enforce HTTPS if we are on a production server
        if (!this.dev) {
            app.use(enforce.HTTPS({trustProtoHeader: true}));
            app.set('trust proxy', true);
        }

        // Execute user defined handlers.
        await Promise.all(this.handlers.map(v => v(app)));

        // Error handler
        app.use(this.errorRequestHandler);

        // Start listening through a Promise!
        const startPromise: Promise<void> = new Promise((resolve, _) => {
            app.listen(port, resolve);
        });

        return await startPromise;
    }
}