// src/controllers/clase.controller.js
const claseService = require('../services/clase.service');

exports.getAll = async (req, res) => {
  try {
    const filters = {
      grupoId: req.query.grupoId,
      asignaturaId: req.query.asignaturaId,
      docenteId: req.query.docenteId,
      aulaId: req.query.aulaId,
      dia: req.query.dia
    };
    const clases = await claseService.list(filters);
    res.json(clases);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ message: err.message || 'Error al obtener clases' });
  }
};

exports.getById = async (req, res) => {
  try {
    const clase = await claseService.getById(req.params.id);
    if (!clase) return res.status(404).json({ message: 'Clase no encontrada' });
    res.json(clase);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ message: err.message || 'Error al obtener clase' });
  }
};

exports.create = async (req, res) => {
  try {
    const created = await claseService.create(req.body);
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(err.status || 400).json({ message: err.message, meta: err.meta ?? null });
  }
};

exports.update = async (req, res) => {
  try {
    const updated = await claseService.update(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(err.status || 400).json({ message: err.message, meta: err.meta ?? null });
  }
};

exports.remove = async (req, res) => {
  try {
    await claseService.remove(req.params.id);
    res.json({ message: 'Clase eliminada' });
  } catch (err) {
    console.error(err);
    res.status(err.status || 400).json({ message: err.message || 'Error al eliminar clase' });
  }
};
