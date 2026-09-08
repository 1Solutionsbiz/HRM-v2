  import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
  import { promisify } from 'node:util';
  import { PrismaMariaDb } from '@prisma/adapter-mariadb';
  import { PrismaClient } from '../src/generated/prisma/client.js';

  const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;
  const SCRYPT_N = 16384;
  const SCRYPT_R = 8;
  const SCRYPT_P = 1;
  const KEY_LENGTH = 64;
  const SALT_LENGTH = 16;

  async function hashPassword(plain: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const derivedKey = (await scrypt(plain, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P })) as Buffer;
    return `scrypt$N=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
  }

  function temporaryPassword(): string {
    return randomBytes(18).toString('base64url');
  }

  async function nextEmployeeCode(prisma: PrismaClient, dateOfJoining: Date): Promise<string> {
    const year = dateOfJoining.getUTCFullYear() % 100;
    const counter = await prisma.sequenceCounter.update({
      where: { key: 'employeeCode' },
      data: { value: { increment: 1 } },
    });
    return `EXP-${String(year).padStart(2, '0')}-${String(counter.value).padStart(4, '0')}-OM`;
  }

  async function ensureHire(
    prisma: PrismaClient,
    opts: { email: string; firstName: string; lastName: string; departmentId: string; designationId: string; monthlySalary: number },
  ) {
    const existingUser = await prisma.user.findUnique({ where: { email: opts.email } });
    if (existingUser) {
      console.log(`Skipping ${opts.email} - a user with this email already exists.`);
      return;
    }

    const role = await prisma.role.findUnique({ where: { key: 'employee' } });
    if (!role) throw new Error("Role 'employee' not found");

    const tempPassword = temporaryPassword();
    const passwordHash = await hashPassword(tempPassword);
    const user = await prisma.user.create({ data: { email: opts.email, passwordHash } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, assignedByUserId: user.id } });

    const dateOfJoining = new Date();
    const employeeCode = await nextEmployeeCode(prisma, dateOfJoining);

    const employee = await prisma.employee.create({
      data: {
        userId: user.id,
        employeeCode,
        firstName: opts.firstName,
        lastName: opts.lastName,
        dateOfJoining,
        employmentType: 'FULL_TIME',
        departmentId: opts.departmentId,
        designationId: opts.designationId,
      },
    });

    await prisma.salaryStructure.create({
      data: { employeeId: employee.id, currentAmount: opts.monthlySalary, status: 'ACTIVE', lastRevisedAt: dateOfJoining },
    });

    const templates = await prisma.onboardingStepTemplate.findMany({ where: { isActive: true } });
    if (templates.length > 0) {
      await prisma.employeeOnboardingStep.createMany({
        data: templates.map((t) => ({ employeeId: employee.id, stepTemplateId: t.id })),
      });
    }

    console.log(`Created ${opts.firstName} ${opts.lastName} (${employeeCode}), email ${opts.email}, temp password: ${tempPassword}`);
  }

  async function main() {
    const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL as string) });

    let department = await prisma.department.findUnique({ where: { name: 'Facilities' } });
    if (!department) {
      department = await prisma.department.create({ data: { name: 'Facilities' } });
      console.log('Created Facilities department.');
    }

    async function ensureDesignation(title: string) {
      const existing = await prisma.designation.findFirst({ where: { title, departmentId: department!.id } });
      if (existing) return existing;
      return prisma.designation.create({ data: { title, departmentId: department!.id } });
    }

    const cleanerDesignation = await ensureDesignation('Office Cleaner');
    const helpDesignation = await ensureDesignation('Office Help');

    await ensureHire(prisma, {
      email: 'deepu.razak@1solutions.biz',
      firstName: 'Deepu',
      lastName: 'Razak',
      departmentId: department.id,
      designationId: cleanerDesignation.id,
      monthlySalary: 3500,
    });

    await ensureHire(prisma, {
      email: 'raman.pariyad@1solutions.biz',
      firstName: 'Raman',
      lastName: 'Pariyad',
      departmentId: department.id,
      designationId: helpDesignation.id,
      monthlySalary: 10000,
    });

    const atul = await prisma.employee.findUnique({ where: { employeeCode: 'EXP-10-0001' } });
    if (!atul) {
      console.log("Could not find Atul's employee record (EXP-10-0001) - skipping salary update.");
    } else {
      const existingStructure = await prisma.salaryStructure.findUnique({ where: { employeeId: atul.id } });
      const previousAmount = existingStructure ? existingStructure.currentAmount.toNumber() : null;
      const today = new Date();

      if (existingStructure) {
        await prisma.salaryStructure.update({ where: { employeeId: atul.id }, data: { currentAmount: 200000, lastRevisedAt: today } });
      } else {
        await prisma.salaryStructure.create({ data: { employeeId: atul.id, currentAmount: 200000, status: 'ACTIVE', lastRevisedAt: today } });
      }

      await prisma.salaryRevision.create({
        data: {
          employeeId: atul.id,
          previousAmount,
          newAmount: 200000,
          effectiveDate: today,
          revisedByUserId: atul.userId,
          reason: 'Director salary recorded for committed payroll reporting',
        },
      });

      console.log(`Set Atul's salary to 200000 (was ${previousAmount ?? 'none'}).`);
    }

    await prisma.$disconnect();
  }
                                                                                                                                                                                              
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
