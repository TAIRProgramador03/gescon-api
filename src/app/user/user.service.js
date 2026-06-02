const connection = require("../../shared/connect.js");
const { SCHEMA_BD } = require("../../shared/conf.js");

/* USUARIOS */
const getUsers = async () => {
  const pool = await connection();
  const cn = await pool.connect();
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
    try {
      if (cn) await cn.close();
    } catch (err) {
      console.error(err);
    }
  }
};

const getUserByField = async (field, value) => {
  const pool = await connection();
  const cn = await pool.connect();
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
    try {
      if (cn) await cn.close();
    } catch (err) {
      console.error(err);
    }
  }
};

const getUserGesoperByField = async (field, value) => {
  const pool = await connection();
  const cn = await pool.connect();
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
      SELECT * FROM ${SCHEMA_BD}.PO_USUARIOS U
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
    try {
      if (cn) await cn.close();
    } catch (err) {
      console.error(err);
    }
  }
};

const getUserById = async (id) => {
  const pool = await connection();
  const cn = await pool.connect();
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
    try {
      if (cn) await cn.close();
    } catch (err) {
      console.error(err);
    }
  }
};

const getNewUsers = async () => {
  const pool = await connection();
  const cn = await pool.connect();
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
    try {
      if (cn) await cn.close();
    } catch (err) {
      console.error(err);
    }
  }
};

