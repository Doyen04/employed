

function workerEnv(): { url: string; apiKey: string } {
    return {
        url: (process.env.WORKER_URL ?? '').replace(/\/+$/, ''),
        apiKey: process.env.WORKER_API_KEY ?? '',
    }
}

export async function workerFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const { url, apiKey } = workerEnv()
    if (!url || !apiKey) {
        throw new Error('WORKER_URL and WORKER_API_KEY are not configured')
    }

    const response = await fetch(`${url}${path}`, {
        ...init,
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${apiKey}`,
            ...(init?.headers ?? {}),
        },
    })

    if (!response.ok) {
        let message = `worker ${init?.method ?? 'GET'} ${path} → ${response.status}`
        try {
            const body = (await response.json()) as { error?: string }
            if (body.error) message = body.error
        } catch {
            // non-JSON error body — keep the generic message
        }
        throw new Error(message)
    }

    if (response.status === 204) return undefined as T
    return (await response.json()) as T
}