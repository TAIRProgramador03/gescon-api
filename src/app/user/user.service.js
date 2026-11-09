const { withConnection } = require("../../shared/utils.js");
const { SCHEMA_BD, CODE_SYSTEM } = require("../../shared/conf.js");

/* USUARIOS */
const getUsers = async () => {
  return withConnection(async (cn) => {
    const sql = `
      SELECT
        U.ID, U.NOMBRE, U.APELLIDO, U.USU, U.COD_EMP, U.ACTIVO, U.CLV,
        US.ID_RL, US.ACTIVO AS ACTIVO_SISTEMA,
        R.DESCRIPCION, R.DESCRIPCION2
      FROM ${SCHEMA_BD}.T_US_GC U
      INNER JOIN ${SCHEMA_BD}.T_US_SY_GC US ON US.ID_US = U.ID
      INNER JOIN ${SCHEMA_BD}.T_SYS_G360 S ON S.ID = US.ID_SYS
      LEFT JOIN ${SCHEMA_BD}.T_RL_GC R ON R.ID = US.ID_RL
      WHERE TRIM(S.CODIGO) = ?
        AND (R.ES_SUPER IS NULL OR R.ES_SUPER <> 'S')
      ORDER BY U.NOMBRE
    `;
    const result = await cn.query(sql, [CODE_SYSTEM]);
    if (result.length === 0) return [];

    const ids = result.map((row) => row.ID);
    const placeholders = ids.map(() => "?").join(",");
    const sistemasSql = `
      SELECT
        US.ID_US,
        TRIM(S.CODIGO) AS CODIGO_SISTEMA,
        TRIM(S.NOMBRE) AS NOMBRE_SISTEMA,
        US.ACTIVO AS ACTIVO_SISTEMA,
        US.ID_RL,
        R.DESCRIPCION AS ROL_DESCRIPCION
      FROM ${SCHEMA_BD}.T_US_SY_GC US
      INNER JOIN ${SCHEMA_BD}.T_SYS_G360 S ON S.ID = US.ID_SYS
      LEFT JOIN ${SCHEMA_BD}.T_RL_GC R ON R.ID = US.ID_RL
      WHERE US.ID_US IN (${placeholders})
    `;
    const sistemasResult = await cn.query(sistemasSql, ids);

    const sistemasPorUsuario = sistemasResult.reduce((acc, row) => {
      if (!acc[row.ID_US]) acc[row.ID_US] = [];
      acc[row.ID_US].push({
        codigo: row.CODIGO_SISTEMA,
        nombre: row.NOMBRE_SISTEMA,
        activo: row.ACTIVO_SISTEMA === "S",
        rol: row.ID_RL
          ? { id: row.ID_RL, name: row.ROL_DESCRIPCION.trim() }
          : null,
      });
      return acc;
    }, {});

    return result.map((row) => ({
      id: row.ID,
      nombre: row.NOMBRE ? row.NOMBRE.trim() : "",
      apellido: row.APELLIDO ? row.APELLIDO.trim() : "",
      usuario: row.USU.trim(),
      codEmp: row.COD_EMP ? row.COD_EMP.trim() : "",
      estado: row.ACTIVO == "1" ? true : false,
      accesoSistema: row.ACTIVO_SISTEMA === "S" ? true : false,
      conClave: row.CLV ? true : false,
      idRol: row.ID_RL,
      rol: row.ID_RL
        ? {
            id: row.ID_RL,
            name: row.DESCRIPCION.trim(),
            descripcion: row.DESCRIPCION2 ? row.DESCRIPCION2.trim() : "",
          }
        : null,
      sistemas: sistemasPorUsuario[row.ID] || [],
    }));
  }).catch((error) => {
    console.error(error);
    throw new Error(`Ocurrio algo al consultar lista de usuarios: ${error}`);
  });
};

