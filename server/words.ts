/**
 * Banco de palabras y pistas para bots.
 *
 * Las palabras son conceptos de desarrollo de software y gestión de
 * proyectos; se muestran tal cual en el juego, por eso los acentos son
 * intencionales.
 */

import type { SecretWord, WordCategory } from './types.ts';

export const WORD_BANK: Record<WordCategory, string[]> = {
  'Metodologías Ágiles': [
    'Scrum',
    'Kanban',
    'Sprint',
    'Backlog',
    'Retrospectiva',
    'Standup Daily',
    'Story Points',
    'Velocity',
    'User Story',
    'Product Owner',
    'Scrum Master'
  ],
  'Desarrollo & Git': [
    'Pull Request',
    'Git Commit',
    'Merge Conflict',
    'Refactorización',
    'Bug',
    'Code Review',
    'Deploy',
    'Branch',
    'Figma',
    'TypeScript'
  ],
  'Arquitectura & Cloud': [
    'Docker',
    'Servidor',
    'Base de Datos',
    'API REST',
    'WebSockets',
    'Microservicios',
    'Frontend',
    'Backend',
    'Cloud',
    'CI/CD'
  ],
  'Conceptos de Gestión': [
    'Presupuesto',
    'Hito (Milestone)',
    'Ruta Crítica',
    'Riesgo',
    'SLA',
    'KPI',
    'MVP',
    'Cronograma',
    'Alcance',
    'Stakeholder'
  ]
};

/** Pistas realistas por palabra, para que los bots parezcan tripulantes. */
export const SAMPLE_HINTS: Record<string, string[]> = {
  'Scrum': ['Iterativo', 'Reuniones diarias', 'Marco ágil', 'Sprints de 2 semanas'],
  'Kanban': ['Tablero visual', 'Columnas de estado', 'WIP Limit', 'Flujo continuo'],
  'Sprint': ['Bloque de tiempo', 'Entrega de valor', 'Objetivo claro', 'Planificación inicial'],
  'Backlog': ['Lista de tareas', 'Priorizado', 'Historias pendientes', 'Gestión de requisitos'],
  'Retrospectiva': ['Mejora continua', 'Fin de iteración', 'Feedback de equipo', 'Qué funcionó bien'],
  'Standup Daily': ['15 minutos', 'De pie', 'Tres preguntas', 'Sincronización diaria'],
  'Story Points': ['Estimación relativa', 'Secuencia Fibonacci', 'Esfuerzo del equipo', 'Complejidad'],
  'Velocity': ['Métrica de rendimiento', 'Puntos completados', 'Capacidad futura', 'Promedio de equipo'],
  'User Story': ['Como usuario quiero...', 'Criterio de aceptación', 'Requisito funcional', 'Valor de negocio'],
  'Product Owner': ['Voz del cliente', 'Prioriza el backlog', 'Define la visión', 'Maximiza el valor'],
  'Scrum Master': ['Facilitador', 'Elimina impedimentos', 'Guía el proceso', 'Líder al servicio'],
  'Pull Request': ['Revisión de código', 'Fusión de ramas', 'Comentarios en GitHub', 'Aprobación previa'],
  'Git Commit': ['Guardado local', 'Mensaje claro', 'Historial de cambios', 'Snapshot de código'],
  'Merge Conflict': ['Ramas divergentes', 'Resolver a mano', 'Choque de código', 'Git rebase'],
  'Refactorización': ['Limpiar código', 'Sin cambiar comportamiento', 'Deuda técnica', 'Mejorar legibilidad'],
  'Bug': ['Fallo inesperado', 'Error de ejecución', 'Ticket prioritario', 'Debuguear'],
  'Code Review': ['Inspección por pares', 'Calidad de software', 'Sugerencias de mejora', 'Aprobación de PR'],
  'Deploy': ['Paso a producción', 'Lanzamiento', 'Servidor vivo', 'Publicación de versión'],
  'Branch': ['Rama paralela', 'Desarrollo de feature', 'Git checkout', 'Aislamiento de código'],
  'Figma': ['Diseño UI/UX', 'Prototipos', 'Vistas interactivas', 'Wireframes'],
  'TypeScript': ['Tipado estático', 'Superconjunto de JS', 'Errores en compilación', 'Interfaces y tipos'],
  'Docker': ['Contenedores', 'Dockerfiles', 'Aislamiento de entorno', 'Imágenes livianas'],
  'Servidor': ['Hosting backend', 'Peticiones HTTP', 'Respuesta 200 OK', 'Infraestructura'],
  'Base de Datos': ['Tablas y consultas', 'SQL / NoSQL', 'Persistencia de datos', 'Registros'],
  'API REST': ['Endpoints', 'GET y POST', 'JSON de respuesta', 'Arquitectura cliente-servidor'],
  'WebSockets': ['Tiempo real', 'Canal bidireccional', 'Conexión persistente', 'Eventos socket'],
  'Microservicios': ['Servicios desacoplados', 'Despliegue independiente', 'Arquitectura distribuida', 'Escalabilidad'],
  'Frontend': ['Interfaz de usuario', 'HTML/CSS/React', 'Experiencia visual', 'Lado del cliente'],
  'Backend': ['Lógica de negocio', 'Controladores y BD', 'Seguridad y autenticación', 'Lado del servidor'],
  'Cloud': ['AWS / GCP / Azure', 'Sin servidor físico', 'Escalabilidad en la nube', 'Recursos remotos'],
  'CI/CD': ['Integración continua', 'Despliegue automatizado', 'Pipelines de testeo', 'Builds automáticos'],
  'Presupuesto': ['Cálculo de costos', 'Recursos financieros', 'Límite de gasto', 'Estimación económica'],
  'Hito (Milestone)': ['Entregable clave', 'Fecha crítica', 'Punto de control', 'Fase completada'],
  'Ruta Crítica': ['Secuencia más larga', 'Sin margen de demora', 'CPM', 'Riesgo de retraso'],
  'Riesgo': ['Plan de mitigación', 'Incertidumbre', 'Impacto y probabilidad', 'Matriz de riesgos'],
  'SLA': ['Acuerdo de nivel de servicio', 'Tiempo de respuesta', 'Garantía de disponibilidad', 'Compromiso de calidad'],
  'KPI': ['Métrica clave', 'Indicador de éxito', 'Medición de desempeño', 'Objetivo cuantitativo'],
  'MVP': ['Producto mínimo viable', 'Versión inicial', 'Validación temprana', 'Funciones esenciales'],
  'Cronograma': ['Diagrama de Gantt', 'Fechas estimadas', 'Planificación temporal', 'Calendario de proyecto'],
  'Alcance': ['Definición del proyecto', 'Límites del trabajo', 'Entregables incluidos', 'Evitar desbordamiento'],
  'Stakeholder': ['Partes interesadas', 'Clientes y gerentes', 'Inversores del proyecto', 'Expectativas de negocio']
};

