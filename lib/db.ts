import prismaClient, {
  prisma,
} from "./prisma";

export const db = prismaClient;
export { prisma };
export default db;
