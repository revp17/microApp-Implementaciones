// Ejecutar: cd frontend && node --test pruebas/timeline.test.mjs   (Node >= 22.6; sin dependencias)
import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularBarra, parseFecha, rangoEje, posicion, marcasEje, diasEntre } from '../src/timeline.ts'

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
  assert.equal(restanteBarra(r), 'Inicia en 10 días')
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
  assert.equal(restanteBarra(r), 'Vence hoy')
})
test('vencido', () => {
  const r = calcularBarra(P('2026-09-01', '2026-10-01'), d('2026-10-04'))
  assert.deepEqual(r, { estado: 'vencido', pct: 100, dias: 3 })
  assert.equal(restanteBarra(r), '3 días de retraso')
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
  assert.equal(restanteBarra(r), 'Quedan 1 día')
})
test('0,3% con un día transcurrido muestra al menos 1%', () => {
  const r = calcularBarra(P('2026-01-01', '2027-01-01'), d('2026-01-02'))
  assert.equal(r.pct, 1)
})
import { diaDelPlazo, tramoRetraso, restanteBarra, tramoBarra, lugarPorcentaje, porcentajeVisible } from '../src/timeline.ts'
test('día X de Y del plazo (inclusivo)', () => {
  assert.deepEqual(diaDelPlazo(d('2026-10-01'), d('2026-10-31'), d('2026-10-01')), { dia: 1, total: 31 })
  assert.deepEqual(diaDelPlazo(d('2026-10-01'), d('2026-10-31'), d('2026-10-19')), { dia: 19, total: 31 })
  assert.deepEqual(diaDelPlazo(d('2026-10-01'), d('2026-10-31'), d('2026-12-01')), { dia: 31, total: 31 })
  assert.deepEqual(diaDelPlazo(d('2026-10-01'), d('2026-10-31'), d('2026-09-01')), { dia: 0, total: 31 })
  assert.deepEqual(diaDelPlazo(d('2026-10-09'), d('2026-10-09'), d('2026-10-09')), { dia: 1, total: 1 })
  assert.equal(diaDelPlazo(d('2026-10-10'), d('2026-10-01'), d('2026-10-05')), null)
})
test('tramo de retraso entre fin y hoy dentro del eje', () => {
  const eje = rangoEje([{ inicio: d('2026-01-01'), fin: d('2026-01-11') }], d('2026-01-21'))
  const t = tramoRetraso(d('2026-01-11'), d('2026-01-21'), eje)
  assert.equal(Math.round(t.izq), 50); assert.equal(Math.round(t.ancho), 50)
  assert.equal(tramoRetraso(d('2026-01-11'), d('2026-01-11'), eje), null)
  assert.equal(tramoRetraso(d('2026-01-11'), d('2026-01-05'), eje), null)
})
test('texto de plazo restante', () => {
  assert.equal(restanteBarra({ estado: 'en_curso', pct: 40, dias: 1 }), 'Quedan 1 día')
  assert.equal(restanteBarra({ estado: 'en_curso', pct: 100, dias: 0 }), 'Vence hoy')
  assert.equal(restanteBarra({ estado: 'vencido', pct: 100, dias: 3 }), '3 días de retraso')
  assert.equal(restanteBarra({ estado: 'antes', pct: 0, dias: 5 }), 'Inicia en 5 días')
})

test('barra de 1 día en el borde derecho no sale del carril', () => {
  const eje = rangoEje([{ inicio: d('2026-01-01'), fin: d('2026-12-31') }, { inicio: d('2026-12-31'), fin: d('2026-12-31') }])
  const t = tramoBarra(d('2026-12-31'), d('2026-12-31'), eje)
  assert.equal(t.ancho, 1)
  assert.equal(t.izq + t.ancho, 100)
  const normal = tramoBarra(d('2026-01-01'), d('2026-07-01'), eje)
  assert.equal(normal.izq, 0); assert.ok(normal.ancho > 40 && normal.ancho < 60)
})
test('el % solo se dibuja dentro si hay ancho real', () => {
  // caso de la auditoría: barra ~21% del eje, avance 26% -> relleno ~5,5% (no cabe), pista restante ~15,5% (texto oscuro)
  assert.equal(lugarPorcentaje(21, 26), 'pista')
  assert.equal(lugarPorcentaje(21, 60), null)
  assert.equal(lugarPorcentaje(100, 52), 'relleno')
  assert.equal(lugarPorcentaje(100, 5), 'pista')
  assert.equal(lugarPorcentaje(60, 0), 'pista')
  assert.equal(lugarPorcentaje(14, 100), null)
})
test('cerrado no muestra porcentaje', () => {
  const cerrado = calcularBarra(P('2026-01-01', '2026-06-01', 'cerrado'), d('2026-10-11'))
  assert.equal(porcentajeVisible(cerrado), null)
  assert.equal(porcentajeVisible(calcularBarra(P('2026-10-01', '2026-10-31'), d('2026-10-16'))), 50)
})
test('marcas del eje respetan el máximo pedido (anchos estrechos)', () => {
  const eje = rangoEje([{ inicio: d('2026-06-15'), fin: d('2027-03-20') }])
  const ancho = marcasEje(eje, 5)
  const estrecho = marcasEje(eje, 3)
  assert.ok(estrecho.length >= 2 && estrecho.length <= 3)
  assert.ok(estrecho.length <= ancho.length)
  assert.deepEqual(marcasEje(eje, 1).map((m) => m.pos), [0, 100])
})
