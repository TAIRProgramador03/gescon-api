const { withConnection } = require("../../shared/utils.js");
const { SCHEMA_BD } = require("../../shared/conf.js");

/* USUARIOS */
const getUsers = async () => {
  return withConnection(async (cn) => {
    const sql = `
      SELECT U.*, R.DESCRIPCION, R.DESCRIPCION2 FROM ${SCHEMA_BD}.T_US_GC U
      LEFT JOIN ${SCHEMA_BD}.T_RL_GC R ON U.ID_RL = R.ID
      WHERE U.USU NOT LIKE 'GESCON'
    `;
    const result = await cn.query(sql);
    return result.map((row) => ({
      id: row.ID,
      nombre: row.NOMBRE ? row.NOMBRE.trim() : "",
      apellido: row.APELLIDO ? row.APELLIDO.trim() : "",
      usuario: row.USU.trim(),
      codEmp: row.COD_EMP ? row.COD_EMP.trim() : "",
      clave: row.CLV ? row.CLV.trim() : "",
      estado: row.ACTIVO == "1" ? true : false, 
      idRol: row.ID_RL,
      rol: {
        id: row.ID_RL,
        name: row.DESCRIPCION.trim(),
        descripcion: row.DESCRIPCION2 ? row.DESCRIPCION2.trim() : "",
      },
    }));
  }).catch((error) => {
    console.error(error);
    throw new Error(`Ocurrio algo al consultar lista de usuarios: ${error}`);
  });
};

const getUserByField = async (field, value) => {
  return withConnection(async (cn) => {
    const fieldMap = { id: "U.ID", usuario: "U.USU", codEmp: "U.COD_EMP" };
    const column = fieldMap[field];
    if (!column) throw new Error("Campo de busqueda no permitido.");

    const sql = `
      SELECT U.*, R.DESCRIPCION, R.DESCRIPCION2 FROM ${SCHEMA_BD}.T_US_GC U
      LEFT JOIN ${SCHEMA_BD}.T_RL_GC R ON U.ID_RL = R.ID
      WHERE ${column} = ?
    `;
    const result = await cn.query(sql, [value]);
    if (!result[0]) return null;

    return {
      id: result[0].ID,
      nombre: result[0].NOMBRE ? result[0].NOMBRE.trim() : "",
      apellido: result[0].APELLIDO ? result[0].APELLIDO.trim() : "",
      usuario: result[0].USU.trim(),
      codEmp: result[0].COD_EMP ? result[0].COD_EMP.trim() : "",
      clave: result[0].CLV ? result[0].CLV.trim() : "",
      idRol: result[0].ID_RL,
      estado: result[0].ACTIVO == "1" ? true : false,
      rol: {
        id: result[0].ID_RL,
        name: result[0].DESCRIPCION.trim(),
        descripcion: result[0].DESCRIPCION2 ? result[0].DESCRIPCION2.trim() : "",
      },
    };
  }).catch((error) => {
    console.error(error);
    throw new Error(`Ocurrio algo al obtener usuario: ${error}`);
  });
};

const getUserGesoperByField = async (field, value) => {
  return withConnection(async (cn) => {
    const fieldMap = { id: "U.ID", usuario: "U.USUARIO", codEmp: "U.COD_EMP" };
    const column = fieldMap[field];
    if (!column) throw new Error("Campo de busqueda no permitido.");

    const sql = `SELECT * FROM ${SCHEMA_BD}.PO_USUARIOS U WHERE ${column} = ?`;
    const result = await cn.query(sql, [value]);
    if (!result[0]) return null;

    return {
      id: result[0].ID,
      usuario: result[0].USUARIO.trim(),
      codEmp: result[0].COD_EMP ? result[0].COD_EMP.trim() : "",
      idRol: result[0].IDPERFIL,
    };
  }).catch((error) => {
    console.error(error);
    throw new Error(`Ocurrio algo al obtener usuario de gesoper: ${error}`);
  });
};

const getUserById = async (id) => {
  return withConnection(async (cn) => {
    const sql = `
      SELECT U.*, R.DESCRIPCION, R.DESCRIPCION2 FROM ${SCHEMA_BD}.T_US_GC U
      LEFT JOIN ${SCHEMA_BD}.T_RL_GC R ON U.ID_RL = R.ID
      WHERE U.USU NOT LIKE 'GESCON' AND U.ID = ?
    `;
    const result = await cn.query(sql, [id]);
    if (!result[0]) return null;

    return {
      id: result[0].ID,
      nombre: result[0].NOMBRE ? result[0].NOMBRE.trim() : "",
      apellido: result[0].APELLIDO ? result[0].APELLIDO.trim() : "",
      usuario: result[0].USU.trim(),
      codEmp: result[0].COD_EMP ? result[0].COD_EMP.trim() : "",
      clave: result[0].CLV ? result[0].CLV.trim() : "",
      estado: result[0].ACTIVO == "1" ? true : false,
      idRol: result[0].ID_RL,
      rol: {
        id: result[0].ID_RL,
        name: result[0].DESCRIPCION.trim(),
        descripcion: result[0].DESCRIPCION2 ? result[0].DESCRIPCION2.trim() : "",
      },
    };
  }).catch((error) => {
    console.error(error);
    throw new Error(`Ocurrio algo al obtener usuario por id: ${error}`);
  });
};