const postUser = async (data, username) => {
  const pool = await connection();
  const cn = await pool.connect();

  console.log(data);
  console.log(username);

  try {
    await cn.beginTransaction();

    const sql = `
      INSERT INTO ${SCHEMA_BD}.T_US_GC (USU, COD_EMP, CLV, ID_RL, CREADO_POR, ACTUALIZADO_POR)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    await cn.query(sql, [
      data.usuario,
      data.codEmp,
      data.clave,
      data.rol,
      username,
      username,
    ]);

    await cn.commit();

    return { success: true };
  } catch (error) {
    await cn.rollback();

    console.error("Error completo:", error);

    throw new Error(`Ocurrio algo al crear usuario: ${error}`);
  } finally {
    try {
      if (cn) await cn.close();
    } catch (err) {
      console.error(err);
    }
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
    try {
      if (cn) await cn.close();
    } catch (err) {
      console.error(err);
    }
  }
};

const putUser = async (id, data, username) => {
  const pool = await connection();
  const cn = await pool.connect();

  try {
    await cn.beginTransaction();

    const sql = `
      UPDATE ${SCHEMA_BD}.T_US_GC
      SET 
        ID_RL = ?,
        ACTUALIZADO_EL = CURRENT TIMESTAMP,
        ACTUALIZADO_POR = ?
      WHERE ID = ?
    `;

    await cn.query(sql, [data.roleId, username, id]);

    await cn.commit();

    return { success: true };
  } catch (error) {
    await cn.rollback();

    console.error(error);
    throw new Error(`Ocurrio algo al actualizar usuario: ${error}`);
  } finally {
    try {
      if (cn) await cn.close();
    } catch (err) {
      console.error(err);
    }
  }
};

const putPasswordUser = async (id, password, username) => {
  const pool = await connection();
  const cn = await pool.connect();

  try {
    await cn.beginTransaction();

    const sql = `
      UPDATE ${SCHEMA_BD}.T_US_GC
      SET 
        CLV = ?,
        ACTUALIZADO_EL = CURRENT TIMESTAMP,
        ACTUALIZADO_POR = ?
      WHERE ID = ?
    `;

    await cn.query(sql, [password, username, id]);

    await cn.commit();

    return { success: true };
  } catch (error) {
    await cn.rollback();

    console.error(error);
    throw new Error(`Ocurrio algo al actualizar usuario: ${error}`);
  } finally {
    try {
      if (cn) await cn.close();
    } catch (err) {
      console.error(err);
    }
  }
};

/* ROLES */

const getRoles = async () => {
  const pool = await connection();
  const cn = await pool.connect();
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
    try {
      if (cn) await cn.close();
    } catch (err) {
      console.error(err);
    }
  }
};

const getRolesGesoper = async () => {
  const pool = await connection();
  const cn = await pool.connect();
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
    try {
      if (cn) await cn.close();
    } catch (err) {
      console.error(err);
    }
  }
};

const postRole = async (data, username) => {
  const pool = await connection();
  const cn = await pool.connect();
  try {
    await cn.beginTransaction();

    const resultId = await cn.query(`
      SELECT COALESCE(MAX(ID), 0) + 1 AS ID
      FROM ${SCHEMA_BD}.T_RL_GC
    `);

    const roleId = resultId[0].ID;

    const sqlRole = `
      INSERT INTO ${SCHEMA_BD}.T_RL_GC (ID, DESCRIPCION, DESCRIPCION2, CREADO_POR, ACTUALIZADO_POR)
      VALUES (?, ?, ?, ?, ?)
    `;

    await cn.query(sqlRole, [
      roleId,
      data.name,
      data.description,
      username,
      username,
    ]);

    const sqlPermissions = `
      INSERT INTO ${SCHEMA_BD}.T_RL_PS_GC (ID_RL, ID_PS)
      VALUES (?, ?)
    `;

    if (data.permissions.length > 0) {
      for (const perm of data.permissions) {
        await cn.query(sqlPermissions, [roleId, perm]);
      }
    }

    await cn.commit();

    return { success: true };
  } catch (error) {
    await cn.rollback();
    throw new Error(`Ocurrio algo al insertar un rol: ${error}`);
  } finally {
    try {
      if (cn) await cn.close();
    } catch (err) {
      console.error(err);
    }
  }
};

/* PERMISOS */

const getPermissions = async () => {
  const pool = await connection();
  const cn = await pool.connect();
  try {
    const sql = `
      SELECT ID, TRIM(DESCRIPCION) AS DESCRIPCION, NOMBRE, MODULO, DESCRIPCION2
      FROM ${SCHEMA_BD}.T_PS_GC
    `;

    const result = await cn.query(sql);

    return result.map((row) => ({
      id: row.ID,
      name: row.NOMBRE.trim(),
      description: row.DESCRIPCION2.trim(),
      module: row.MODULO.trim(),
      key: row.DESCRIPCION,
    }));
  } catch (error) {
    throw new Error(`Ocurrio algo al consultar lista de permisos: ${error}`);
  } finally {
    try {
      if (cn) await cn.close();
    } catch (err) {
      console.error(err);
    }
  }
};

const getPermissionsByUser = async (id) => {
  const pool = await connection();
  const cn = await pool.connect();
  try {
    const sql = `
      SELECT
        P.ID,
        P.DESCRIPCION,
        P.NOMBRE,
        P.DESCRIPCION2,
        P.MODULO,
        CASE
            WHEN RP.ID_PS IS NOT NULL THEN 1
            ELSE 0
        END AS ACTIVO
    FROM ${SCHEMA_BD}.T_PS_GC P
    LEFT JOIN (
        SELECT
            RP.ID_PS
        FROM ${SCHEMA_BD}.T_US_GC U
        JOIN ${SCHEMA_BD}.T_RL_GC R
            ON U.ID_RL = R.ID
        JOIN ${SCHEMA_BD}.T_RL_PS_GC RP
            ON R.ID = RP.ID_RL
        WHERE U.ID = ?
    ) RP
        ON P.ID = RP.ID_PS
    ORDER BY P.MODULO
    `;

    const result = await cn.query(sql, [id]);

    return result.map((row) => ({
      id: row.ID,
      modulo: row.MODULO.trim(),
      nombre: row.NOMBRE.trim(),
      descripcion: row.DESCRIPCION2.trim(),
      key: row.DESCRIPCION.trim(),
      activo: row.ACTIVO ? true : false,
    }));
  } catch (error) {
    console.error(error);
    throw new Error(
      `Ocurrio algo al consultar lista de permisos del usuario: ${error}`,
    );
  } finally {
    try {
      if (cn) await cn.close();
    } catch (err) {
      console.error(err);
    }
  }
};

const getPermissionsByRole = async (id) => {
  const pool = await connection();
  const cn = await pool.connect();
  try {
    const sql = `
      SELECT
        P.ID,
        P.DESCRIPCION,
        P.NOMBRE,
        P.DESCRIPCION2,
        P.MODULO,
        CASE
            WHEN RP.ID_PS IS NOT NULL THEN 1
            ELSE 0
        END AS ACTIVO
    FROM SPEED400AT.T_PS_GC P
    LEFT JOIN SPEED400AT.T_RL_PS_GC RP
        ON P.ID = RP.ID_PS
        AND RP.ID_RL = ?
    ORDER BY P.MODULO
    `;

    const result = await cn.query(sql, [id]);

    return result.map((row) => ({
      id: row.ID,
      modulo: row.MODULO.trim(),
      nombre: row.NOMBRE.trim(),
      descripcion: row.DESCRIPCION2.trim(),
      key: row.DESCRIPCION.trim(),
      activo: row.ACTIVO ? true : false,
    }));
  } catch (error) {
    console.error(error);
    throw new Error(
      `Ocurrio algo al consultar lista de permisos del rol: ${error}`,
    );
  } finally {
    try {
      if (cn) await cn.close();
    } catch (err) {
      console.error(err);
    }
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
    try {
      if (cn) await cn.close();
    } catch (err) {
      console.error(err);
    }
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
  putPasswordUser,
  getRoles,
  getRolesGesoper,
  postRole,
  getPermissions,
  getPermissionsByUser,
  getPermissionsByRole,
  putPermissionsByRole,
};
