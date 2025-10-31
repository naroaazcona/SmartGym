const express = require('express'); 
const { createProxyMiddleware } = require('http-proxy-middleware'); 
const cors = require('cors'); 
 
const app = express(); 
 
app.use(cors()); 
app.use(express.json()); 
 
// Configuraci¢n de proxies para los microservicios 
app.use('/auth', createProxyMiddleware({ 
  target: 'http://auth-service:3001', 
  changeOrigin: true, 
  pathRewrite: { 
    '/auth': '' 
  } 
})); 
 
app.use('/gym', createProxyMiddleware({ 
  target: 'http://gym-service:3002', 
  changeOrigin: true, 
  pathRewrite: { 
    '/gym': '' 
  } 
})); 
 
app.use('/training', createProxyMiddleware({ 
  target: 'http://training-service:5000', 
  changeOrigin: true, 
  pathRewrite: { 
    '/training': '' 
  } 
})); 
 
// Ruta de health check 
app.get('/health', (req, res) =
  res.status(200).json({ message: 'API Gateway is running!' }); 
}); 
 
app.listen(PORT, () =
  console.log('API Gateway listening on port ' + PORT); 
}); 
