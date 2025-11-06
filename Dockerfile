FROM node:14-alpine3.13

WORKDIR /usr/src/app

ENV something="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.KMUFsIDTnFmyG3nMiGM6H9FNFUROf3wh7SmqJp-QV30"

ENV pasSWord="nothing"

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 8080
CMD ["node", "src/file.js"]
