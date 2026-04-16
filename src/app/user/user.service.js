const connection = require("../../shared/connect.js");
const { SCHEMA_BD } = require("../../shared/conf.js");

/* USUARIOS */
const getUsers = async () => {
  const cn = await connection();
  try {
    const sql = `
      SELECT U.*, R.DESCRIPCION, R.DESCRIPCION2 FROM ${SCHEMA_BD}.T_US_GC U
      LEFT JOIN ${SCHEMA_BD}.T_RL_GC R ON U.ID_RL = R.ID
      WHERE U.USU NOT LIKE 'GESCON'
    `;

    const result = await cn.query(sql);

    return result.map((row) => ({
      id: row.ID,
      usuario: row.USU.trim(),
      codEmp: row.COD_EMP ? row.COD_EMP.trim() : "",
      clave: row.CLV ? row.CLV.trim() : "",
      idRol: row.ID_RL,
      rol: {
        id: row.ID_RL,
        name: row.DESCRIPCION.trim(),
        descripcion: row.DESCRIPCION2 ? row.DESCRIPCION2.trim() : "",
      },
    }));
  } catch (error) {
    console.error(error);
    throw new Error(`Ocurrio algo al consultar lista de usuarios: ${error}`);
  } finally {
    if (cn) await cn.close();
  }
};

const getUserByField = async (field, value) => {
  const cn = await connection();
  try {
    const fieldMap = {
      id: "U.ID",
      usuario: "U.USU",
      codEmp: "U.COD_EMP",
    };

    const column = fieldMap[field];

    if (!column) {
      throw new Error("Campo de busqueda no permitido.");
    }

    const sql = `
      SELECT U.*, R.DESCRIPCION, R.DESCRIPCION2 FROM ${SCHEMA_BD}.T_US_GC U
      LEFT JOIN ${SCHEMA_BD}.T_RL_GC R ON U.ID_RL = R.ID
      WHERE ${column} = ?
    `;

    const result = await cn.query(sql, [value]);

    if (!result[0]) return null;

    return {
      id: result[0].ID,
      usuario: result[0].USU.trim(),
      codEmp: result[0].COD_EMP ? result[0].COD_EMP.trim() : "",
      clave: result[0].CLV ? result[0].CLV.trim() : "",
      idRol: result[0].ID_RL,
      rol: {
        id: result[0].ID_RL,
        name: result[0].DESCRIPCION.trim(),
        descripcion: result[0].DESCRIPCION2
          ? result[0].DESCRIPCION2.trim()
          : "",
      },
    };
  } catch (error) {
    console.error(error);
    throw new Error(`Ocurrio algo al obtener usuario: ${error}`);
  } finally {
    if (cn) await cn.close();
  }
};

const getUserGesoperByField = async (field, value) => {
  const cn = await connection();
  try {
    const fieldMap = {
      id: "U.ID",
      usuario: "U.USUARIO",
      codEmp: "U.COD_EMP",
    };

    const column = fieldMap[field];

    if (!column) {
      throw new Error("Campo de busqueda no permitido.");
    }

    const sql = `
      SELECT * FROM SPEED400AT.PO_USUARIOS U
      WHERE ${column} = ?
    `;

    const result = await cn.query(sql, [value]);

    if (!result[0]) return null;

    return {
      id: result[0].ID,
      usuario: result[0].USUARIO.trim(),
      codEmp: result[0].COD_EMP ? result[0].COD_EMP.trim() : "",
      idRol: result[0].IDPERFIL,
    };
  } catch (error) {
    console.error(error);
    throw new Error(`Ocurrio algo al obtener usuario de gesoper: ${error}`);
  } finally {
    if (cn) await cn.close();
  }
};

const getUserById = async (id) => {
  const cn = await connection();
  try {
    const sql = `
      SELECT U.*, R.DESCRIPCION, R.DESCRIPCION2 FROM ${SCHEMA_BD}.T_US_GC U
      LEFT JOIN ${SCHEMA_BD}.T_RL_GC R ON U.ID_RL = R.ID
      WHERE U.USU NOT LIKE 'GESCON' AND U.ID = ?
    `;

    const result = await cn.query(sql, [id]);

    if (!result[0]) return null;

    return {
      id: result[0].ID,
      usuario: result[0].USU.trim(),
      codEmp: result[0].COD_EMP ? result[0].COD_EMP.trim() : "",
      clave: result[0].CLV ? result[0].CLV.trim() : "",
      idRol: result[0].ID_RL,
      rol: {
        id: result[0].ID_RL,
        name: result[0].DESCRIPCION.trim(),
        descripcion: result[0].DESCRIPCION2
          ? result[0].DESCRIPCION2.trim()
          : "",
      },
    };
  } catch (error) {
    console.error(error);
    throw new Error(`Ocurrio algo al obtener usuario por id: ${error}`);
  } finally {
    if (cn) await cn.close();
  }
};

