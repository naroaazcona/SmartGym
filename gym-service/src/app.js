const express = require('express'); 
const cors = require('cors'); 
 
const app = express(); 
 
app.use(cors()); 
app.use(express.json()); 
 
app.get('/health', (req, res) => {
  res.status(200).json({ message: 'Gym service is running!' }); 
}); 
 
app.listen(PORT, () => {
  console.log('Gym service listening on port ' + PORT); 
})
