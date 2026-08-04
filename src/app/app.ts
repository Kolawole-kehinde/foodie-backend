import express from 'express'
import { notFound } from './middlewares/notFound.js'


export function createApp () {
    const app = express()

    app.use(express.json())
    app.use(express.urlencoded({extended: true}))
    app.use(notFound)



    return app
}
