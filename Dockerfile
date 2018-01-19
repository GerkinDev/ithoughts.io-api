FROM alpine:latest

RUN apk update \
	&& apk add --update nodejs nodejs-npm nginx

# Install and build the application
COPY ./package.json /usr/src/app/package.json
WORKDIR /usr/src/app
RUN npm install --no-optional --unsafe-perm
COPY . /usr/src/app
RUN npm run postinstall

# Run specific build steps

COPY default.conf /etc/nginx/conf.d/

RUN ng build --prod;\
	for i in dist/*; do brotli $i; done

CMD ["nginx", "-g", "daemon off;"]