const getListOthersUsers = async () => {
  return withConnection(async (cn) => {
    const sql = `
      SELECT
          U.ID,
          TRIM(COALESCE(TRIM(U.NOMBRE), '') || ' ' || COALESCE(TRIM(U.APELLIDO), '')) AS NOMBRE,
          TRIM(U.USU) AS USU,
          TRIM(U.COD_EMP) AS COD_EMP
      FROM ${SCHEMA_BD}.T_US_GC U
      WHERE U.ACTIVO = '1'
        AND NOT EXISTS (
              SELECT 1
                FROM ${SCHEMA_BD}.T_US_SY_GC X
              WHERE X.ID_US = U.ID
                AND X.ID_SYS = (SELECT ID FROM ${SCHEMA_BD}.T_SYS_G360 WHERE TRIM(CODIGO) = ?)
        )
        AND NOT EXISTS (
              SELECT 1
                FROM ${SCHEMA_BD}.T_US_SY_GC S
                INNER JOIN ${SCHEMA_BD}.T_RL_GC R ON R.ID = S.ID_RL
              WHERE S.ID_US = U.ID
                AND R.ES_SUPER = 'S'
        )
      ORDER BY U.NOMBRE, U.APELLIDO
    `;

    const result = await cn.query(sql, [CODE_SYSTEM]);

    return result.map((usr) => ({
      id: usr.ID,
      fullname: usr.NOMBRE ?? "-",
      username: usr.USU,
      codEmp: usr.COD_EMP ?? "-",
    }));
  }).catch((error) => {
    console.error(error);
    throw new Error(`Ocurrio algo al consultar usuarios de otros sistemas: ${error}`);
  });
};

const getUserByField = async (field, value) => {
  return withConnection(async (cn) => {
    const fieldMap = { id: "U.ID", usuario: "U.USU", codEmp: "U.COD_EMP" };
    const column = fieldMap[field];
    if (!column) throw new Error("Campo de busqueda no permitido.");

    const sql = `
      SELECT U.ID, U.NOMBRE, U.APELLIDO, U.USU, U.COD_EMP, U.CLV, U.ACTIVO
      FROM ${SCHEMA_BD}.T_US_GC U
      WHERE ${column} = ?
    `;
    const result = await cn.query(sql, [value]);
    if (!result[0]) return null;

    const row = result[0];
    return {
      id: row.ID,
      nombre: row.NOMBRE ? row.NOMBRE.trim() : "",
      apellido: row.APELLIDO ? row.APELLIDO.trim() : "",
      usuario: row.USU.trim(),
      codEmp: row.COD_EMP ? row.COD_EMP.trim() : "",
      clave: row.CLV ? row.CLV.trim() : "",
      estado: row.ACTIVO == "1" ? true : false,
    };
  }).catch((error) => {
    console.error(error);
    throw new Error(`Ocurrio algo al obtener usuario: ${error}`);
  });
};

const getFindUserSystemAccess = async (
  { id, username, codEmp } = {},
  { withPsw = false, scope = "system" } = {},
) => {
  return withConnection(async (cn) => {
    const condition = [];
    const params = [CODE_SYSTEM];

    if (id) {
      condition.push("U.ID = ?");
      params.push(id);
    }
    if (username) {
      condition.push("TRIM(U.USU) = ?");
      params.push(username.trim());
    }
    if (codEmp) {
      condition.push("TRIM(U.COD_EMP) = ?");
      params.push(codEmp.trim());
    }

    if (condition.length === 0) return null;

    const join = scope === "system" ? "INNER JOIN" : "LEFT JOIN";

    const sql = `
      SELECT U.ID, U.ACTIVO AS USUARIO_ACTIVO, U.CLV,
             US.ID_RL, US.ACTIVO AS ACCESO_ACTIVO, R.ES_SUPER
      FROM ${SCHEMA_BD}.T_US_GC U
      ${join} (
        SELECT X.ID_US, X.ID_RL, X.ACTIVO
        FROM ${SCHEMA_BD}.T_US_SY_GC X
        INNER JOIN ${SCHEMA_BD}.T_SYS_G360 S
          ON S.ID = X.ID_SYS AND TRIM(S.CODIGO) = ? AND S.ACTIVO = 'S'
      ) US ON US.ID_US = U.ID
      LEFT JOIN ${SCHEMA_BD}.T_RL_GC R ON R.ID = US.ID_RL
      WHERE ${condition.join(" AND ")}
    `;

    const result = await cn.query(sql, params);
    if (!result[0]) return null;

    const row = result[0];
    return {
      id: row.ID,
      roleId: row.ID_RL != null ? row.ID_RL : null,
      hasAccess: row.ACCESO_ACTIVO === "S",
      isSuper: row.ES_SUPER === "S",
      estadoCuenta: row.USUARIO_ACTIVO == "1" ? true : false,
      ...(withPsw && { clave: row.CLV ? row.CLV.trim() : null }),
    };
  }).catch((error) => {
    console.error(error);
    throw new Error(`Ocurrio algo al validar acceso del usuario: ${error}`);
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
        descripcion: result[0].DESCRIPCION2
          ? result[0].DESCRIPCION2.trim()
          : "",
      },
    };
  }).catch((error) => {
    console.error(error);
    throw new Error(`Ocurrio algo al obtener usuario por id: ${error}`);
  });
};

