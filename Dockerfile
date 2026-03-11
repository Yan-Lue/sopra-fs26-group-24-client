# 1. Build Image
FROM node:22.14.0 as build
WORKDIR /app
COPY package*.json ./
RUN npm config set cache /app/.npm-cache --global
RUN npm ci --loglevel=error
COPY . .
# Next.js build produces the .next folder
RUN npm run build
# Prune devDependencies to keep the image lean
RUN npm prune --production

# 2. Production Image
FROM node:22.14.0-alpine
ENV NODE_ENV production
RUN npm config set cache /app/.npm-cache --global
# Non-root security
USER 3301
WORKDIR /app

# Copy necessary files from the build stage
# Note: We copy .next (the build output) and public (static assets)
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/.next ./.next
COPY --chown=node:node --from=build /app/public ./public
COPY --chown=node:node --from=build /app/package*.json ./

EXPOSE 3000

# Use 'npm start' which runs 'next start' by default in Next.js projects
CMD [ "npm", "start" ]