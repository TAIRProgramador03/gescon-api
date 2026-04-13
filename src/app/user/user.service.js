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

    await cn.query(sql, [id, data.roleId]);

    await cn.commit();

    return { success: true };
  } catch (error) {
    await cn.rollback();

    console.error(error)
    throw new Error(`Ocurrio algo al actualizar usuario: ${error}`)
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

/* PERMISOS */

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
  getUserById,
  putUser,
  getRoles,
  getPermissionsByUser,
  getPermissionsByRole,
  putPermissionsByRole,
};