const postUser = async (data, username) => {
  return withConnection(async (cn) => {
    await cn.beginTransaction();
    try {
      // 1. Validar que el rol sea válido para este sistema (o global) y no sea súper rol
      const [rol] = await cn.query(
        `SELECT R.ID
         FROM ${SCHEMA_BD}.T_RL_GC R
         LEFT JOIN ${SCHEMA_BD}.T_SYS_G360 S ON S.ID = R.ID_SYS
         WHERE R.ID = ? AND R.ES_SUPER = 'N'
           AND (R.ID_SYS IS NULL OR TRIM(S.CODIGO) = ?)`,
        [data.rol, CODE_SYSTEM],
      );
      if (!rol) {
        throw new Error("El rol indicado no es valido para este sistema.");
      }

      // 2. Usuario (datos globales, sin ID_RL)
      const sql = `
        INSERT INTO ${SCHEMA_BD}.T_US_GC
          (NOMBRE, APELLIDO, USU, COD_EMP, CLV, ACTIVO, V_TK, CREADO_POR, ACTUALIZADO_POR)
        VALUES (?, ?, ?, ?, ?, '1', 0, ?, ?)
      `;
      await cn.query(sql, [
        data.nombre,
        data.apellido,
        data.usuario,
        data.codEmp,
        data.clave,
        username,
        username,
      ]);

      // 3. Recuperar el ID recién generado
      const [idRow] = await cn.query(
        `SELECT IDENTITY_VAL_LOCAL() AS ID FROM SYSIBM.SYSDUMMY1`,
      );
      const userId = idRow.ID;

      // 4. Acceso al sistema actual con el rol ya validado
      const sqlAcceso = `
        INSERT INTO ${SCHEMA_BD}.T_US_SY_GC (ID_US, ID_SYS, ID_RL, ACTIVO, CREADO_POR)
        VALUES (?, (SELECT ID FROM ${SCHEMA_BD}.T_SYS_G360 WHERE TRIM(CODIGO) = ?), ?, 'S', ?)
      `;
      await cn.query(sqlAcceso, [userId, CODE_SYSTEM, data.rol, username]);

      await cn.commit();
      return { success: true, id: userId };
    } catch (err) {
      await cn.rollback().catch(() => {});
      throw err;
    }
  }).catch((error) => {
    console.error("Error completo:", error);
    throw new Error(`Ocurrio algo al crear usuario: ${error}`);
  });
};

