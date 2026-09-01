# Simple, reliable Node build — avoids Railway's Nixpacks apt/mise builder issues
FROM node:18-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm install --omit=dev

# Copy the rest of the server code
COPY . .

# Make sure the data folder exists even on a fresh volume mount
RUN mkdir -p data

EXPOSE 4000

CMD ["npm", "start"]