const getNewUsers = async () => {
  return withConnection(async (cn) => {
    const sql = `
      SELECT pu.ID, TRIM(pu.USUARIO) as USUARIO, TRIM(pu.COD_EMP) as COD_EMP, pu.IDPERFIL
      FROM ${SCHEMA_BD}.PO_USUARIOS pu
      WHERE NOT EXISTS (
          SELECT 1
          FROM ${SCHEMA_BD}.T_US_GC tug
          WHERE tug.USU = pu.USUARIO
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
  }).catch((error) => {
    console.error(error);
    throw new Error(`Ocurrio algo al obtener usuario por id: ${error}`);
  });
};

const postUser = async (data, username) => {
  return withConnection(async (cn) => {
    await cn.beginTransaction();
    try {
      const sql = `
        INSERT INTO ${SCHEMA_BD}.T_US_GC (NOMBRE, APELLIDO, USU, COD_EMP, CLV, ID_RL, CREADO_POR, ACTUALIZADO_POR)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await cn.query(sql, [data.nombre, data.apellido, data.usuario, data.codEmp, data.clave, data.rol, username, username]);
      await cn.commit();
      return { success: true };
    } catch (err) {
      await cn.rollback().catch(() => {});
      throw err;
    }
  }).catch((error) => {
    console.error("Error completo:", error);
    throw new Error(`Ocurrio algo al crear usuario: ${error}`);
  });
};

const postUserGesoper = async (data) => {
  return withConnection(async (cn) => {
    await cn.beginTransaction();
    try {
      const sql = `INSERT INTO ${SCHEMA_BD}.PO_USUARIOS (USUARIO, COD_EMP, IDPERFIL) VALUES (?, ?, ?)`;
      await cn.query(sql, [data.usuario, data.codEmp, data.perfil]);
      await cn.commit();
      return { success: true };
    } catch (err) {
      await cn.rollback().catch(() => {});
      throw err;
    }
  }).catch((error) => {
    throw new Error(`Ocurrio algo al crear usuario en el gesoper: ${error}`);
  });
};

const putUser = async (id, data, username) => {
  return withConnection(async (cn) => {
    await cn.beginTransaction();
    try {
      const status = data.status ? "1" : "0"

      const sql = `
        UPDATE ${SCHEMA_BD}.T_US_GC
        SET ID_RL = ?, ACTIVO = ?, V_TK = V_TK + 1, ACTUALIZADO_EL = CURRENT TIMESTAMP, ACTUALIZADO_POR = ?
        WHERE ID = ?
      `;
      await cn.query(sql, [data.roleId, status, username, id]);
      await cn.commit();
      return { success: true };
    } catch (err) {
      await cn.rollback().catch(() => {});
      throw err;
    }
  }).catch((error) => {
    console.error(error);
    throw new Error(`Ocurrio algo al actualizar usuario: ${error}`);
  });
};

const putPasswordUser = async (id, password, username) => {
  return withConnection(async (cn) => {
    await cn.beginTransaction();
    try {
      const sql = `
        UPDATE ${SCHEMA_BD}.T_US_GC
        SET CLV = ?, ACTUALIZADO_EL = CURRENT TIMESTAMP, ACTUALIZADO_POR = ?
        WHERE ID = ?
      `;
      await cn.query(sql, [password, username, id]);
      await cn.commit();
      return { success: true };
    } catch (err) {
      await cn.rollback().catch(() => {});
      throw err;
    }
  }).catch((error) => {
    console.error(error);
    throw new Error(`Ocurrio algo al actualizar usuario: ${error}`);
  });
};

/* ROLES */

const getRoles = async () => {
  return withConnection(async (cn) => {
    const result = await cn.query(`SELECT * FROM ${SCHEMA_BD}.T_RL_GC WHERE DESCRIPCION NOT LIKE 'SUPER'`);
    return result.map((row) => ({
      id: row.ID,
      name: row.DESCRIPCION.trim(),
      descripcion: row.DESCRIPCION2 ? row.DESCRIPCION2.trim() : "",
    }));
  }).catch((error) => {
    console.error(error);
    throw new Error(`Ocurrio algo al consultar lista de roles: ${error}`);
  });
};

