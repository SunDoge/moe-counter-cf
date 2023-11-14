import themes from './themes'

export function generateImage(
    count: number, theme: string, length: string, pixelated: boolean
) {
    let nums: string[];
    if (length === 'auto') {
        nums = count.toString().split('');
    } else {
        nums = count.toString().padStart(Number.parseInt(length), '0').split('')
    }

    const { width, height, images } = themes[theme];

    let x = 0;
    const parts = nums.reduce((prev, curr) => {
        const uri = images[Number.parseInt(curr)];
        const image = `<image x="${x}" y="0" width="${width}" height="${height}" href="${uri}"/>`;
        x += width;
        return prev + image;
    }, '');

    return (
        '<?xml version="1.0" encoding="UTF-8"?>' +
        `<svg width="${x}" height="${height}" version="1.1"` +
        ' xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"' +
        `${pixelated ? ' style="image-rendering: pixelated"' : ''}>` +
        `<title>Moe Counter</title><g>${parts}</g></svg>`
    )
}


