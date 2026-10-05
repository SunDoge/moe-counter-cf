import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { Miniflare } from 'miniflare'

let mf
let db
before(async () => {
    mf = new Miniflare({
        modules: true,
        scriptPath: 'dist/index.js',
        compatibilityDate: '2026-07-01',
        d1Databases: { DB: 'counter-test' },
    })
    db = await mf.getD1Database('DB')
    await db.prepare(await readFile('schema.sql', 'utf8')).run()
})
after(async () => { await mf?.dispose() })
const request = (path, init) => mf.dispatchFetch(`http://localhost${path}`, init)
const count = async (name) => (await db.prepare('SELECT num FROM counters WHERE name = ?').bind(name).first())?.num

test('only two valid path segments reach the counter', async () => {
    for (const path of ['/favicon.ico', '/alice', '/alice/repo/extra', '/alice/repo/', '/alice//repo']) {
        assert.equal((await request(path)).status, 404, path)
    }
    for (const path of ['/alice%2Fbob/repo', '/alice/repo%2Fextra', '/alice/bad%20name']) {
        assert.equal((await request(path)).status, 400, path)
    }
    assert.equal((await request('/alice/repo', { method: 'POST' })).status, 404)
    assert.equal(await count('alice/repo'), undefined)
})

test('invalid rendering parameters do not increment', async () => {
    for (const query of ['theme=unknown', 'theme=__proto__', 'theme=constructor', 'length=999999999', 'length=-1', 'length=7abc']) {
        assert.equal((await request(`/alice/invalid?${query}`)).status, 400)
    }
    assert.equal(await count('alice/invalid'), undefined)
})

test('read-only and HEAD requests do not create counters', async () => {
    const response = await request('/alice/readonly?add=0&length=auto')
    assert.equal(response.status, 200)
    assert.equal((await response.text()).match(/<image /g).length, 1)
    const head = await request('/alice/readonly', { method: 'HEAD' })
    assert.equal(head.status, 200)
    assert.equal(await head.text(), '')
    assert.equal(await count('alice/readonly'), undefined)
})

test('concurrent increments return distinct committed values', async () => {
    const responses = await Promise.all(Array.from({ length: 20 }, () => request('/alice/concurrent?length=auto')))
    const bodies = await Promise.all(responses.map(async (response) => {
        assert.equal(response.status, 200)
        assert.equal(response.headers.get('content-type'), 'image/svg+xml; charset=utf-8')
        assert.equal(response.headers.get('cache-control'), 'no-store')
        return response.text()
    }))
    assert.equal(new Set(bodies).size, 20)
    assert.equal(await count('alice/concurrent'), 20)
    await request('/bob/concurrent')
    assert.equal(await count('bob/concurrent'), 1)
})

test('all themes generate embedded SVG images', async () => {
    for (const theme of ['asoul', 'gelbooru', 'gelbooru-h', 'moebooru', 'moebooru-h', 'rule34']) {
        const response = await request(`/alice/themes?theme=${theme}&add=0&pixelated=pixelated`)
        assert.equal(response.status, 200)
        const svg = await response.text()
        assert.equal(svg.match(/<image /g).length, 1)
        assert.equal(svg.match(/<use /g).length, 7)
        assert.match(svg, /data:image\/(gif|png);base64,/)
        assert.match(svg, /image-rendering: pixelated/)
    }
})

test('schema initialization preserves counts and deleted counters restart', async () => {
    await request('/alice/preserved')
    await db.prepare(await readFile('schema.sql', 'utf8')).run()
    assert.equal(await count('alice/preserved'), 1)
    await db.prepare('UPDATE counters SET deleted_at = CURRENT_TIMESTAMP WHERE name = ?').bind('alice/preserved').run()
    await request('/alice/preserved?add=0')
    assert.equal(await count('alice/preserved'), 1)
    await request('/alice/preserved')
    assert.equal(await count('alice/preserved'), 1)
    const row = await db.prepare('SELECT deleted_at FROM counters WHERE name = ?').bind('alice/preserved').first()
    assert.equal(row.deleted_at, null)
})


test('repeated digits share embedded data and preserve order and positions', async () => {
    await db.prepare('INSERT INTO counters (name, num) VALUES (?, ?)').bind('alice/digits', 1001002).run()
    const svg = await (await request('/alice/digits?add=0')).text()
    assert.equal(svg.match(/<image /g).length, 3)
    assert.deepEqual([...svg.matchAll(/<use href="#digit-(\d)" x="(\d+)"\/>/g)].map((m) => [m[1], Number(m[2])]),
        [...'1001002'].map((digit, i) => [digit, i * 68]))
    assert.match(svg, /<svg width="476" height="150"/)
    for (const digit of ['0', '1', '2']) {
        assert.equal(svg.split(`id="digit-${digit}"`).length - 1, 1)
    }
    // A shorter padding length must never truncate the actual count.
    const short = await (await request('/alice/digits?add=0&length=1')).text()
    assert.equal(short, svg)
})

test('padding embeds only used digits and substantially reduces repeated image bytes', async () => {
    for (const theme of ['gelbooru', 'rule34']) {
        await db.prepare('INSERT INTO counters (name, num) VALUES (?, ?)').bind(`size/${theme}`, 1).run()
        const svg = await (await request(`/size/${theme}?add=0` + `&theme=${theme}`)).text()
        const zero = await readFile(`src/themes/${theme}/0.gif`)
        const one = await readFile(`src/themes/${theme}/1.gif`)
        const previousDataSize = zero.toString('base64').length * 6 + one.toString('base64').length
        assert.equal(svg.match(/data:image/g).length, 2)
        assert.ok(Buffer.byteLength(svg) < previousDataSize * 0.35)
        const maximum = await (await request(`/size/${theme}?add=0&length=30`)).text()
        assert.equal(maximum.match(/<use /g).length, 30)
        assert.equal(maximum.match(/<image /g).length, 2)
    }
})
