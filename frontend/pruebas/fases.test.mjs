// Ejecutar: cd frontend && node --test pruebas/fases.test.mjs   (Node >= 22.6; sin dependencias)
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  avanceFases, previasSinCompletar, avisoFechasFase, modoTramos, modoEfectivo, tramosFases, descripcionFases,
  desarrolloBloqueado, mapearErrorDesarrollo, MSG_DESARROLLO_BLOQUEADO,
} from '../src/fases.ts'
import { parseFecha, rangoEje } from '../src/timeline.ts'

const PLANTILLA = [
  [1, 'levantamiento', 'Levantamiento'], [2, 'diseno', 'Diseño'], [3, 'configuracion', 'Configuración'],
  [5, 'pruebas', 'Pruebas'], [6, 'capacitacion', 'Capacitación'], [7, 'go_live', 'Go-Live'], [8, 'cierre', 'Cierre'],
]
const DESARROLLO = [4, 'desarrollo', 'Desarrollo']
const F = ([orden, clave, nombre], estado = 'pendiente', ini = null, fin = null) =>
  ({ id: `f${orden}`, clave, nombre, orden, estado, fecha_inicio: ini, fecha_fin_plan: fin })
const siete = (estados = []) => PLANTILLA.map((t, i) => F(t, estados[i] ?? 'pendiente'))
const E = (n, estado) => Array.from({ length: n }, () => ({ estado }))

test('avanceFases: 0/7, 3/7→43, 7/8→88, 8/8→100', () => {
  assert.deepEqual(avanceFases(siete()), { completadas: 0, enCurso: 0, total: 7, pct: 0 })
  assert.equal(avanceFases([...E(3, 'completada'), ...E(4, 'pendiente')]).pct, 43)
  assert.equal(avanceFases([...E(7, 'completada'), ...E(1, 'pendiente')]).pct, 88)
  assert.equal(avanceFases(E(8, 'completada')).pct, 100)
})
test('avanceFases: vacío → null; en_curso no suma', () => {
  assert.deepEqual(avanceFases([]), { completadas: 0, enCurso: 0, total: 0, pct: null })
  const r = avanceFases([...E(2, 'completada'), ...E(5, 'en_curso')])
  assert.equal(r.completadas, 2); assert.equal(r.enCurso, 5); assert.equal(r.pct, 29)
  assert.equal(avanceFases([...E(6, 'completada'), ...E(1, 'en_curso')]).pct, 86) // 100 solo con todas
})

test('previasSinCompletar respeta el hueco de orden en 4', () => {
  const fases = siete(['completada', 'pendiente', 'en_curso', 'completada', 'pendiente'])
  // Capacitación (orden 6): previas sin completar = Diseño (2) y Configuración (3); Pruebas (5) está completada.
  assert.deepEqual(previasSinCompletar(fases, 'f6').map((f) => f.nombre), ['Diseño', 'Configuración'])
  assert.deepEqual(previasSinCompletar(fases, 'f1'), [])
  assert.deepEqual(previasSinCompletar(fases, 'no-existe'), [])
})
test('previasSinCompletar con Desarrollo (orden 4) y lista desordenada', () => {
  const fases = [F(PLANTILLA[3]), F(DESARROLLO, 'en_curso'), F(PLANTILLA[0], 'completada'), F(PLANTILLA[2])]
  assert.deepEqual(previasSinCompletar(fases, 'f5').map((f) => f.orden), [3, 4])
})

test('avisoFechasFase: dentro, fuera, proyecto sin fechas, fase con una sola fecha', () => {
  const p = { fecha_inicio: '2026-01-01', fecha_fin_plan: '2026-06-30' }
  assert.equal(avisoFechasFase({ fecha_inicio: '2026-01-01', fecha_fin_plan: '2026-06-30' }, p), null)
  assert.equal(
    avisoFechasFase({ fecha_inicio: '2025-12-15', fecha_fin_plan: '2026-02-01' }, p),
    'Estas fechas quedan fuera del plazo del proyecto (1 ene 2026 – 30 jun 2026)',
  )
  assert.ok(avisoFechasFase({ fecha_inicio: '2026-03-01', fecha_fin_plan: '2026-07-01' }, p))
  assert.equal(avisoFechasFase({ fecha_inicio: '2025-01-01', fecha_fin_plan: '2027-01-01' }, { fecha_inicio: null, fecha_fin_plan: '2026-06-30' }), null)
  assert.equal(avisoFechasFase({ fecha_inicio: '2025-01-01', fecha_fin_plan: null }, { fecha_inicio: '2026-01-01', fecha_fin_plan: null }), null)
  // Fase con una sola fecha: se compara solo esa.
  assert.equal(avisoFechasFase({ fecha_inicio: '2026-03-01', fecha_fin_plan: null }, p), null)
  assert.ok(avisoFechasFase({ fecha_inicio: null, fecha_fin_plan: '2026-08-01' }, p))
  assert.equal(avisoFechasFase({ fecha_inicio: null, fecha_fin_plan: null }, p), null)
})

