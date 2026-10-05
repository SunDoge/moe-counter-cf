import themes from './themes'

// Keep cached SVGs separate when the rendering format changes.
export const imageVersion = 2

// Build the large data-URL fragments once per Worker isolate, not per request.
const digitDefinitions = new Map(Object.entries(themes).map(([name, theme]) => [
    name,
    theme.images.map((uri, digit) =>
        `<image id="digit-${digit}" width="${theme.width}" height="${theme.height}" href="${uri}"/>`
    ),
]))

export function generateImage(
    count: number, theme: string, length: string, pixelated: boolean
) {
    const digits = length === 'auto'
        ? String(count)
        : String(count).padStart(Number(length), '0')
    const { width, height } = themes[theme]
    const definitions = digitDefinitions.get(theme)!
    let seen = 0
    let defs = ''
    let parts = ''

    for (let i = 0; i < digits.length; i++) {
        const digit = digits.charCodeAt(i) - 48
        const bit = 1 << digit
        if (!(seen & bit)) {
            defs += definitions[digit]
            seen |= bit
        }
        parts += `<use href="#digit-${digit}" x="${i * width}"/>`
    }

    return '<?xml version="1.0" encoding="UTF-8"?>'
        + `<svg width="${digits.length * width}" height="${height}" version="1.1"`
        + ' xmlns="http://www.w3.org/2000/svg"'
        + `${pixelated ? ' style="image-rendering: pixelated"' : ''}>`
        + `<title>Moe Counter</title><defs>${defs}</defs><g>${parts}</g></svg>`
}
