import { Hono } from 'hono'
import { cors } from "hono/cors"
import theme from './theme'
import { getNum, addNum } from "./sqlite";

type Bindings = {
    DB: D1Database;
}


const app = new Hono<{ Bindings: Bindings }>()

// app.use('/*', cors())
app.get('/', (c) => c.text('Hello Hono!'))
app.get('/asoul', (c) => c.body(theme.asoul.images[0]))
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
})
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
