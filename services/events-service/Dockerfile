FROM node:20-alpine

WORKDIR /app

# Copy service code first
COPY services/events-service/package*.json ./
RUN npm install

# Copy shared prisma schema
COPY services/shared/prisma ./shared/prisma

# Generate Prisma client
RUN npx prisma generate --schema=./shared/prisma/schema.prisma

# Copy application code
COPY services/events-service/src ./src
COPY services/events-service/tsconfig.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 4101

CMD ["npx", "tsx", "src/index.ts"]
