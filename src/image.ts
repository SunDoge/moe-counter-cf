

function generateImage(
    count: number, theme: string, length: number, pixelated: boolean
) {
    let nums: string[];
    if (length === undefined || length === -1) {
        nums = count.toString().split('');
    } else {
        nums = count.toString().padStart(length, '0').split('')
    }
    
}


