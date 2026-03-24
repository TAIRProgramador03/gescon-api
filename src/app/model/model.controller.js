const { decodeString } = require("../../shared/utils.js");
const connection = require("../../shared/connect.js");
const { SCHEMA_BD } = require("../../shared/conf.js");

const listModels = async (req, res) => {
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const cn = await connection(globalDbUser, globalPassword);

  try {
    const result = await cn.query(
      `SELECT ID, TRIM(DESCRIPCION) AS MODELO FROM ${SCHEMA_BD}.PO_MODELO GROUP BY ID, DESCRIPCION ORDER BY TRIM(DESCRIPCION) ASC`,
    );

    // Decodificar los resultados desde latin1
    const cleanedResult = result.map((row) => {
      return {
        ID: String(row.ID).trim(),
        MODELO: decodeString(row.MODELO.trim()),
      };
    });

    res.json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener los modelos:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener los modelos" });
  } finally {
    if (cn) {
      await cn.close();
    }
  }
};

module.exports = {
  listModels,
};