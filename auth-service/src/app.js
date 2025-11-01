const express = require('express'); 
const cors = require('cors'); 
const app = express(); 
const PORT = process.env.PORT || 3001;
 
app.use(cors()); 
app.use(express.json()); 
 
app.get('/health', (req, res) => {
  res.status(200).json({ message: 'Auth service is running!' }); 
}); 
 
app.listen(PORT, () => {
  console.log('Auth service listening on port ' + PORT);
}); 