const conFechas = () => PLANTILLA.map((t, i) => F(t, 'pendiente', `2026-0${i + 1}-01`, `2026-0${i + 1}-28`))

test('modoTramos: todas con fechas → fechas; una sin fecha → iguales; vacío → iguales', () => {
  assert.equal(modoTramos(conFechas()), 'fechas')
  const una = conFechas(); una[3] = { ...una[3], fecha_fin_plan: null }
  assert.equal(modoTramos(una), 'iguales')
  const invertida = conFechas(); invertida[0] = { ...invertida[0], fecha_inicio: '2026-02-01', fecha_fin_plan: '2026-01-01' }
  assert.equal(modoTramos(invertida), 'iguales')
  assert.equal(modoTramos([]), 'iguales')
})
test('modoEfectivo: fechas solo con todas las fases fechadas Y eje común', () => {
  const eje = rangoEje([{ inicio: parseFecha('2026-01-01'), fin: parseFecha('2026-12-31') }])
  assert.equal(modoEfectivo(conFechas(), eje), 'fechas')
  assert.equal(modoEfectivo(conFechas(), null), 'iguales')
  assert.equal(modoEfectivo(siete(), eje), 'iguales')
  assert.equal(modoEfectivo([], eje), 'iguales')
})

const suma = (ts) => ts.reduce((s, t) => s + t.ancho, 0)
const cerca = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`)

test('tramosFases iguales: suman el ancho de la barra y van en orden', () => {
  const ts = tramosFases(siete(), { izq: 20, ancho: 56 }, null)
  assert.equal(ts.length, 7)
  cerca(suma(ts), 56); cerca(ts[0].izq, 20); cerca(ts[6].izq + ts[6].ancho, 76)
  assert.deepEqual(ts.map((t) => t.nombre), PLANTILLA.map((t) => t[2]))
  // Sin barra (proyecto sin fechas): ancho completo.
  const completo = tramosFases([F(DESARROLLO), ...siete()], null, null)
  assert.equal(completo.length, 8); cerca(suma(completo), 100); assert.equal(completo[3].nombre, 'Desarrollo')
  // Con eje pero alguna fase sin fechas: sigue en iguales.
  const eje = rangoEje([{ inicio: parseFecha('2026-01-01'), fin: parseFecha('2026-12-31') }])
  cerca(suma(tramosFases(siete(), { izq: 0, ancho: 50 }, eje)), 50)
  assert.deepEqual(tramosFases([], null, eje), [])
})
test('tramosFases con fechas: recorta a 0–100 y ancho mínimo 1', () => {
  const eje = rangoEje([{ inicio: parseFecha('2026-01-01'), fin: parseFecha('2026-12-31') }])
  const fases = conFechas()
  fases[0] = { ...fases[0], fecha_inicio: '2025-06-01', fecha_fin_plan: '2026-01-10' } // empieza antes del eje
  fases[6] = { ...fases[6], fecha_inicio: '2026-12-20', fecha_fin_plan: '2027-03-01' } // termina después
  fases[3] = { ...fases[3], fecha_inicio: '2026-05-05', fecha_fin_plan: '2026-05-05' } // un solo día
  const ts = tramosFases(fases, { izq: 0, ancho: 100 }, eje)
  for (const t of ts) {
    assert.ok(t.izq >= 0 && t.izq + t.ancho <= 100 + 1e-9, JSON.stringify(t))
    assert.ok(t.ancho >= 1)
  }
  assert.equal(ts[0].izq, 0); cerca(ts[6].izq + ts[6].ancho, 100); assert.equal(ts[3].ancho, 1)
  // Sin eje: aunque todas tengan fechas, se reparte en partes iguales.
  cerca(suma(tramosFases(conFechas(), null, null)), 100)
})

test('descripcionFases y bloqueo de Desarrollo', () => {
  assert.equal(descripcionFases([F(PLANTILLA[1], 'en_curso'), F(PLANTILLA[0], 'completada')]), 'Levantamiento: Completada; Diseño: En curso')
  assert.equal(desarrolloBloqueado(siete()), false)
  assert.equal(desarrolloBloqueado([...siete(), F(DESARROLLO)]), false)
  assert.equal(desarrolloBloqueado([...siete(), F(DESARROLLO, 'en_curso')]), true)
  assert.equal(desarrolloBloqueado([...siete(), F(DESARROLLO, 'pendiente', '2026-01-01')]), true)
  assert.equal(mapearErrorDesarrollo('P0001: ... fase Desarrollo ...'), MSG_DESARROLLO_BLOQUEADO)
  assert.equal(mapearErrorDesarrollo('field "requiere_desarrollo" not found'), 'field "requiere_desarrollo" not found')
})
