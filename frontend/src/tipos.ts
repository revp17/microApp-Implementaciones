export const ESTADOS = ['planificado', 'en_curso', 'pausado', 'cerrado'] as const
export type Estado = (typeof ESTADOS)[number]

export const ETIQUETA_ESTADO: Record<Estado, string> = {
  planificado: 'Planificado',
  en_curso: 'En curso',
  pausado: 'Pausado',
  cerrado: 'Cerrado',
}

export interface Cliente {
  id: string
  nombre: string
}

export interface Proyecto {
  id: string
  nombre: string
  sistema: string | null
  fecha_inicio: string | null
  fecha_fin_plan: string | null
  estado: Estado
  cliente: Cliente
  miembros: { user_id: string; rol: 'responsable' | 'colaborador' | 'cliente' }[]
}

export const CAMPOS_PROYECTO = `id nombre sistema fecha_inicio fecha_fin_plan estado
  cliente { id nombre } miembros { user_id rol }`
