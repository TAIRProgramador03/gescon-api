const axios = require("axios");
const { URI_FIRMEASY } = require("../conf.js");

class FirmEasySevice {
  #token;

  constructor(token) {
    this.token = token;
  }

  async getDocuments(params = {}) {
    const response = await axios.get(`${URI_FIRMEASY}/documents`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      params: {
        ...params,
        "include[]": params.include ? params.include : [],
      },
    });

    return response.data;
  }

  async getOneDocument(id, include = []) {
    const response = await axios.get(`${URI_FIRMEASY}/documents/${id}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      params: {
        "include[]": include,
      },
    });

    return response.data;
  }

  async createDocument(data) {
    const response = await axios.post(`${URI_FIRMEASY}/documents`, data, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    return response.data;
  }

  async deleteDocument(id) {
    const response = await axios.delete(`${URI_FIRMEASY}/documents/${id}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    return response.data;
  }
}

module.exports = FirmEasySevice;
