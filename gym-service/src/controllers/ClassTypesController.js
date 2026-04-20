const ClassType = require('../models/ClassType');

class ClassTypesController {
  // Listar todos los tipos de clase
  static async list(req, res) {
    try {
      const includeInactiveRequested = String(req.query?.include_inactive || '').toLowerCase() === 'true';
      const includeInactive = includeInactiveRequested && req.user?.role === 'admin';
      const items = await ClassType.findAll({ includeInactive });
      res.json({ classTypes: items });
    } catch (error) {
      console.error('Error listando tipos de clase:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Crear un nuevo tipo de clase
  static async create(req, res) {
    const { name, description } = req.body;

    if (!name || String(name).trim() === '') {
      return res.status(400).json({ error: 'name es requerido' });
    }

    try {
      const created = await ClassType.create({ name: name.trim(), description });
      res.status(201).json({ message: 'Tipo de clase creado', classType: created });
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'Ese tipo de clase ya existe' });
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Actualizar tipo de clase (solo admin)
  static async update(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Id de tipo de clase invalido' });
    }

    const payload = {};
    if (req.body?.name !== undefined) {
      const name = String(req.body.name || '').trim();
      if (!name) return res.status(400).json({ error: 'name no puede estar vacio' });
      payload.name = name;
    }
    if (req.body?.description !== undefined) {
      payload.description = req.body.description;
    }

    try {
      const updated = await ClassType.update(id, payload);
      if (!updated) return res.status(404).json({ error: 'Tipo de clase no encontrado' });
      return res.json({ message: 'Tipo de clase actualizado', classType: updated });
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Ese tipo de clase ya existe' });
      console.error('Error actualizando tipo de clase:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Eliminar tipo de clase (soft delete, solo admin)
  static async remove(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Id de tipo de clase invalido' });
    }

    try {
      const removed = await ClassType.remove(id);
      if (!removed) return res.status(404).json({ error: 'Tipo de clase no encontrado' });
      return res.json({ message: 'Tipo de clase eliminado', classType: removed });
    } catch (error) {
      console.error('Error eliminando tipo de clase:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
}

module.exports = ClassTypesController;
