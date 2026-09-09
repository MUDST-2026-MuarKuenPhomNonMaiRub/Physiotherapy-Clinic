FROM node:22-alpine AS build
WORKDIR /app
# Baked into the bundle at build time, so it has to be right here rather than
# at run time. The default suits a laptop, where the browser reaches the API on
# a published port; the production compose file passes an empty value instead,
# which sends the browser to /api on the same origin behind the proxy.
#
# The default matters: leaving the argument unset would bake in an empty string,
# and the code's fallback only covers an undefined value, not an empty one.
ARG NEXT_PUBLIC_API_URL=http://localhost:8080
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000
CMD ["npm", "run", "start"]