const postAssignUsersToSystem = async (userIds, roleId, createdBy) => {
  return withConnection(async (cn) => {
    await cn.beginTransaction();
    try {
      // 1. Validar que el rol sea válido para este sistema (o global) y no sea súper rol
      const [okRole] = await cn.query(
        `SELECT 1 AS X FROM ${SCHEMA_BD}.T_RL_GC
         WHERE ID = ? AND ES_SUPER = 'N'
           AND (ID_SYS IS NULL
                OR ID_SYS = (SELECT ID FROM ${SCHEMA_BD}.T_SYS_G360 WHERE TRIM(CODIGO) = ?))`,
        [roleId, CODE_SYSTEM],
      );
      if (!okRole) throw new Error("ROLE_NOT_VALID_FOR_SYSTEM");

      // 2. Resolver el ID del sistema actual una sola vez
      const [sys] = await cn.query(
        `SELECT ID FROM ${SCHEMA_BD}.T_SYS_G360 WHERE TRIM(CODIGO) = ?`,
        [CODE_SYSTEM],
      );
      const sysId = sys.ID;

      const ids = [...new Set(userIds)].filter(Number.isInteger);
      let inserted = 0;

      for (let i = 0; i < ids.length; i += 100) {
        const part = ids.slice(i, i + 100);
        const placeholders = part.map(() => "?").join(",");

        // Solo usuarios que existan y aún no tengan registro en este sistema
        const eligible = await cn.query(
          `SELECT U.ID FROM ${SCHEMA_BD}.T_US_GC U
           WHERE U.ID IN (${placeholders})
             AND NOT EXISTS (
               SELECT 1 FROM ${SCHEMA_BD}.T_US_SY_GC X
               WHERE X.ID_US = U.ID AND X.ID_SYS = ?)`,
          [...part, sysId],
        );
        const toInsert = eligible.map((row) => row.ID);

        if (toInsert.length > 0) {
          const values = toInsert.map(() => "(?, ?, ?, 'S', ?)").join(",");
          await cn.query(
            `INSERT INTO ${SCHEMA_BD}.T_US_SY_GC (ID_US, ID_SYS, ID_RL, ACTIVO, CREADO_POR)
             VALUES ${values}`,
            toInsert.flatMap((uid) => [uid, sysId, roleId, createdBy]),
          );
          inserted += toInsert.length;
        }
      }

      await cn.commit();
      return { success: true, inserted };
    } catch (err) {
      await cn.rollback().catch(() => {});
      throw err;
    }
  }).catch((error) => {
    console.error(error);
    throw new Error(`Ocurrio algo al asignar usuarios al sistema: ${error}`);
  });
};

