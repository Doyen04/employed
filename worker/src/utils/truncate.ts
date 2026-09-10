export function truncate(text: string, max: number): string {
    return text.length > max ? `${text.slice(0, max)}\u2026` : text
}
