const { decodeString } = require("../../shared/utils.js");
const connection = require("../../shared/connect.js");
const { SCHEMA_BD } = require("../../shared/conf.js");

const listModels = async (req, res) => {
  const pool = await connection();
  const cn = await pool.connect();

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