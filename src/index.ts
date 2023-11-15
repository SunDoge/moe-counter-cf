import { Hono } from 'hono'
import { cors } from "hono/cors"
import { generateImage } from "./image"
import { getNum, addNum } from "./sqlite";
import { version } from "../package.json";

type Bindings = {
    DB: D1Database;
    KV: KVNamespace;
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
    const kv = c.env.KV;
    const counter = await getNum(db, name);
    const num = counter.num + Number(add);
    if (add) {
        c.executionCtx.waitUntil(addNum(db, name));
    }

    const key = `v${version}/${theme}/${length}/${pixelated}/${num}`;
    let image;
    try {
        image = await kv.get(key, {
            cacheTtl: 3600,
        });
        if (image === null) {
            image = generateImage(num, theme, length, pixelated);
            c.executionCtx.waitUntil(kv.put(key, image))
        }
    } catch (e) {
        console.log(e);
        image = generateImage(num, theme, length, pixelated);
    }

    const now = new Date();
    return c.body(image, 200, {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'no-cache',
        'ETag': key,
        'Expires': 'Thu, 01 Jan 1970 00:00:00 GMT', // ChatGPT says.
        'Last-Modified': now.toUTCString(),
    })
});

export default app
