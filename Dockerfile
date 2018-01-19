FROM alpine:latest

RUN apk update \
	&& apk add --update nodejs nodejs-npm; \
	npm install -g nodemon

# Install and build the application
COPY ./package.json /usr/src/app/package.json
WORKDIR /usr/src/app
RUN npm install --no-optional --unsafe-perm
COPY . /usr/src/app

CMD ["nodemon", "/usr/src/app/index.js"]