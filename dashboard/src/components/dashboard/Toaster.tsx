import { useEffect, useState } from 'react'
import { Toaster as SonnerToaster } from 'sonner'

function resolveTheme(): 'light' | 'dark' {
    if (typeof document === 'undefined') {
        return 'dark'
    }
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function ThemeToaster() {
    const [theme, setTheme] = useState<'light' | 'dark'>(() => resolveTheme())

    useEffect(() => {
        const observer = new MutationObserver(() => setTheme(resolveTheme()))
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        })
        return () => observer.disconnect()
    }, [])

    return (
        <SonnerToaster
            theme={theme}
            position="top-right"
            offset="72px"
            richColors
            closeButton
            toastOptions={{ style: { fontFamily: 'Manrope, sans-serif', fontSize: '13px' } }}
        />
    )
}