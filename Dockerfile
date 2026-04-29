FROM node:18

# dependencias base
RUN apt-get update && apt-get install -y \
    unixodbc \
    unixodbc-dev \
    && rm -rf /var/lib/apt/lists/*

# copiar driver local
COPY docker/ibm-iaccess.deb /tmp/

WORKDIR /tmp

# instalar correctamente
RUN dpkg -i ibm-iaccess.deb || true && \
    apt-get update && \
    apt-get install -f -y

# registrar driver
RUN echo "[IBM i Access ODBC Driver]" > /etc/odbcinst.ini && \
    echo "Description=IBM i ODBC Driver" >> /etc/odbcinst.ini && \
    echo "Driver=/opt/ibm/iaccess/lib64/libcwbodbc.so" >> /etc/odbcinst.ini

# app
WORKDIR /gescon-api

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]