import { Hono } from 'hono'
import { cors } from "hono/cors"
import { generateImage } from "./image"
import { getNum, addNum } from "./sqlite";

type Bindings = {
    DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/*', cors())
app.get('/', (c) => c.text('Hello Hono!'))
app.get('/:name', async (c) => {
    const name = c.req.param('name');
    const theme = c.req.query('theme') || 'gelbooru'
    const length = c.req.query('length') || '7'
    const add = c.req.query('add') !== '0'
    const pixelated = c.req.query('pixelated') === 'pixelated'

    const db = c.env.DB;
    const counter = await getNum(db, name);

    let image;
    if (add) {
        image = generateImage(counter.num + 1, theme, length, pixelated);
        c.executionCtx.waitUntil(addNum(db, name));
    } else {
        image = generateImage(counter.num, theme, length, pixelated);
    }

    const nowAsUtcString = (new Date()).toUTCString();
    return c.body(image, 200, {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'no-cache',
        'ETag': counter.num.toString(),
        'Expires': nowAsUtcString,
        'Last-Modified': nowAsUtcString,
    })
});

export default app
