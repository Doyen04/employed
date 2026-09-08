export function matchesCondition(
    condition: unknown,
    output: Record<string, unknown>,
): boolean {
    if (typeof condition !== 'object' || condition === null || Array.isArray(condition)) {
        return false
    }

    const pairs = condition as Record<string, unknown>

    return Object.entries(pairs).every(([key, expected]) => {
        const actual = output[key]
        if (Array.isArray(expected)) return expected.includes(actual)
        return actual === expected
    })
}