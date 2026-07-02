const axios = require("axios");
const {
  URI_BASE_KEYNUA_TEST: uriBase,
  API_KEY_KEYNUA: apiKey,
  API_TOKEN_KEYNUA: apiToken,
} = require("../../conf.js");

const axiosInstance = axios.create({
  baseURL: uriBase,
  headers: {
    "x-api-key": apiKey,
    Authorization: apiToken,
  },
});

const getContactById = async (contractId) => {
  const res = await axiosInstance.get(`/contracts/v1/${contractId}`);

  return res.data;
};

const postContract = async (data) => {
  const res = await axiosInstance.post(`/contracts/v1`, data);

  return res.data;
};

module.exports = {
  getContactById,
  postContract,
};
