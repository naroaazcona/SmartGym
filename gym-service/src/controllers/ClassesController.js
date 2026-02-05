const ClassSession = require('../models/ClassSession');

class ClassesController {

  //Listar todas las clases con filtros opcionales de fecha
  static async list(req, res) {
    try {
      const { from, to } = req.query;
      const classes = await ClassSession.findAll({ from, to });
      res.json({ classes });
    } catch (err) {
      console.error('Error listando clases:', err);
      res.status(500).json({ error: 'Error al listar clases' });
    }
  }

  //Obtener detalles de una clase por id
  static async get(req, res) {
    try{
       const item = await ClassSession.findById(req.params.id);
        if (!item) return res.status(404).json({ error: 'Clase no encontrada' });
        res.json({ class: item });
    }
    catch(err){
        res.status(500).json({ error: 'Error al obtener la clase' });
    }
  }

  //Crear nueva clase (roles: admin, trainer)
  static async create(req, res) {
    try {
      const { class_type_id, starts_at, ends_at, capacity, instructor_name, location, trainer_user_id, description } = req.body;

      if (!class_type_id || !starts_at || !ends_at || !capacity) {
        return res.status(400).json({ error: 'id de la clase, cuando empieza, cuando termina y la capacidad son requeridos' });
      }

      let finalTrainerUserId = null;

      if (req.user.role === 'trainer') {
        finalTrainerUserId = req.user.id; //siempre el suyo
      } else if (req.user.role === 'admin') {
        if (!trainer_user_id) {
          return res.status(400).json({ error: 'id del entrenador es obligatorio cuando crea un admin' });
        }
        finalTrainerUserId = Number(trainer_user_id);
      } else {
        return res.status(403).json({ error: 'No tienes permisos para crear clases' });
      }

      const created = await ClassSession.create({
        class_type_id,
        trainer_user_id: finalTrainerUserId,
        starts_at,
        ends_at,
        capacity,
        instructor_name,
        location,
        description
      });

      res.status(201).json({ message: 'Clase creada', class: created });
    } catch (err) {
      console.error('Error creando clase:', err);
      res.status(500).json({ error: 'Error al crear la clase' });
    }
  }

  //Reservar plaza en clase
  static async reserve(req, res) {
    try {
      const classId = Number(req.params.id);
      const result = await ClassSession.reserve(classId, req.user.id);

      if (!result.ok) return res.status(400).json({ error: result.error });
      res.status(201).json({ message: 'Reserva confirmada', reservation: result.reservation });
    } catch (err) {
      console.error('Error reservando clase:', err);
      res.status(500).json({ error: 'Error al reservar plaza' });
    }
  }

  //Cancelar reserva de una clase
  static async cancel(req, res) {
    try {
      const classId = Number(req.params.id);
      const cancelled = await ClassSession.cancel(classId, req.user.id);

      if (!cancelled) return res.status(404).json({ error: 'No tienes una reserva hecha para cancelar' });
      res.json({ message: 'Reserva cancelada', reservation: cancelled });
    } catch (err) {
      console.error('Error cancelando reserva:', err);
      res.status(500).json({ error: 'Error al cancelar la reserva' });
    }
  }

  //Listar miembros de una clase (roles: admin, trainer)
  static async reservations(req, res) {
    try {
      const classId = Number(req.params.id);

      const cls = await ClassSession.findById(classId);
      if (!cls) return res.status(404).json({ error: 'Clase no encontrada' });

      // solo admin o el trainer asignado
      if (req.user.role === 'admin') {
        return res.json({ reservations: await ClassSession.listReservations(classId) });
      }
      if (req.user.role === 'trainer') {
        if (cls.trainer_user_id !== req.user.id) {
          return res.status(403).json({ error: 'No tienes permisos' });
        }
        return res.json({ reservations: await ClassSession.listReservations(classId) });
      }

      return res.status(403).json({ error: 'No tienes permisos' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al obtener reservas' });
    }
  }

  //Actualizar clase (roles que pueden hacerlo: admin, trainer)
  static async update(req, res) {
  try {
    const classId = Number(req.params.id);
    const cls = await ClassSession.findById(classId);

    if (!cls) {
      return res.status(404).json({ error: 'Clase no encontrada' });
    }

    // Trainer solo puede editar sus clases
    if (req.user.role === 'trainer' && cls.trainer_user_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permisos para editar esta clase' });
    }

    const updated = await ClassSession.update(classId, req.body);
    res.json({ message: 'Clase actualizada', class: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar la clase' });
  }
}

  //Eliminar clase (roles que pueden hacerlo: admin, trainer)
  static async remove(req, res) {
    try {
      const classId = Number(req.params.id);
      const cls = await ClassSession.findById(classId);

      if (!cls) {
        return res.status(404).json({ error: 'Clase no encontrada' });
      }

      // Trainer solo puede borrar sus clases
      if (req.user.role === 'trainer' && cls.trainer_user_id !== req.user.id) {
        return res.status(403).json({ error: 'No tienes permisos para eliminar esta clase' });
      }

      await ClassSession.remove(classId);
      res.status(204).send();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al eliminar la clase' });
    }
  }

  // Listar reservas del usuario autenticado
  static async myReservations(req, res) {
    try {
      const reservations = await ClassSession.listUserReservations(req.user.id);
      res.json({ reservations });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al obtener tus reservas' });
    }
  }

}

module.exports = ClassesController;