/**
 * Pistas genéricas y ambiguas para el impostor: sirven para cualquier
 * categoría sin delatar que no conoce la palabra.
 */
export const GENERIC_IMPOSTOR_HINTS: string[] = [
  'Es fundamental para el éxito del proyecto.',
  'Se utiliza a diario en el equipo de desarrollo.',
  'Mejora la calidad del trabajo y la entrega.',
  'Ayuda a organizar mejor las tareas del sistema.',
  'Es una buena práctica en ingeniería de software.',
  'Permite optimizar el flujo de trabajo.',
  'Es clave en la gestión moderna de proyectos.'
];

/** Devuelve una palabra aleatoria con su categoría. */
export function getRandomWord(): SecretWord {
  const categories = Object.keys(WORD_BANK) as WordCategory[];
  const category = categories[Math.floor(Math.random() * categories.length)];
  const words = WORD_BANK[category];
  return { category, word: words[Math.floor(Math.random() * words.length)] };
}

/** Pista de bot: genérica si es impostor, realista de la palabra si es tripulante. */
export function getBotHint(word: string, isImpostor: boolean): string {
  if (isImpostor) {
    return GENERIC_IMPOSTOR_HINTS[Math.floor(Math.random() * GENERIC_IMPOSTOR_HINTS.length)];
  }
  const hints = SAMPLE_HINTS[word] ?? ['Concepto clave de la disciplina', 'Herramienta de software importante'];
  return hints[Math.floor(Math.random() * hints.length)];
}
