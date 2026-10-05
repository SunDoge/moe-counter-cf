import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { generateImage, imageVersion } from './image'
import { createDatabase, getNum, addNum } from './sqlite'
import themes from './themes'
import { version } from '../package.json'

type Bindings = {
    DB: D1Database
    KV?: KVNamespace
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/*', cors())
app.get('/', (c) => c.text('Moe Counter CF — /username/reponame'))
app.get('/:username/:reponame', async (c) => {
    const { username, reponame } = c.req.param()
    // Validate decoded parameters too, so encoded slashes cannot bypass the route shape.
    if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(username)
        || !/^[a-zA-Z0-9._-]{1,100}$/.test(reponame)
        || reponame === '.' || reponame === '..') {
        return c.text('Invalid username or repository name', 400)
    }

    const theme = c.req.query('theme') || 'gelbooru'
    const length = c.req.query('length') || '7'
    if (!Object.hasOwn(themes, theme)) {
        return c.text('Unknown theme', 400)
    }
    if (length !== 'auto' && !/^(?:[1-9]|[12][0-9]|30)$/.test(length)) {
        return c.text('Length must be auto or an integer from 1 to 30', 400)
    }

    const name = `${username}/${reponame}`
    const add = c.req.method !== 'HEAD' && c.req.query('add') !== '0'
    const pixelated = c.req.query('pixelated') === 'pixelated'
    const db = createDatabase(c.env.DB)
    const { num } = await (add ? addNum(db, name) : getNum(db, name))

    const key = `v${version}/svg${imageVersion}/${theme}/${length}/${pixelated}/${num}`
    const kv = c.env.KV
    let image: string | null = null
    if (kv) {
        try {
            image = await kv.get(key, { cacheTtl: 3600 })
        } catch (error) {
            console.error('SVG cache read failed', error)
        }
    }
    if (image === null) {
        image = generateImage(num, theme, length, pixelated)
        if (kv) {
            c.executionCtx.waitUntil(kv.put(key, image).catch((error) => {
                console.error('SVG cache write failed', error)
            }))
        }
    }

    return c.body(image, 200, {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
    })
})

export default app
