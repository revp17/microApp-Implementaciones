import { useState } from 'react'
import { mensajeError, nhost } from './nhost'

export default function Login() {
  const [modo, setModo] = useState<'login' | 'registro'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [cargando, setCargando] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setAviso('')
    setCargando(true)
    try {
      if (modo === 'login') {
        await nhost.auth.signInEmailPassword({ email, password })
      } else {
        const r = await nhost.auth.signUpEmailPassword({ email, password })
        if (!r.body.session) setAviso('Cuenta creada. Revisa tu correo para verificarla y luego inicia sesión.')
      }
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <form onSubmit={enviar} className="w-full max-w-sm bg-white rounded-lg shadow p-6 space-y-4">
        <h1 className="text-xl font-semibold text-slate-900">Implementaciones</h1>
        <h2 className="text-slate-600">{modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h2>
        <input className="input" type="email" placeholder="Correo" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" type="password" placeholder="Contraseña (mín. 9 caracteres)" required minLength={9} value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {aviso && <p className="text-sm text-green-700">{aviso}</p>}
        <button className="btn w-full" disabled={cargando}>{modo === 'login' ? 'Entrar' : 'Registrarme'}</button>
        <button type="button" className="text-sm text-blue-600 hover:underline" onClick={() => { setModo(modo === 'login' ? 'registro' : 'login'); setError(''); setAviso('') }}>
          {modo === 'login' ? '¿No tienes cuenta? Regístrate' : 'Ya tengo cuenta'}
        </button>
      </form>
    </main>
  )
}