const getNewUsers = async () => {
  const cn = await connection();
  try {
    const sql = `
      SELECT pu.ID, TRIM(pu.USUARIO) as USUARIO, TRIM(pu.COD_EMP) as COD_EMP, pu.IDPERFIL
      FROM ${SCHEMA_BD}.PO_USUARIOS pu
      WHERE NOT EXISTS (
          SELECT 1
          FROM ${SCHEMA_BD}.T_US_GC tug
          WHERE tug."ID" = pu."ID" 
            AND tug.USU = pu.USUARIO 
            AND tug.COD_EMP = PU.COD_EMP 
      )
    `;

    const result = await cn.query(sql);

    return result.map((row) => ({
      id: row.ID,
      usuario: row.USUARIO,
      codEmp: row.COD_EMP,
      rolId: row.IDPERFIL,
    }));
  } catch (error) {
    console.error(error);
    throw new Error(`Ocurrio algo al obtener usuario por id: ${error}`);
  } finally {
    if (cn) await cn.close();
  }
};

const postUser = async (data) => {
  const pool = await connection();
  const cn = await pool.connect();

  try {
    await cn.beginTransaction();

    const sql = `
      INSERT INTO ${SCHEMA_BD}.T_US_GC (USU, COD_EMP, CLV, ID_RL)
      VALUES (?, ?, ?, ?)
    `;

    await cn.query(sql, [data.usuario, data.codEmp, data.clave, data.rol]);

    await cn.commit();

    return { success: true };
  } catch (error) {
    await cn.rollback();

    throw new Error(`Ocurrio algo al crear usuario: ${error}`);
  } finally {
    if (cn) await cn.close();
  }
};

const postUserGesoper = async (data) => {
  const pool = await connection();
  const cn = await pool.connect();

  try {
    await cn.beginTransaction();

    const sql = `
      INSERT INTO ${SCHEMA_BD}.PO_USUARIOS (USUARIO, COD_EMP, IDPERFIL)
      VALUES (?, ?, ?)
    `;

    await cn.query(sql, [data.usuario, data.codEmp, data.perfil]);

    await cn.commit();

    return { success: true };
  } catch (error) {
    await cn.rollback();

    throw new Error(`Ocurrio algo al crear usuario en el gesoper: ${error}`);
  } finally {
    if (cn) await cn.close();
  }
};

const putUser = async (id, data) => {
  const pool = await connection();
  const cn = await pool.connect();

  try {
    await cn.beginTransaction();

    const sql = `
      UPDATE ${SCHEMA_BD}.T_US_GC
      SET ID_RL = ?
      WHERE ID = ?
    `;

    await cn.query(sql, [data.roleId, id]);

    await cn.commit();

    return { success: true };
  } catch (error) {
    await cn.rollback();

    console.error(error);
    throw new Error(`Ocurrio algo al actualizar usuario: ${error}`);
  } finally {
    if (cn) await cn.close();
  }
};

/* ROLES */

const getRoles = async () => {
  const cn = await connection();
  try {
    const sql = `
      SELECT * FROM ${SCHEMA_BD}.T_RL_GC
      WHERE DESCRIPCION NOT LIKE 'SUPER'
    `;

    const result = await cn.query(sql);

    return result.map((row) => ({
      id: row.ID,
      name: row.DESCRIPCION.trim(),
      descripcion: row.DESCRIPCION2 ? row.DESCRIPCION2.trim() : "",
    }));
  } catch (error) {
    console.error(error);
    throw new Error(`Ocurrio algo al consultar lista de roles: ${error}`);
  } finally {
    if (cn) await cn.close();
  }
};

const getRolesGesoper = async () => {
  const cn = await connection();
  try {
    const sql = `
      SELECT * FROM ${SCHEMA_BD}.PO_USUARIOPERFIL
    `;

    const result = await cn.query(sql);

    return result.map((row) => ({
      id: row.ID,
      name: row.DESCRIPCION.trim(),
    }));
  } catch (error) {
    console.error(error);
    throw new Error(
      `Ocurrio algo al consultar lista de roles del gesoper: ${error}`,
    );
  } finally {
    if (cn) await cn.close();
  }
};