const putUser = async (id, data, username) => {
  return withConnection(async (cn) => {
    await cn.beginTransaction();
    try {
      const status = data.status ? "1" : "0";

      // 1. Validar que el rol pertenece a este sistema o es global
      const [rol] = await cn.query(
        `SELECT R.ID
         FROM ${SCHEMA_BD}.T_RL_GC R
         LEFT JOIN ${SCHEMA_BD}.T_SYS_G360 S ON S.ID = R.ID_SYS
         WHERE R.ID = ? AND (R.ID_SYS IS NULL OR TRIM(S.CODIGO) = ?)`,
        [data.roleId, CODE_SYSTEM],
      );
      if (!rol) {
        throw new Error("El rol indicado no pertenece a este sistema.");
      }

      // 2. Datos propios de la cuenta (sin tocar NOMBRE/APELLIDO, como pediste)
      const sql = `
        UPDATE ${SCHEMA_BD}.T_US_GC
        SET ACTIVO = ?, V_TK = V_TK + 1, ACTUALIZADO_EL = CURRENT TIMESTAMP, ACTUALIZADO_POR = ?
        WHERE ID = ?
      `;
      await cn.query(sql, [status, username, id]);

      // 3. Rol scoped al sistema actual
      const sqlRole = `
        UPDATE ${SCHEMA_BD}.T_US_SY_GC
        SET ID_RL = ?
        WHERE ID_US = ?
          AND ID_SYS = (SELECT ID FROM ${SCHEMA_BD}.T_SYS_G360 WHERE TRIM(CODIGO) = ?)
      `;
      const resultRole = await cn.query(sqlRole, [
        data.roleId,
        id,
        CODE_SYSTEM,
      ]);
      if (resultRole.count === 0) {
        throw new Error(
          "El usuario no tiene acceso registrado a este sistema.",
        );
      }

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
    const result = await cn.query(
      `SELECT R.*
       FROM ${SCHEMA_BD}.T_RL_GC R
       LEFT JOIN ${SCHEMA_BD}.T_SYS_G360 S ON S.ID = R.ID_SYS
       WHERE (R.ID_SYS IS NULL OR TRIM(S.CODIGO) = ?)
         AND R.ES_SUPER <> 'S'`,
      [CODE_SYSTEM],
    );
    return result.map((row) => ({
      id: row.ID,
      name: row.DESCRIPCION.trim(),
      descripcion: row.DESCRIPCION2 ? row.DESCRIPCION2.trim() : "",
      global: row.ID_SYS === null,
    }));
  }).catch((error) => {
    console.error(error);
    throw new Error(`Ocurrio algo al consultar lista de roles: ${error}`);
  });
};

const postRole = async (data, username) => {
  return withConnection(async (cn) => {
    await cn.beginTransaction();
    try {
      // 1. Rol: asignado a este sistema, nunca super rol desde acá
      await cn.query(
        `INSERT INTO ${SCHEMA_BD}.T_RL_GC
           (DESCRIPCION, DESCRIPCION2, ID_SYS, ES_SUPER, CREADO_POR, ACTUALIZADO_POR)
         VALUES (?, ?, (SELECT ID FROM ${SCHEMA_BD}.T_SYS_G360 WHERE TRIM(CODIGO) = ?), 'N', ?, ?)`,
        [data.name, data.description, CODE_SYSTEM, username, username],
      );

      const [idRow] = await cn.query(
        `SELECT IDENTITY_VAL_LOCAL() AS ID FROM SYSIBM.SYSDUMMY1`,
      );
      const roleId = idRow.ID;

      // 2. Dedupe + validar que los permisos pertenezcan a este sistema
      const ids = [...new Set(data.permissions ?? [])].filter(Number.isInteger);

      if (ids.length > 0) {
        const placeholders = ids.map(() => "?").join(",");
        const validPerms = await cn.query(
          `SELECT ID FROM ${SCHEMA_BD}.T_PS_GC
           WHERE ID IN (${placeholders})
             AND ID_SYS = (SELECT ID FROM ${SCHEMA_BD}.T_SYS_G360 WHERE TRIM(CODIGO) = ?)`,
          [...ids, CODE_SYSTEM],
        );
        const validIds = validPerms.map((row) => row.ID);

        for (const perm of validIds) {
          await cn.query(
            `INSERT INTO ${SCHEMA_BD}.T_RL_PS_GC (ID_RL, ID_PS) VALUES (?, ?)`,
            [roleId, perm],
          );
        }
      }

      await cn.commit();
      return { success: true, id: roleId };
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
    const result = await cn.query(
      `SELECT p.ID, TRIM(p.DESCRIPCION) AS DESCRIPCION, p.NOMBRE, p.MODULO, p.DESCRIPCION2
       FROM ${SCHEMA_BD}.T_PS_GC p
       INNER JOIN ${SCHEMA_BD}.T_SYS_G360 s ON s.ID = p.ID_SYS
       WHERE TRIM(s.CODIGO) = ?`,
      [CODE_SYSTEM],
    );
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
      INNER JOIN ${SCHEMA_BD}.T_SYS_G360 S ON S.ID = P.ID_SYS
      LEFT JOIN (
          SELECT RP.ID_PS
          FROM ${SCHEMA_BD}.T_US_SY_GC US
          JOIN ${SCHEMA_BD}.T_SYS_G360 SY ON US.ID_SYS = SY.ID
          JOIN ${SCHEMA_BD}.T_RL_PS_GC RP ON US.ID_RL = RP.ID_RL
          WHERE US.ID_US = ? AND TRIM(SY.CODIGO) = ?
      ) RP ON P.ID = RP.ID_PS
      WHERE TRIM(S.CODIGO) = ?
      ORDER BY P.MODULO
    `;
    const result = await cn.query(sql, [id, CODE_SYSTEM, CODE_SYSTEM]);
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
    throw new Error(
      `Ocurrio algo al consultar lista de permisos del usuario: ${error}`,
    );
  });
};

const getPermissionsByRole = async (id) => {
  return withConnection(async (cn) => {
    const sql = `
      SELECT
        P.ID, P.DESCRIPCION, P.NOMBRE, P.DESCRIPCION2, P.MODULO,
        CASE WHEN RP.ID_PS IS NOT NULL THEN 1 ELSE 0 END AS ACTIVO
      FROM ${SCHEMA_BD}.T_PS_GC P
      INNER JOIN ${SCHEMA_BD}.T_SYS_G360 S ON S.ID = P.ID_SYS
      LEFT JOIN ${SCHEMA_BD}.T_RL_PS_GC RP ON P.ID = RP.ID_PS AND RP.ID_RL = ?
      WHERE TRIM(S.CODIGO) = ?
      ORDER BY P.MODULO
    `;
    const result = await cn.query(sql, [id, CODE_SYSTEM]);
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
    throw new Error(
      `Ocurrio algo al consultar lista de permisos del rol: ${error}`,
    );
  });
};

const putPermissionsByRole = async (id, permissions) => {
  return withConnection(async (cn) => {
    await cn.beginTransaction();
    try {
      // 1. Resolver el ID del sistema actual una sola vez
      const [sys] = await cn.query(
        `SELECT ID FROM ${SCHEMA_BD}.T_SYS_G360 WHERE TRIM(CODIGO) = ?`,
        [CODE_SYSTEM],
      );
      if (!sys) {
        throw new Error(
          `No existe el sistema configurado en CODE_SYSTEM: ${CODE_SYSTEM}`,
        );
      }
      const idSys = sys.ID;

      // 2. Blindaje: solo aceptar permisos que REALMENTE pertenecen a este sistema
      let validIds = [];
      if (permissions.length > 0) {
        const placeholders = permissions.map(() => "?").join(",");
        const validPerms = await cn.query(
          `SELECT ID FROM ${SCHEMA_BD}.T_PS_GC WHERE ID_SYS = ? AND ID IN (${placeholders})`,
          [idSys, ...permissions],
        );
        validIds = validPerms.map((row) => row.ID);

        // Si llegó algún ID que no pertenece a GESCON, cortamos en seco
        // (puede ser bug del frontend o manipulación del payload)
        if (validIds.length !== permissions.length) {
          throw new Error(
            "Se recibieron permisos que no pertenecen al sistema actual",
          );
        }
      }

      // 3. Borrar SOLO los permisos de este rol que pertenecen al sistema actual
      await cn.query(
        `DELETE FROM ${SCHEMA_BD}.T_RL_PS_GC
         WHERE ID_RL = ? AND ID_PS IN (
           SELECT ID FROM ${SCHEMA_BD}.T_PS_GC WHERE ID_SYS = ?
         )`,
        [id, idSys],
      );

      // 4. Insertar solo lo ya validado
      for (const perm of validIds) {
        await cn.query(
          `INSERT INTO ${SCHEMA_BD}.T_RL_PS_GC (ID_RL, ID_PS) VALUES (?, ?)`,
          [id, perm],
        );
      }

      // 5. Forzar refresco de sesión solo a los usuarios que tienen ESTE rol en ESTE sistema
      await cn.query(
        `UPDATE ${SCHEMA_BD}.T_US_GC
         SET V_TK = V_TK + 1
         WHERE ID IN (
           SELECT US.ID_US FROM ${SCHEMA_BD}.T_US_SY_GC US
           WHERE US.ID_RL = ? AND US.ID_SYS = ?
         )`,
        [id, idSys],
      );

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

/* SISTEMAS */
const putStatusAccessSystem = async (status, userId) => {
  return withConnection(async (cn) => {
    await cn.beginTransaction();
    try {
      const statusStr = status ? "S" : "N";

      const sql = `
        UPDATE ${SCHEMA_BD}.T_US_SY_GC
        SET ACTIVO = ?
        WHERE ID_US = ? AND ID_SYS = (SELECT ID FROM ${SCHEMA_BD}.T_SYS_G360 WHERE CODIGO = ?)
      `;

      await cn.query(sql, [statusStr, userId, CODE_SYSTEM]);

      await cn.commit();
      return { success: true };
    } catch (err) {
      await cn.rollback().catch(() => {});
      throw err;
    }
  }).catch((error) => {
    console.error(error);
    throw new Error(
      `Ocurrio un error al actualizar el acceso al sistema: ${error}`,
    );
  });
};

module.exports = {
  getUsers,
  getListOthersUsers,
  getUserByField,
  getFindUserSystemAccess,
  getUserById,
  postUser,
  postAssignUsersToSystem,
  putUser,
  putPasswordUser,
  getRoles,
  postRole,
  getPermissions,
  getPermissionsByUser,
  getPermissionsByRole,
  putPermissionsByRole,
  putStatusAccessSystem,
};
