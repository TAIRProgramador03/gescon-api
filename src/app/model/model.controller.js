const { decodeString, withConnection } = require("../../shared/utils.js");
const { SCHEMA_BD } = require("../../shared/conf.js");

const listModels = async (req, res) => {
  try {
    const cleanedResult = await withConnection(async (cn) => {
      const result = await cn.query(
        `SELECT ID, TRIM(DESCRIPCION) AS MODELO FROM ${SCHEMA_BD}.PO_MODELO GROUP BY ID, DESCRIPCION ORDER BY TRIM(DESCRIPCION) ASC`,
      );
      return result.map((row) => ({
        ID: String(row.ID).trim(),
        MODELO: decodeString(row.MODELO.trim()),
      }));
    });

    res.json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener los modelos:", error);
    res.status(500).json({ success: false, message: "Error al obtener los modelos" });
  }
};

module.exports = { listModels };
