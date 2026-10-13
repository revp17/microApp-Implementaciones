import { createClient } from '@nhost/nhost-js'

export const nhost = createClient({
  subdomain: import.meta.env.VITE_NHOST_SUBDOMAIN,
  region: import.meta.env.VITE_NHOST_REGION,
})

// Consulta GraphQL directa a Nhost con el JWT del usuario (los permisos los impone Hasura).
export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const r = await nhost.graphql.request<T>({ query, variables })
  if (r.body.errors?.length) {
    const msg = r.body.errors[0].message
    if (/jwt/i.test(msg)) nhost.sessionStorage.remove() // sesión expirada/inválida -> vuelve al login
    throw new Error(msg)
  }
  return r.body.data as T
}

// Llamada a nuestro backend FastAPI con el JWT del usuario (el backend lo valida contra Nhost).
export async function api<T = void>(path: string, init: RequestInit = {}): Promise<T> {
  const sesion = await nhost.refreshSession(60)
  if (!sesion) {
    nhost.sessionStorage.remove()
    throw new Error('Sesión expirada')
  }
  const r = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${sesion.accessToken}` },
  })
  if (r.status === 401) nhost.sessionStorage.remove()
  if (!r.ok) {
    const { detail } = await r.json().catch(() => ({ detail: undefined }))
    throw new Error(typeof detail === 'string' ? detail : `Error ${r.status}`)
  }
  return (r.status === 204 ? undefined : await r.json()) as T
}

// Mensaje legible a partir de errores de Auth (FetchError) o GraphQL (Error).
export function mensajeError(e: unknown): string {
  const body = (e as { body?: { message?: string } })?.body
  return body?.message ?? (e instanceof Error ? e.message : 'Error desconocido')
}
