// Ejecutar: cd frontend && node --test pruebas/timeline.test.mjs   (Node >= 22.6; sin dependencias)
import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularBarra, parseFecha, rangoEje, posicion, marcasEje, resumenBarra, diasEntre } from '../src/timeline.ts'

const d = (s) => parseFecha(s)
const P = (ini, fin, estado = 'en_curso') => ({ fecha_inicio: ini, fecha_fin_plan: fin, estado })

test('parseFecha usa hora local y rechaza inválidas', () => {
  const f = d('2026-03-05')
  assert.equal(f.getDate(), 5); assert.equal(f.getHours(), 0)
  assert.equal(d('2026-02-31'), null); assert.equal(d(null), null); assert.equal(d('hola'), null)
})
test('antes de iniciar', () => {
  const r = calcularBarra(P('2026-10-20', '2026-11-20', 'planificado'), d('2026-10-10'))
  assert.deepEqual(r, { estado: 'antes', pct: 0, dias: 10 })
  assert.equal(resumenBarra(r), 'Inicia en 10 días')
})
test('en curso (mitad)', () => {
  const r = calcularBarra(P('2026-10-01', '2026-10-31'), d('2026-10-16'))
  assert.deepEqual(r, { estado: 'en_curso', pct: 50, dias: 15 })
})
test('hoy == inicio', () => {
  const r = calcularBarra(P('2026-10-09', '2026-11-09'), d('2026-10-09'))
  assert.equal(r.estado, 'en_curso'); assert.equal(r.pct, 0); assert.equal(r.dias, 31)
})
test('hoy == fin', () => {
  const r = calcularBarra(P('2026-10-01', '2026-10-09'), d('2026-10-09'))
  assert.deepEqual(r, { estado: 'en_curso', pct: 100, dias: 0 })
  assert.match(resumenBarra(r), /vence hoy/)
})
test('vencido', () => {
  const r = calcularBarra(P('2026-09-01', '2026-10-01'), d('2026-10-04'))
  assert.deepEqual(r, { estado: 'vencido', pct: 100, dias: 3 })
  assert.equal(resumenBarra(r), '3 días de retraso')
})
test('cerrado no se marca como retraso', () => {
  const r = calcularBarra(P('2026-09-01', '2026-10-01', 'cerrado'), d('2026-10-09'))
  assert.equal(r.estado, 'cerrado'); assert.equal(r.pct, 100)
})
test('fechas invertidas', () => {
  assert.equal(calcularBarra(P('2026-10-10', '2026-10-01'), d('2026-10-05')).estado, 'fechas_invertidas')
})
test('sin fechas', () => {
  assert.equal(calcularBarra(P(null, '2026-10-01'), d('2026-10-05')).estado, 'sin_fechas')
  assert.equal(calcularBarra(P('2026-10-01', null), d('2026-10-05')).estado, 'sin_fechas')
})
test('inicio == fin no divide por cero', () => {
  assert.equal(calcularBarra(P('2026-10-09', '2026-10-09'), d('2026-10-08')).estado, 'antes')
  assert.deepEqual(calcularBarra(P('2026-10-09', '2026-10-09'), d('2026-10-09')), { estado: 'en_curso', pct: 100, dias: 0 })
  assert.equal(calcularBarra(P('2026-10-09', '2026-10-09'), d('2026-10-10')).estado, 'vencido')
})
test('eje común y posiciones', () => {
  const eje = rangoEje([{ inicio: d('2026-01-01'), fin: d('2026-03-01') }, { inicio: d('2026-02-01'), fin: d('2026-12-31') }], d('2026-06-15'))
  assert.equal(diasEntre(eje.inicio, eje.fin), eje.dias)
  assert.equal(posicion(eje.inicio, eje), 0); assert.equal(posicion(eje.fin, eje), 100)
  const m = marcasEje(eje); assert.ok(m.length >= 2 && m.length <= 5)
  assert.equal(rangoEje([]), null)
})
test('marcas para un rango corto usan inicio y fin', () => {
  const m = marcasEje(rangoEje([{ inicio: d('2026-10-02'), fin: d('2026-10-20') }]))
  assert.deepEqual(m.map((x) => x.pos), [0, 100])
})
test('cruce de cambio de horario no altera días', () => {
  assert.equal(diasEntre(d('2026-03-01'), d('2026-04-01')), 31)
})
test('inicio == fin: una sola marca de eje', () => {
  const eje = rangoEje([{ inicio: d('2026-10-09'), fin: d('2026-10-09') }])
  assert.equal(eje.dias, 0)
  assert.equal(marcasEje(eje).length, 1)
  assert.equal(posicion(d('2026-10-09'), eje), 50)
})
test('99,7% no se redondea a 100% mientras queda un día', () => {
  const r = calcularBarra(P('2026-01-01', '2027-01-01'), d('2026-12-31'))
  assert.deepEqual(r, { estado: 'en_curso', pct: 99, dias: 1 })
  assert.equal(resumenBarra(r), '99% transcurrido · quedan 1 día')
})
test('0,3% con un día transcurrido muestra al menos 1%', () => {
  const r = calcularBarra(P('2026-01-01', '2027-01-01'), d('2026-01-02'))
  assert.equal(r.pct, 1)
})
