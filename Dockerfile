FROM node:7.9.0
MAINTAINER Jack Preston <unwttng@gmail.com>

WORKDIR /app
COPY . /app/hive-game-server

WORKDIR /app/hive-game-server
RUN rm -rf node_modules
RUN yarn

EXPOSE 8000

ENTRYPOINT ["node", "server.js"]
