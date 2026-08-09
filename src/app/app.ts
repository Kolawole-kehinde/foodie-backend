import express from 'express'
import { notFound } from '../middlewares/notFound.js'
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from '../docs/swagger.js';
import { errorHandler } from '../middlewares/errorHandler.js';





export function createApp () {
    
    const app = express()
    app.set("trust proxy", true);

    app.use(express.json())
    app.use(express.urlencoded({extended: true}))
    app.use("/docs",swaggerUi.serve,
  swaggerUi.setup(swaggerSpec)
);
    // 404 MUST come after all routes
app.use(notFound);

// Global error handler MUST be last
app.use(errorHandler);






    return app
}
