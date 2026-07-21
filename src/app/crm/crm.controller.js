const msal = require('@azure/msal-node');
const { AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET } = require('../../shared/conf');

const msalConfig = {
  auth: {
    clientId: AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`, // tenant-specific, evita el error de /common que ya viviste
    clientSecret: AZURE_CLIENT_SECRET,
  },
};
const cca = new msal.ConfidentialClientApplication(msalConfig);
