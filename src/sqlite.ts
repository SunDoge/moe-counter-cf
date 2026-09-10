import { D1Dialect } from '@sundoge/kysely-d1'
import { Kysely, sql, type Generated } from 'kysely'

interface CounterTable {
    id: Generated<number>
    name: string
    num: Generated<number>
    created_at: Generated<string>
    updated_at: Generated<string>
    deleted_at: Generated<string | null>
}

export function createDatabase(database: D1Database) {
    return new Kysely<{ counters: CounterTable }>({
        dialect: new D1Dialect({ database }),
    })
}

type Database = ReturnType<typeof createDatabase>

export async function getNum(db: Database, name: string) {
    return await db.selectFrom('counters')
        .select(['name', 'num'])
        .where('name', '=', name)
        .where('deleted_at', 'is', null)
        .executeTakeFirst() ?? { name, num: 0 }
}

export async function addNum(db: Database, name: string) {
    // Return the committed value in the same statement, including concurrent requests.
    return db.insertInto('counters')
        .values({ name, num: 1 })
        .onConflict((oc) => oc.column('name').doUpdateSet((eb) => ({
            num: eb.case().when('counters.deleted_at', 'is', null)
                .then(eb('counters.num', '+', 1)).else(1).end(),
            updated_at: sql<string>`CURRENT_TIMESTAMP`,
            deleted_at: null,
        })))
        .returning(['name', 'num'])
        .executeTakeFirstOrThrow()
}
