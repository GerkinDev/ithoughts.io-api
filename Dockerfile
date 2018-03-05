FROM alpine:latest

RUN apk update \
	&& apk add --update nodejs nodejs-npm git; \
	npm install -g nodemon

# Install and build the application
COPY ./*.json /usr/src/app/
WORKDIR /usr/src/app
RUN npm install --no-optional --unsafe-perm
COPY . /usr/src/app

EXPOSE 3210

CMD ["nodemon", "/usr/src/app/index.js"]