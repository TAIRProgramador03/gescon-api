const { decodeString } = require("../../shared/utils.js");
const connection = require("../../shared/connect.js");
const { SCHEMA_BD } = require("../../shared/conf.js");

const listClient = async (req, res) => {
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const cn = await connection(globalDbUser, globalPassword);

  try {
    const sql = `
      SELECT DISTINCT A.IDCLI, B.CLINOM 
      FROM ${SCHEMA_BD}.PO_OPERACIONES A 
      INNER JOIN ${SCHEMA_BD}.TCLIE B ON A.IDCLI=B.CLICVE 
      WHERE A.ID<>86 AND B.CLINOM <> '*** ANULADO ***' 
      ORDER BY CLINOM ASC
    `;

    const result = await cn.query(sql);

    // Decodificar los resultados desde latin1
    const cleanedResult = result.map((row) => {
      return {
        IDCLI: row.IDCLI.trim(),
        CLINOM: decodeString(row.CLINOM.trim()),
      };
    });

    res.json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener los clientes:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener clientes" });
  } finally {
    if (cn) {
      await cn.close();
    }
  }
};

const tableClient = async (req, res) => {
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { idCli } = req.query; // Obtiene el idCli de los parámetros de consulta

  if (!idCli) {
    return res
      .status(400)
      .json({ success: false, message: "El idCli es obligatorio" });
  }

  const cn = await connection(globalDbUser, globalPassword);

  try {
    // Consulta los contratos asociados al cliente
    const query = `
      SELECT ID, NRO_CONTRATO AS DESCRIPCION, FECHA_FIRMA AS FECHACREA, CANT_VEHI AS TOTVEH, DURACION 
      FROM ${SCHEMA_BD}.TBLCONTRATO_CAB 
      WHERE ID_CLIENTE = ?
    `;
    const result = await cn.query(query, [idCli]);

    const cleanedResult = result.map((row) => {
      return {
        ID: row.ID,
        DESCRIPCION:
          row.DESCRIPCION !== null && row.DESCRIPCION !== undefined
            ? decodeString(row.DESCRIPCION.toString().trim())
            : null,
        FECHACREA:
          row.FECHACREA !== null && row.FECHACREA !== undefined
            ? row.FECHACREA.toString().trim()
            : null,
        TOTVEH:
          row.TOTVEH !== null && row.TOTVEH !== undefined
            ? row.TOTVEH.toString().trim()
            : null,
        DURACION:
          row.DURACION !== null && row.DURACION !== undefined
            ? row.DURACION.toString().trim()
            : null,
      };
    });

    // Devuelve los contratos como respuesta
    res.json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener los datos:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener los datos" });
  } finally {
    if (cn) {
      await cn.close();
    }
  }
};

const tableClientLea = async (req, res) => {
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const cn = await connection(globalDbUser, globalPassword);

  try {
    // Consulta los contratos asociados al cliente
    const query = `SELECT DISTINCT A.IDCLI, B.CLINOM, B.CLIRUC, B.CLIABR, B.CLIDIR FROM ${SCHEMA_BD}.PO_OPERACIONES A INNER JOIN ${SCHEMA_BD}.TCLIE B ON A.IDCLI=B.CLICVE WHERE A.ID<>86 AND B.CLINOM <> '*** ANULADO ***' ORDER BY CLINOM ASC`;
    const result = await cn.query(query);

    const cleanedResult = result.map((row) => {
      return {
        IDCLI:
          row.IDCLI !== null && row.IDCLI !== undefined
            ? row.IDCLI.toString().trim()
            : null,
        CLINOM:
          row.CLINOM !== null && row.CLINOM !== undefined
            ? decodeString(row.CLINOM.toString().trim())
            : null,
        CLIRUC:
          row.CLIRUC !== null && row.CLIRUC !== undefined
            ? row.CLIRUC.toString().trim()
            : null,
        CLIABR:
          row.CLIABR !== null && row.CLIABR !== undefined
            ? row.CLIABR.toString().trim()
            : null,
        CLIDIR:
          row.CLIDIR !== null && row.CLIDIR !== undefined
            ? decodeString(row.CLIDIR.toString().trim())
            : null,
      };
    });

    // Devuelve los contratos como respuesta
    res.json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener los datos:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener los datos" });
  } finally {
    if (cn) {
      await cn.close();
    }
  }
};

module.exports = {
  listClient,
  tableClient,
  tableClientLea,
};
