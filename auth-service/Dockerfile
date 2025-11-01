FROM node:18-alpine 
 
WORKDIR /app 
 
COPY package*.json ./ 
RUN npm install 
 
COPY . .
 
CMD ["sh", "-c", "echo '🔄 Esperando a que PostgreSQL esté lista...' && sleep 15 && node src/database/init.js && echo '✅ Base de datos inicializada' && npm start"]
