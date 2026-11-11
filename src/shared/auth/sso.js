const jwt = require("jsonwebtoken");
const { SSO_SECRET_KEY } = require("../conf.js");

function signSsoToken({ sub, user, vtk }) {
  return jwt.sign({ sub, user, vtk }, SSO_SECRET_KEY, {
    algorithm: "HS256",
    expiresIn: "1d",
  });
}

function verifySsoToken(token) {
  return jwt.verify(token, SSO_SECRET_KEY, { algorithms: ["HS256"] });
}

module.exports = { signSsoToken, verifySsoToken };