const getRolesGesoper = async () => {
  return withConnection(async (cn) => {
    const result = await cn.query(`SELECT * FROM ${SCHEMA_BD}.PO_USUARIOPERFIL`);
    return result.map((row) => ({ id: row.ID, name: row.DESCRIPCION.trim() }));
  }).catch((error) => {
    console.error(error);
    throw new Error(`Ocurrio algo al consultar lista de roles del gesoper: ${error}`);
  });
};

const postRole = async (data, username) => {
  return withConnection(async (cn) => {
    await cn.beginTransaction();
    try {
      const resultId = await cn.query(`SELECT COALESCE(MAX(ID), 0) + 1 AS ID FROM ${SCHEMA_BD}.T_RL_GC`);
      const roleId = resultId[0].ID;

      await cn.query(
        `INSERT INTO ${SCHEMA_BD}.T_RL_GC (ID, DESCRIPCION, DESCRIPCION2, CREADO_POR, ACTUALIZADO_POR) VALUES (?, ?, ?, ?, ?)`,
        [roleId, data.name, data.description, username, username],
      );

      if (data.permissions.length > 0) {
        for (const perm of data.permissions) {
          await cn.query(`INSERT INTO ${SCHEMA_BD}.T_RL_PS_GC (ID_RL, ID_PS) VALUES (?, ?)`, [roleId, perm]);
        }
      }

      await cn.commit();
      return { success: true };
    } catch (err) {
      await cn.rollback().catch(() => {});
      throw err;
    }
  }).catch((error) => {
    throw new Error(`Ocurrio algo al insertar un rol: ${error}`);
  });
};

/* PERMISOS */

const getPermissions = async () => {
  return withConnection(async (cn) => {
    const result = await cn.query(`SELECT ID, TRIM(DESCRIPCION) AS DESCRIPCION, NOMBRE, MODULO, DESCRIPCION2 FROM ${SCHEMA_BD}.T_PS_GC`);
    return result.map((row) => ({
      id: row.ID,
      name: row.NOMBRE.trim(),
      description: row.DESCRIPCION2.trim(),
      module: row.MODULO.trim(),
      key: row.DESCRIPCION,
    }));
  }).catch((error) => {
    throw new Error(`Ocurrio algo al consultar lista de permisos: ${error}`);
  });
};

const getPermissionsByUser = async (id) => {
  return withConnection(async (cn) => {
    const sql = `
      SELECT
        P.ID, P.DESCRIPCION, P.NOMBRE, P.DESCRIPCION2, P.MODULO,
        CASE WHEN RP.ID_PS IS NOT NULL THEN 1 ELSE 0 END AS ACTIVO
      FROM ${SCHEMA_BD}.T_PS_GC P
      LEFT JOIN (
          SELECT RP.ID_PS
          FROM ${SCHEMA_BD}.T_US_GC U
          JOIN ${SCHEMA_BD}.T_RL_GC R ON U.ID_RL = R.ID
          JOIN ${SCHEMA_BD}.T_RL_PS_GC RP ON R.ID = RP.ID_RL
          WHERE U.ID = ?
      ) RP ON P.ID = RP.ID_PS
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
  }).catch((error) => {
    console.error(error);
    throw new Error(`Ocurrio algo al consultar lista de permisos del usuario: ${error}`);
  });
};

const getPermissionsByRole = async (id) => {
  return withConnection(async (cn) => {
    const sql = `
      SELECT
        P.ID, P.DESCRIPCION, P.NOMBRE, P.DESCRIPCION2, P.MODULO,
        CASE WHEN RP.ID_PS IS NOT NULL THEN 1 ELSE 0 END AS ACTIVO
      FROM SPEED400AT.T_PS_GC P
      LEFT JOIN SPEED400AT.T_RL_PS_GC RP ON P.ID = RP.ID_PS AND RP.ID_RL = ?
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
  }).catch((error) => {
    console.error(error);
    throw new Error(`Ocurrio algo al consultar lista de permisos del rol: ${error}`);
  });
};

const putPermissionsByRole = async (id, permissions) => {
  return withConnection(async (cn) => {
    await cn.beginTransaction();
    try {
      await cn.query(`DELETE FROM ${SCHEMA_BD}.T_RL_PS_GC WHERE ID_RL = ?`, [id]);

      for (const perm of permissions) {
        await cn.query(`INSERT INTO ${SCHEMA_BD}.T_RL_PS_GC (ID_RL, ID_PS) VALUES (?, ?)`, [id, perm]);
      }

      await cn.query(`UPDATE ${SCHEMA_BD}.T_US_GC SET V_TK = V_TK + 1 WHERE ID_RL = ?`, [id]);
      await cn.commit();
      return { success: true };
    } catch (err) {
      await cn.rollback().catch(() => {});
      throw err;
    }
  }).catch((error) => {
    console.error(error);
    throw new Error(`Ocurrio un error al actualizar los permisos: ${error}`);
  });
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
