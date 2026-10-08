import { useEffect, useState } from 'react'
import Login from './Login'
import Proyectos from './Proyectos'
import { nhost } from './nhost'

export default function App() {
  const [sesion, setSesion] = useState(() => nhost.sessionStorage.get())

  // Se actualiza al iniciar/cerrar sesión o al refrescar el token.
  useEffect(() => nhost.sessionStorage.onChange(setSesion), [])

  if (!sesion) return <Login />

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-semibold text-slate-900">Implementaciones</span>
          <span className="text-sm text-slate-600">
            {sesion.user?.email}{' '}
            <button
              className="ml-2 text-blue-600 hover:underline"
              onClick={async () => {
                try {
                  await nhost.auth.signOut({ refreshToken: sesion.refreshToken })
                } catch {
                  /* aunque falle en el servidor, cerramos la sesión local */
                }
                nhost.sessionStorage.remove()
              }}
            >
              Salir
            </button>
          </span>
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-4">
        <Proyectos userId={sesion.user!.id} />
      </main>
    </div>
  )
}
