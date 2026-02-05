const ClassType = require('../models/ClassType');

class ClassTypesController {
  // Listar todos los tipos de clase
  static async list(req, res) {
    const items = await ClassType.findAll();
    res.json({ classTypes: items });
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
}

module.exports = ClassTypesController;
