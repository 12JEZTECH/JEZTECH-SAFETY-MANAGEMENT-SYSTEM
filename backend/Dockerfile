FROM node:22-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend/src ./src
COPY backend/database ./database
COPY frontend /frontend
EXPOSE 8080
CMD ["sh","-c","npm run migrate && npm start"]
