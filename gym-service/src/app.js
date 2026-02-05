const express = require('express');
const cors = require('cors');

const classesRoutes = require('./routes/ClassesRoutes');
const classTypesRoutes = require('./routes/ClassTypesRoutes');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ message: 'Gym service is running!' });
});

// Rutas del dominio (clases y reservas)
app.use('/classes', classesRoutes);
app.use('/class-types', classTypesRoutes);

app.listen(PORT, () => {
  console.log('Gym service listening on port ' + PORT);
});
