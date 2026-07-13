FROM node:20-slim

WORKDIR /app

# Copy root package files and install backend deps
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy frontend and build it
COPY frontend ./frontend
RUN cd frontend && npm install && npm run build && mv dist ../public && cd .. && rm -rf frontend

# Copy remaining backend files
COPY server.js ./
COPY trakky-logo.png ./
COPY chatgpt.token* ./

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 5000

CMD ["node", "server.js"]
