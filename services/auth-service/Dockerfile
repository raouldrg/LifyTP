FROM node:20-alpine

WORKDIR /app

# Copy service code first
COPY services/auth-service/package*.json ./
RUN npm install

# Copy shared prisma schema to where it's expected
COPY services/shared/prisma ./shared/prisma

# Generate Prisma client
RUN npx prisma generate --schema=./shared/prisma/schema.prisma

# Copy application code
COPY services/auth-service/src ./src
COPY services/auth-service/tsconfig.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 4100

CMD ["npx", "tsx", "src/index.ts"]
