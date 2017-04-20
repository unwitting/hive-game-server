FROM node:7.9.0
MAINTAINER Jack Preston <unwttng@gmail.com>

WORKDIR /app
RUN git clone https://github.com/unwitting/hive-game-server.git

WORKDIR /app/hive-game-server
RUN yarn

EXPOSE 8000

ENTRYPOINT ["node", "server.js"]
