
type Counter = {
    name: string,
    num: number,
}

export async function getNum(db: D1Database, name: string) {
    const stmt = db.prepare("SELECT name, num from counters WHERE name = ? AND deleted_at IS NULL");
    const { results } = await stmt.bind(name).all();
    console.log(results)
    if (results.length > 0) {
        return results[0] as Counter;
    } else {
        return { name, num: 0 };
    }
}


export async function addNum(db: D1Database, name: string) {
    const stmt = db.prepare(`INSERT INTO counters(name, num) 
    VALUES(?1, 1) 
    ON CONFLICT(name) DO 
    UPDATE SET num = num + 1, updated_at = CURRENT_TIMESTAMP`);
    const info = await stmt.bind(name).run();
    return info.success;
}
