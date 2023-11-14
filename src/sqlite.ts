
type Counter = {
    name: string,
    num: number,
}

export async function getNum(db: D1Database, name: string) {
    const stmt = db.prepare("SELECT name, num from counters WHERE name = ?");
    const { results } = await stmt.bind(name).all();
    if (results.length > 0) {
        return results[0] as Counter;
    } else {
        return { name, num: 0 };
    }
}


export async function setNum(db: D1Database, name: string, num: number) {
    const stmt = db.prepare(`INSERT INTO counters(name, num) 
    VALUES(?1, ?2) 
    ON CONFLICT(name) DO 
    UPDATE SET num = ?2`);
    const info = await stmt.bind(name, num).run();
    return info.success;
}