const postRole = async (data) => {
  const pool = await connection();
  const cn = await pool.connect();
  try {
    await cn.beginTransaction();

    const resultId = await cn.query(`
      SELECT COALESCE(MAX(ID), 0) + 1 AS ID
      FROM ${SCHEMA_BD}.T_RL_GC
    `);

    const roleId = resultId[0].ID;

    console.log("ID OBTENIDO");

    const sqlRole = `
      INSERT INTO ${SCHEMA_BD}.T_RL_GC (ID, DESCRIPCION, DESCRIPCION2)
      VALUES (?, ?, ?)
    `;

    await cn.query(sqlRole, [roleId, data.name, data.description]);

    console.log("ROLE INSERTADO");

    const sqlPermissions = `
      INSERT INTO ${SCHEMA_BD}.T_RL_PS_GC (ID_RL, ID_PS)
      VALUES (?, ?)
    `;

    if (data.permissions.length > 0) {
      for (const perm of data.permissions) {
        await cn.query(sqlPermissions, [roleId, perm]);
      }
    }

    console.log("PERMISOS INSERTADOS");

    await cn.commit();

    return { success: true };
  } catch (error) {
    await cn.rollback();
    throw new Error(`Ocurrio algo al insertar un rol: ${error}`);
  } finally {
    if (cn) await cn.close();
  }
};

/* PERMISOS */

const getPermissions = async () => {
  const cn = await connection();
  try {
    const sql = `
      SELECT ID, TRIM(DESCRIPCION) AS DESCRIPCION
      FROM ${SCHEMA_BD}.T_PS_GC
    `;

    const result = await cn.query(sql);

    return result.map((row) => ({
      id: row.ID,
      name: row.DESCRIPCION,
    }));
  } catch (error) {
    throw new Error(`Ocurrio algo al consultar lista de permisos: ${error}`);
  } finally {
    if (cn) await cn.close();
  }
};

const getPermissionsByUser = async (id) => {
  const cn = await connection();
  try {
    const sql = `
      SELECT P.DESCRIPCION
      FROM ${SCHEMA_BD}.T_US_GC U
      JOIN ${SCHEMA_BD}.T_RL_GC R ON U.ID_RL = R.ID
      JOIN ${SCHEMA_BD}.T_RL_PS_GC RP ON R.ID = RP.ID_RL
      JOIN ${SCHEMA_BD}.T_PS_GC P ON RP.ID_PS = P.ID
      WHERE U.ID = ?    
    `;

    const result = await cn.query(sql, [id]);

    return result.map((row) => row.DESCRIPCION);
  } catch (error) {
    console.error(error);
    throw new Error(
      `Ocurrio algo al consultar lista de permisos del usuario: ${error}`,
    );
  } finally {
    if (cn) await cn.close();
  }
};

const getPermissionsByRole = async (id) => {
  const cn = await connection();
  try {
    const sql = `
      SELECT P.ID, P.DESCRIPCION
      FROM ${SCHEMA_BD}.T_RL_GC R
      JOIN ${SCHEMA_BD}.T_RL_PS_GC RP ON R.ID = RP.ID_RL
      JOIN ${SCHEMA_BD}.T_PS_GC P ON RP.ID_PS = P.ID
      WHERE R.ID = ?
      ORDER BY P.ID ASC
    `;

    const result = await cn.query(sql, [id]);

    return result.map((row) => ({
      id: row.ID,
      descripcion: row.DESCRIPCION,
    }));
  } catch (error) {
    console.error(error);
    throw new Error(
      `Ocurrio algo al consultar lista de permisos del rol: ${error}`,
    );
  } finally {
    if (cn) await cn.close();
  }
};

const putPermissionsByRole = async (id, permissions) => {
  const pool = await connection();
  const cn = await pool.connect();

  try {
    await cn.beginTransaction();

    const sqlDel = `
      DELETE FROM ${SCHEMA_BD}.T_RL_PS_GC
      WHERE ID_RL = ?
    `;

    const sqlInsert = `
      INSERT INTO ${SCHEMA_BD}.T_RL_PS_GC (ID_RL, ID_PS)
      VALUES (?, ?)
    `;

    await cn.query(sqlDel, [id]);

    for (const perm of permissions) {
      await cn.query(sqlInsert, [id, perm]);
    }

    await cn.commit();

    return { success: true };
  } catch (error) {
    await cn.rollback();

    console.error(error);
    throw new Error(`Ocurrio un error al actualizar los permisos: ${error}`);
  } finally {
    if (cn) await cn.close();
  }
};

module.exports = {
  getUsers,
  getUserByField,
  getUserGesoperByField,
  getUserById,
  getNewUsers,
  postUser,
  postUserGesoper,
  putUser,
  getRoles,
  getRolesGesoper,
  postRole,
  getPermissions,
  getPermissionsByUser,
  getPermissionsByRole,
  putPermissionsByRole,
};
