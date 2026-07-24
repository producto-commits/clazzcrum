import "dotenv/config";
import { PrismaClient, Priority } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import {
  ACTIONS,
  RESOURCES,
  ROLE_PERMISSIONS,
  ROLE_META,
  type Action,
  type Resource,
  type RoleKey,
} from "../src/server/rbac";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("→ Sembrando permisos (acción x recurso)...");
  // 1. Crear todos los permisos posibles (action x resource)
  for (const resource of RESOURCES) {
    for (const action of ACTIONS) {
      await prisma.permission.upsert({
        where: { action_resource: { action, resource } },
        update: {},
        create: { action, resource },
      });
    }
  }

  console.log("→ Sembrando roles y asignando permisos...");
  // 2. Crear roles y conectar sus permisos según la matriz RBAC
  for (const roleKey of Object.keys(ROLE_PERMISSIONS) as RoleKey[]) {
    const meta = ROLE_META[roleKey];
    const role = await prisma.role.upsert({
      where: { key: roleKey },
      update: { name: meta.name, description: meta.description },
      create: { key: roleKey, name: meta.name, description: meta.description },
    });

    // Limpiar y re-asignar permisos del rol (idempotente)
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

    const map = ROLE_PERMISSIONS[roleKey];
    for (const resource of Object.keys(map) as Resource[]) {
      const spec = map[resource]!;
      const actions: Action[] = spec === "*" ? [...ACTIONS] : spec;
      for (const action of actions) {
        const perm = await prisma.permission.findUnique({
          where: { action_resource: { action, resource } },
        });
        if (perm) {
          await prisma.rolePermission.create({
            data: { roleId: role.id, permissionId: perm.id },
          });
        }
      }
    }
  }

  console.log("→ Sembrando políticas de SLA por defecto...");
  // 3. SLA por defecto (configurable luego por el admin)
  const slaDefaults: { priority: Priority; firstResponseMins: number; resolutionMins: number }[] = [
    { priority: "CRITICAL", firstResponseMins: 60, resolutionMins: 8 * 60 },
    { priority: "HIGH", firstResponseMins: 4 * 60, resolutionMins: 24 * 60 },
    { priority: "MEDIUM", firstResponseMins: 8 * 60, resolutionMins: 3 * 24 * 60 },
    { priority: "LOW", firstResponseMins: 24 * 60, resolutionMins: 5 * 24 * 60 },
  ];
  for (const sla of slaDefaults) {
    await prisma.sLAPolicy.upsert({
      where: { priority: sla.priority },
      update: { firstResponseMins: sla.firstResponseMins, resolutionMins: sla.resolutionMins },
      create: sla,
    });
  }

  console.log("→ Sembrando categorías de tickets por defecto...");
  for (const name of ["Bug", "Duda", "Solicitud de cambio", "Otro"]) {
    await prisma.ticketCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log("→ Creando usuario administrador inicial...");
  // 4. Admin inicial
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@clazz.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin12345!";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const adminRole = await prisma.role.findUnique({ where: { key: "admin" } });
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Administrador Clazz",
      passwordHash,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });
  if (adminRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
      update: {},
      create: { userId: admin.id, roleId: adminRole.id },
    });
  }

  console.log("\n✅ Seed completado.");
  console.log(`   Admin: ${adminEmail}  /  contraseña: ${adminPassword}`);
  console.log("   (Cambiar la contraseña del admin tras el primer ingreso.)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
