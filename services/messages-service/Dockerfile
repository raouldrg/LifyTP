FROM node:20-alpine

WORKDIR /app

# Copy service code first
COPY services/messages-service/package*.json ./
RUN npm install

# Copy shared prisma schema
COPY services/shared/prisma ./shared/prisma

# Generate Prisma client
RUN npx prisma generate --schema=./shared/prisma/schema.prisma

# Copy application code
COPY services/messages-service/src ./src
COPY services/messages-service/tsconfig.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 4102

CMD ["npx", "tsx", "src/index.ts"]
