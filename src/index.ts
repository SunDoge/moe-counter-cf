import { Hono } from 'hono'
import { cors } from "hono/cors"
import { generateImage } from "./image"

import { getNum, addNum } from "./sqlite";

type Bindings = {
    DB: D1Database;
}


const app = new Hono<{ Bindings: Bindings }>()

// app.use('/*', cors())
app.get('/', (c) => c.text('Hello Hono!'))
app.get('/api/:name', async (c) => {
    const name = c.req.param("name")
    const add = c.req.query('add')
    console.log(name)
    const counter = await getNum(c.env.DB, name);

    if (add !== '0') {
        c.executionCtx.waitUntil(addNum(c.env.DB, name))
    }

    // await setNum(c.env.DB, name, 10)
    return c.text(`name: ${name}, num: ${counter.num}`)
});


app.get('/:name', async (c) => {
    const name = c.req.param('name');
    const theme = c.req.query('theme') || 'gelbooru'
    const length = c.req.query('length') || 'auto'
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
    console.log(image)
    return c.body(image, 200, {
        'Content-Type': 'image/svg+xml; charset=utf-8',
    })
});

// app.get("/:id", async (c) => {
//     const id = c.req.param("id");
//     const add = parseInt(c.req.query('add') || '1')

//     const count = Number.parseInt(await c.env.KV.get(id) || "0");

//     if (add !== 0) {
//         c.executionCtx.waitUntil(
//             c.env.KV.put(id, (count + 1).toString())
//         )
//     }

//     // c.header("Content-Type", 'image/svg+xml; charset=utf-8');
//     return c.body("asd", 200, {
//         'Content-Type': 'image/svg+xml; charset=utf-8',
//     })
// })



export default app
