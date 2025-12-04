// src/services/clase.service.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Comprueba si existe solapamiento (intersección) entre el rango [horaInicio, horaFin)
 * y otros registros en la misma aula o mismo docente para el mismo día (campo dia).
 *
 * Nota: 'dia' en tu schema es String (ej: "Lunes"). Comparamos exactamente el mismo valor.
 */
async function existeSolapamiento({ dia, aulaId, docenteId, horaInicio, horaFin, excludeId = null }) {
  const conditions = {
    dia,
    AND: [
      { horaInicio: { lt: horaFin } },  // empieza antes de que termine el nuevo
      { horaFin: { gt: horaInicio } }   // termina después de que empiece el nuevo
    ]
  };

  // 1) Buscar solapamiento por AULA
  const whereAula = { ...conditions, aulaId: Number(aulaId) };
  if (excludeId) whereAula.id = { not: Number(excludeId) };

  const conflictoAula = await prisma.clase.findFirst({ where: whereAula });
  if (conflictoAula) return { tipo: 'AULA', conflicto: conflictoAula };

  // 2) Buscar solapamiento por DOCENTE
  const whereDocente = { ...conditions, docenteId: Number(docenteId) };
  if (excludeId) whereDocente.id = { not: Number(excludeId) };

  const conflictoDocente = await prisma.clase.findFirst({ where: whereDocente });
  if (conflictoDocente) return { tipo: 'DOCENTE', conflicto: conflictoDocente };

  return null;
}

module.exports = {
  // Listar todas las clases (opcionalmente filtrar por grupo/asignatura/docente/aula/dia)
  async list(filters = {}) {
    // filters puede tener: grupoId, asignaturaId, docenteId, aulaId, dia
    const where = {};
    if (filters.grupoId) where.grupoId = Number(filters.grupoId);
    if (filters.asignaturaId) where.asignaturaId = Number(filters.asignaturaId);
    if (filters.docenteId) where.docenteId = Number(filters.docenteId);
    if (filters.aulaId) where.aulaId = Number(filters.aulaId);
    if (filters.dia) where.dia = filters.dia;

    return prisma.clase.findMany({
      where,
      include: {
        docente: { include: { usuario: true } },
        asignatura: true,
        grupo: true,
        aula: true
      },
      orderBy: { horaInicio: 'asc' }
    });
  },

  async getById(id) {
    return prisma.clase.findUnique({
      where: { id: Number(id) },
      include: {
        docente: { include: { usuario: true } },
        asignatura: true,
        grupo: true,
        aula: true
      }
    });
  },

  async create(data) {
    // data: { docenteId, asignaturaId, grupoId, aulaId, dia, horaInicio, horaFin }
    const { docenteId, aulaId, dia, horaInicio, horaFin } = data;

    if (!docenteId || !aulaId || !dia || !horaInicio || !horaFin) {
      const err = new Error('Campos requeridos: docenteId, asignaturaId, grupoId, aulaId, dia, horaInicio, horaFin');
      err.status = 400;
      throw err;
    }

    // Validación temporal: horaInicio < horaFin
    const hi = new Date(horaInicio);
    const hf = new Date(horaFin);
    if (!(hi < hf)) {
      const err = new Error('horaInicio debe ser anterior a horaFin');
      err.status = 400;
      throw err;
    }

    // Comprobar solapamiento
    const conflicto = await existeSolaplamiento({ dia, aulaId, docenteId, horaInicio: hi.toISOString(), horaFin: hf.toISOString() });
    if (conflicto) {
      const err = new Error(`Conflicto de horario en ${conflicto.tipo}`);
      err.status = 400;
      err.meta = { conflicto };
      throw err;
    }

    // Crear la clase
    return prisma.clase.create({
      data: {
        docenteId: Number(docenteId),
        asignaturaId: Number(data.asignaturaId),
        grupoId: Number(data.grupoId),
        aulaId: Number(aulaId),
        dia,
        horaInicio: hi,
        horaFin: hf
      },
      include: {
        docente: { include: { usuario: true } },
        asignatura: true,
        grupo: true,
        aula: true
      }
    });
  },

  async update(id, data) {
    // data puede incluir campo horaInicio/horaFin/dia/aulaId/docenteId etc.
    const toUpdate = { ...data };

    if (data.horaInicio) toUpdate.horaInicio = new Date(data.horaInicio);
    if (data.horaFin) toUpdate.horaFin = new Date(data.horaFin);
    if (data.docenteId) toUpdate.docenteId = Number(data.docenteId);
    if (data.asignaturaId) toUpdate.asignaturaId = Number(data.asignaturaId);
    if (data.grupoId) toUpdate.grupoId = Number(data.grupoId);
    if (data.aulaId) toUpdate.aulaId = Number(data.aulaId);

    // Si se modifica horarios/dia/docente/aula -> comprobar solapamiento
    const claseActual = await prisma.clase.findUnique({ where: { id: Number(id) } });
    if (!claseActual) {
      const err = new Error('Clase no encontrada');
      err.status = 404;
      throw err;
    }

    const nuevoDia = data.dia ?? claseActual.dia;
    const nuevoAulaId = data.aulaId ?? claseActual.aulaId;
    const nuevoDocenteId = data.docenteId ?? claseActual.docenteId;
    const nuevoHoraInicio = data.horaInicio ? new Date(data.horaInicio) : claseActual.horaInicio;
    const nuevoHoraFin = data.horaFin ? new Date(data.horaFin) : claseActual.horaFin;

    if (!(new Date(nuevoHoraInicio) < new Date(nuevoHoraFin))) {
      const err = new Error('horaInicio debe ser anterior a horaFin');
      err.status = 400;
      throw err;
    }

    const conflicto = await existeSolapamiento({
      dia: nuevoDia,
      aulaId: nuevoAulaId,
      docenteId: nuevoDocenteId,
      horaInicio: new Date(nuevoHoraInicio).toISOString(),
      horaFin: new Date(nuevoHoraFin).toISOString(),
      excludeId: id
    });

    if (conflicto) {
      const err = new Error(`Conflicto de horario en ${conflicto.tipo}`);
      err.status = 400;
      err.meta = { conflicto };
      throw err;
    }

    return prisma.clase.update({
      where: { id: Number(id) },
      data: toUpdate,
      include: {
        docente: { include: { usuario: true } },
        asignatura: true,
        grupo: true,
        aula: true
      }
    });
  },

  async remove(id) {
    // Si quieres controlar referencias o permisos, hazlo aquí antes de eliminar
    return prisma.clase.delete({ where: { id: Number(id) } });
  }
};
